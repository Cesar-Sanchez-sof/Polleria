"""Proveedor real del Modelo 1: OpenAI Responses API (``POST /v1/responses``) con ``httpx``.

Implementa :class:`~ai_service.llm.provider.LlmProvider`; el orquestador no cambia. Se usa siempre
detrás de :class:`~ai_service.orchestrator.model_calls.ModelGateway`, que antes de llamar bloquea
datos sensibles (BR-13) y pide autorización de presupuesto a ``BudgetGuard``.

Controles:

- **Qué se envía**: solo la entrada validada de la tarea. ``interpretar`` lleva el mensaje del
  usuario ya prefiltrado y sus turnos previos; ``explicar`` lleva intención, período y
  **identificadores de marcador** (el contrato no tiene campo para cifras). Nunca SQL, filas ni
  importes. ``store: false``.
- **Salidas estructuradas estrictas** (``json_schema`` con ``strict: true``) que además se validan
  con los modelos Pydantic existentes; la cuenta debe cumplir el formato de ``QueryPlan`` y la
  explicación pasa después por ``render_verified`` (marcadores, sin cifras inventadas).
- **Costes**: ``max_output_tokens`` por tarea y coste calculado con el precio configurado a partir
  del uso informado por la API.
- **Red**: solo ``https://api.openai.com/v1``; sin proxies del entorno, sin redirecciones, con
  *timeout*. Los errores son códigos fijos: nunca la clave, el prompt ni la respuesta.
"""

from __future__ import annotations

import json
import time
from collections.abc import Mapping
from typing import Any

import httpx
from pydantic import ValidationError

from ai_service.llm.budget import ModelPrice
from ai_service.llm.provider import (
    Entities,
    ExplainOutput,
    InterpretOutput,
    LlmRequest,
    LlmResponse,
)

OPENAI_BASE_URL = "https://api.openai.com/v1"
RESPONSES_PATH = "/responses"
MAX_RESPONSE_BYTES = 256 * 1024
REASONING_EFFORTS = frozenset({"minimal", "low", "medium", "high"})

INTERPRET_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "intencion": {"type": "string", "enum": ["consulta_financiera", "seguimiento", "escritura", "fuera_de_dominio"]},
        "cuenta": {"type": ["string", "null"]},
        "indicador": {"type": ["string", "null"]},
        "necesita_aclaracion": {"type": "boolean"},
    },
    "required": ["intencion", "cuenta", "indicador", "necesita_aclaracion"],
}
EXPLAIN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {"texto": {"type": "string"}},
    "required": ["texto"],
}

INTERPRET_INSTRUCTIONS = """Eres el intérprete del asistente financiero de SOLO LECTURA del ERP de una pollería en Perú.
Recibes un JSON con el mensaje del usuario, sus mensajes previos y el contexto de pantalla. Responde solo con el JSON del esquema.
- intencion: "consulta_financiera" si pregunta por saldos o movimientos contables; "seguimiento" si continúa una consulta previa sin repetir la cuenta; "escritura" si pide registrar, modificar, anular o eliminar algo; "fuera_de_dominio" para cualquier otro tema.
- cuenta: código numérico de la cuenta contable solo si el usuario lo escribe o si coincide con este catálogo: {catalogo}. Si no, null. No inventes códigos.
- indicador: null, salvo que pida un indicador financiero con nombre propio (por ejemplo, liquidez); en ese caso su nombre corto.
- necesita_aclaracion: true si la consulta financiera no permite identificar la cuenta.
No calcules, estimes ni menciones importes. Las fechas y períodos los resuelve el sistema."""

EXPLAIN_INSTRUCTIONS = """Redactas en español la respuesta del asistente financiero de un ERP para personas SIN conocimientos de contabilidad.
Recibes la intención, el período, el nombre de la cuenta (si existe) y una lista de marcadores. NO conoces las cifras: escribe cada cifra solo como su marcador entre llaves dobles, por ejemplo {{c1}}.
Significado: c1 = saldo NETO de los movimientos del período (NO es el saldo final de la cuenta: no incluye saldos anteriores); c2 = total del debe; c3 = total del haber.
Reglas:
- Una sola oración breve y natural que empiece por el resultado. Ejemplo: "Durante septiembre de 2026, los movimientos de Caja tuvieron un saldo neto de {{c1}}."
- Nunca digas "saldo final" ni "saldo de la cuenta" para c1.
- Si el período es un mes completo, escríbelo como "septiembre de 2026"; si no, como "del dd/mm/aaaa al dd/mm/aaaa".
- Usa cada marcador recibido exactamente una vez y no inventes otros.
- No escribas números (salvo años y fechas), montos, monedas ni porcentajes. Sin tecnicismos ni conclusiones que no se deduzcan del resultado."""


