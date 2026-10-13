"""Proveedor simulado del Modelo 1 (T020, SC-016).

``MockLlmProvider`` implementa :class:`~ai_service.llm.provider.LlmProvider` con reglas
deterministas y **sin red**. Además actúa como tercera línea de BR-13 en pruebas (después del
prefiltro y del control de ``ModelGateway``): si la entrada que recibe contiene datos sensibles
(DNI, RUC, correos, credenciales o importes), lanza :class:`SensitiveDataLeak`.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from decimal import Decimal

from ai_service.audit.masking import contains_sensitive
from ai_service.orchestrator.security import SecurityIncident
from ai_service.llm.provider import (
    Entities,
    ExplainOutput,
    InterpretOutput,
    LlmRequest,
    LlmResponse,
)

_WRITE_RE = re.compile(r"\b(?:registr|anul|elimin|modific|borr)\w*", re.IGNORECASE)
_CODE_RE = re.compile(r"\bcuenta\s+(\d{2,6})\b", re.IGNORECASE)


class SensitiveDataLeak(SecurityIncident):
    """El proveedor simulado recibió datos sensibles (violación de BR-13).

    Es un :class:`SecurityIncident` (no un ``AssertionError``): el pipeline lo trata como
    incidente de seguridad y detiene el procesamiento.
    """

    code = "PROVIDER_SENSITIVE_DATA"


class MockLlmProvider:
    """Proveedor simulado y determinista; registra cada solicitud recibida."""

    model = "modelo-simulado"
    version = "sim-1"

    def __init__(
        self,
        account_keywords: Mapping[str, str],
        *,
        interpret_override: Callable[[LlmRequest], InterpretOutput] | None = None,
        explain_override: Callable[[LlmRequest], str] | None = None,
        fail_with: Exception | None = None,
        wrong_trace: bool = False,
    ) -> None:
        self._keywords = {k.lower(): v for k, v in account_keywords.items()}
        self._interpret_override = interpret_override
        self._explain_override = explain_override
        self._fail_with = fail_with
        self._wrong_trace = wrong_trace
        self.calls: list[LlmRequest] = []

    # ----------------------------------------------------------------- LlmProvider
    def complete(self, request: LlmRequest) -> LlmResponse:
        self.calls.append(request)
        payload = request.entrada.model_dump_json()
        if contains_sensitive(payload):
            raise SensitiveDataLeak("El proveedor simulado recibió datos sensibles (BR-13).")
        if self._fail_with is not None:
            raise self._fail_with

        if request.entrada.tarea == "interpretar":
            salida = (
                self._interpret_override(request)
                if self._interpret_override
                else self._interpret(request)
            )
        else:
            texto = self._explain_override(request) if self._explain_override else self._explain(request)
            salida = ExplainOutput(tarea="explicar", texto=texto)

        return LlmResponse(
            id_traza="traza-incorrecta" if self._wrong_trace else request.id_traza,
            salida=salida,
            tokens_entrada=max(1, len(payload) // 4),
            tokens_salida=60,
            modelo=self.model,
            version=self.version,
            latencia_ms=5,
            costo_estimado=Decimal("0"),
        )

    # ----------------------------------------------------------------- reglas
    def _find_account(self, text: str) -> str | None:
        match = _CODE_RE.search(text)
        if match:
            return match.group(1)
        lowered = text.lower()
        for keyword, code in self._keywords.items():
            if re.search(rf"\b{re.escape(keyword)}\b", lowered):
                return code
        return None

    def _interpret(self, request: LlmRequest) -> InterpretOutput:
        entrada = request.entrada
        message = entrada.mensaje  # type: ignore[union-attr]
        if _WRITE_RE.search(message):
            return InterpretOutput(tarea="interpretar", intencion="escritura", necesita_aclaracion=False)

        account = self._find_account(message)
        intent = "consulta_financiera"
        if account is None:
            for turn in reversed(entrada.historial):  # type: ignore[union-attr]
                account = self._find_account(turn.texto)
                if account:
                    intent = "seguimiento"
                    break
        return InterpretOutput(
            tarea="interpretar",
            intencion=intent,  # type: ignore[arg-type]
            entidades=Entities(cuenta=account),
            necesita_aclaracion=account is None,
        )

    @staticmethod
    def _explain(request: LlmRequest) -> str:
        entrada = request.entrada
        periodo = entrada.periodo  # type: ignore[union-attr]
        rango = (
            f"entre el {periodo.desde:%d/%m/%Y} y el {periodo.hasta:%d/%m/%Y}" if periodo else "en el período"
        )
        markers = entrada.marcadores  # type: ignore[union-attr]
        if markers == ["c1", "c2", "c3"]:
            return (
                f"El saldo de la cuenta {rango} es {{{{c1}}}}: se registraron cargos (debe) por "
                "{{c2}} y abonos (haber) por {{c3}}."
            )
        return " ".join(f"{{{{{m}}}}}" for m in markers)
