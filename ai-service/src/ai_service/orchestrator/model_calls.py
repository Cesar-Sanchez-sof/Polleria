"""Llamadas al Modelo 1 con control de consumo (T024, D-12, D-13, D-14).

:class:`ModelGateway` es el **único** punto por el que el orquestador llama a un
:class:`~ai_service.llm.provider.LlmProvider`:

0. Bloquea la entrada si contiene datos sensibles (BR-13) → :class:`SensitiveDataBlocked`, sin
   reservar presupuesto ni contactar al proveedor.
1. Estima los tokens de entrada (heurística simulada: ~4 caracteres por token).
2. Pide autorización a ``BudgetGuard`` (B1). Si se deniega → :class:`BudgetDenied` y **no hay
   llamada**.
3. Llama al proveedor; si falla, libera la reserva y lanza :class:`ModelUnavailable`. Un
   :class:`SecurityIncident` del proveedor libera la reserva y se propaga sin transformarse.
4. Comprueba que la respuesta corresponda a la solicitud y registra el consumo en ``UsageLog``
   (sin prompts ni respuestas).

En B3 el proveedor es siempre simulado: no hay llamadas a APIs comerciales. El contador de
``BudgetGuard`` vive en memoria y **no es un control económico garantizado para producción**
(R-06, P-22).
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

from pydantic import ValidationError

from ai_service.explanation.markers import render_verified
from ai_service.http.schemas import Figure, Period, QueryRequest
from ai_service.llm.budget import BudgetGuard, CallRequest
from ai_service.llm.provider import (
    ExplainInput,
    ExplainOutput,
    Intent,
    InterpretInput,
    InterpretOutput,
    LlmProvider,
    LlmRequest,
    LlmResponse,
    Meaning,
    TaskMismatchError,
    ensure_matches,
)
from ai_service.http.schemas import Turn
from ai_service.orchestrator.ports import Interpretation
from ai_service.orchestrator.prefilter import user_turns
from ai_service.orchestrator.security import SecurityIncident, ensure_no_sensitive_data

INSTRUCTIONS_VERSION = {"interpretar": "interpretar-v0", "explicar": "explicar-v0"}
OUTPUT_SCHEMA = {"interpretar": "interpretar-salida-v0", "explicar": "explicar-salida-v0"}


class ModelUnavailable(Exception):
    """El proveedor falló, no respondió o devolvió una respuesta inválida.

    ``code``: código fijo del proveedor (p. ej. ``INCOMPLETE_RESPONSE``, ``TIMEOUT``) para la traza y la
    auditoría; nunca el prompt, la respuesta ni la clave."""

    def __init__(self, message: str, code: str = "PROVIDER_ERROR") -> None:
        super().__init__(message)
        self.code = code if isinstance(code, str) and code.replace("_", "").isalpha() and code.isupper() else "PROVIDER_ERROR"


def estimate_tokens(text: str) -> int:
    """Estimación **simulada** de tokens (≈ 4 caracteres por token)."""
    return max(1, math.ceil(len(text) / 4))


class ModelGateway:
    def __init__(
        self,
        provider: LlmProvider,
        guard: BudgetGuard,
        *,
        model: str,
        max_input_tokens: dict[str, int],
        max_output_tokens: dict[str, int],
        timeout_ms: int = 8000,
    ) -> None:
        self._provider = provider
        self._guard = guard
        self._model = model
        self._max_in = dict(max_input_tokens)
        self._max_out = dict(max_output_tokens)
        self._timeout_ms = timeout_ms

    def call(self, trace_id: str, entrada: InterpretInput | ExplainInput) -> LlmResponse:
        task = entrada.tarea
        request = LlmRequest(
            id_traza=trace_id,
            instrucciones_version=INSTRUCTIONS_VERSION[task],
            entrada=entrada,
            esquema_salida=OUTPUT_SCHEMA[task],
            max_tokens_entrada=self._max_in[task],
            max_tokens_salida=self._max_out[task],
            timeout_ms=self._timeout_ms,
        )
        payload = entrada.model_dump_json()
        # BR-13: segunda línea de defensa, antes de reservar presupuesto o contactar al proveedor.
        ensure_no_sensitive_data(payload)  # SensitiveDataBlocked (SecurityIncident) se propaga
        input_tokens = estimate_tokens(payload)
        authorization = self._guard.authorize(
            CallRequest(trace_id=trace_id, task=task, model=self._model, input_tokens=input_tokens)
        )  # BudgetDenied se propaga: no hay llamada
        try:
            response = self._provider.complete(request)
            ensure_matches(request, response)
        except SecurityIncident:
            # Incidente detectado por el proveedor: se libera la reserva y se detiene todo.
            self._guard.cancel(authorization)
            raise
        except (TaskMismatchError, ValidationError) as exc:
            self._guard.cancel(authorization)
            raise ModelUnavailable("Respuesta del modelo inválida.", "INVALID_MODEL_OUTPUT") from exc
        except Exception as exc:  # fallo del proveedor: error controlado, sin detalles
            self._guard.cancel(authorization)
            raise ModelUnavailable("El proveedor del modelo no está disponible.", getattr(exc, "code", "PROVIDER_ERROR")) from exc
        self._guard.record(
            authorization,
            model_version=response.version,
            input_tokens=response.tokens_entrada,
            output_tokens=response.tokens_salida,
            latency_ms=response.latencia_ms,
            outcome="ok",
        )
        return response


class LlmBackedInterpreter:
    """Intérprete que usa el Modelo 1 a través de :class:`ModelGateway`.

    Solo envía el mensaje y los turnos del **usuario**: los turnos del asistente pueden contener
    cifras reales y no se reenvían (BR-13). El contexto de pantalla viaja como referencia.
    """

    def __init__(self, gateway: ModelGateway) -> None:
        self._gateway = gateway

    def interpret(self, request: QueryRequest) -> Interpretation:
        history = [Turn(rol="usuario", texto=text) for text in user_turns(request)]
        entrada = InterpretInput(
            tarea="interpretar", mensaje=request.mensaje, historial=history, contexto=request.contexto
        )
        output = self._gateway.call(request.id_traza, entrada).salida
        if not isinstance(output, InterpretOutput):
            raise ModelUnavailable("Salida de interpretación inesperada.")
        return Interpretation(
            intencion=output.intencion,
            cuenta=output.entidades.cuenta,
            indicador=output.entidades.indicador,
            necesita_aclaracion=output.necesita_aclaracion,
            consulta=output.entidades.consulta,
            concepto=output.entidades.concepto,
            consulta_libre=output.entidades.consulta_libre,
            restringido=output.entidades.restringido,
            historico=output.entidades.historico,
        )


class LlmBackedExplainer:
    """Explicador que usa el Modelo 1 **solo con marcadores** y verifica la salida (T023)."""

    def __init__(self, gateway: ModelGateway) -> None:
        self._gateway = gateway

    def explain(
        self,
        *,
        trace_id: str,
        intencion: Intent,
        periodo: Period | None,
        figures: Sequence[Figure],
        cuenta_nombre: str | None = None,
        consulta: str | None = None,
        meanings: Mapping[str, str] | None = None,
        text_labels: Mapping[str, str] | None = None,
    ) -> str:
        """``meanings`` (P1): significado genérico de cada marcador; ``text_labels``: textos ``eN`` de
        filas que se insertan tras validar y que **no** se envían al proveedor."""
        entrada = ExplainInput(
            tarea="explicar",
            intencion=intencion,
            periodo=periodo,
            marcadores=[figure.marcador for figure in figures],
            cuenta_nombre=cuenta_nombre,
            consulta=consulta,
            significados=[Meaning(marcador=m, significado=s) for m, s in (meanings or {}).items()],
        )
        output = self._gateway.call(trace_id, entrada).salida
        if not isinstance(output, ExplainOutput):
            raise ModelUnavailable("Salida de explicación inesperada.")
        return render_verified(output.texto, figures, text_labels)  # MarkerValidationError si no es segura