class OpenAiProviderError(Exception):
    """Fallo del proveedor con código fijo; el ``ModelGateway`` lo convierte en ``ModelUnavailable``."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class OpenAiResponsesProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        price: ModelPrice,
        account_catalog: Mapping[str, str],
        reasoning_effort: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if reasoning_effort is not None and reasoning_effort not in REASONING_EFFORTS:
            raise ValueError("Esfuerzo de razonamiento no válido.")
        self.model = model
        self._api_key = api_key
        self._price = price
        self._catalog = ", ".join(f"{name}={code}" for name, code in sorted(account_catalog.items())) or "(vacío)"
        self._reasoning_effort = reasoning_effort
        self._client = httpx.Client(
            base_url=OPENAI_BASE_URL, transport=transport, trust_env=False, follow_redirects=False
        )

    def __repr__(self) -> str:
        return f"OpenAiResponsesProvider(model={self.model!r}, api_key='***')"

    def close(self) -> None:
        self._client.close()

    # ----------------------------------------------------------------- LlmProvider
    def complete(self, request: LlmRequest) -> LlmResponse:
        task = request.entrada.tarea
        body: dict[str, Any] = {
            "model": self.model,
            "instructions": INTERPRET_INSTRUCTIONS.format(catalogo=self._catalog) if task == "interpretar" else EXPLAIN_INSTRUCTIONS,
            "input": request.entrada.model_dump_json(exclude={"tarea"}),
            "max_output_tokens": request.max_tokens_salida,
            "store": False,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "interpretacion" if task == "interpretar" else "explicacion",
                    "schema": INTERPRET_SCHEMA if task == "interpretar" else EXPLAIN_SCHEMA,
                    "strict": True,
                }
            },
        }
        if self._reasoning_effort:
            body["reasoning"] = {"effort": self._reasoning_effort}

        started = time.perf_counter()
        data = self._post(body, timeout_s=request.timeout_ms / 1000)
        latency_ms = int((time.perf_counter() - started) * 1000)

        if data.get("status") != "completed":
            raise OpenAiProviderError("INCOMPLETE_RESPONSE")
        text = self._output_text(data)
        usage = data.get("usage") or {}
        input_tokens, output_tokens = usage.get("input_tokens"), usage.get("output_tokens")
        if not isinstance(input_tokens, int) or not isinstance(output_tokens, int) or input_tokens < 0 or output_tokens < 0:
            raise OpenAiProviderError("MISSING_USAGE")

        try:
            payload = json.loads(text)
            salida = self._to_output(task, payload)
            return LlmResponse(
                id_traza=request.id_traza,
                salida=salida,
                tokens_entrada=input_tokens,
                tokens_salida=output_tokens,
                modelo=self.model,
                version=str(data.get("model") or self.model)[:80],
                latencia_ms=latency_ms,
                costo_estimado=self._price.cost(input_tokens, output_tokens),
            )
        except (ValueError, ValidationError):
            raise OpenAiProviderError("INVALID_STRUCTURED_OUTPUT") from None

    # ----------------------------------------------------------------- detalles
    def _post(self, body: dict[str, Any], *, timeout_s: float) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        try:
            with self._client.stream(
                "POST", RESPONSES_PATH, content=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                headers=headers, timeout=httpx.Timeout(timeout_s, connect=min(5.0, timeout_s)),
            ) as response:
                raw = bytearray()
                for chunk in response.iter_bytes():
                    raw += chunk
                    if len(raw) > MAX_RESPONSE_BYTES:
                        raise OpenAiProviderError("RESPONSE_TOO_LARGE")
                status = response.status_code
        except httpx.TimeoutException:
            raise OpenAiProviderError("TIMEOUT") from None
        except httpx.HTTPError:
            raise OpenAiProviderError("CONNECTION_FAILED") from None
        if status != 200:
            code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "MODEL_NOT_FOUND", 429: "RATE_LIMITED_OR_NO_CREDIT"}
            raise OpenAiProviderError(code.get(status, "HTTP_ERROR_STATUS"))
        try:
            data = json.loads(bytes(raw))
        except ValueError:
            raise OpenAiProviderError("INVALID_RESPONSE") from None
        if not isinstance(data, dict):
            raise OpenAiProviderError("INVALID_RESPONSE")
        return data

    @staticmethod
    def _output_text(data: Mapping[str, Any]) -> str:
        texts, refused = [], False
        for item in data.get("output") or []:
            if not isinstance(item, dict) or item.get("type") != "message":
                continue
            for part in item.get("content") or []:
                if isinstance(part, dict) and part.get("type") == "output_text" and isinstance(part.get("text"), str):
                    texts.append(part["text"])
                elif isinstance(part, dict) and part.get("type") == "refusal":
                    refused = True
        if refused:
            raise OpenAiProviderError("REFUSAL")
        if len(texts) != 1:
            raise OpenAiProviderError("INVALID_RESPONSE")
        return texts[0]

    @staticmethod
    def _to_output(task: str, payload: Any) -> InterpretOutput | ExplainOutput:
        if not isinstance(payload, dict):
            raise ValueError("Salida no es un objeto.")
        if task == "interpretar":
            if set(payload) != set(INTERPRET_SCHEMA["required"]):
                raise ValueError("Campos inesperados.")
            return InterpretOutput(
                tarea="interpretar",
                intencion=payload["intencion"],
                entidades=Entities(cuenta=payload["cuenta"], indicador=payload["indicador"]),
                necesita_aclaracion=payload["necesita_aclaracion"],
            )
        if set(payload) != {"texto"}:
            raise ValueError("Campos inesperados.")
        return ExplainOutput(tarea="explicar", texto=payload["texto"])
