"""Registro de auditoría minimizado (T015, FR-022, SEC-8, SC-011).

``AuditRecord`` solo admite los campos mínimos para la trazabilidad. Por diseño **no tiene campos**
para prompts, preguntas, historial, respuestas, filas de resultado, cifras, credenciales ni el
identificador del usuario en claro (se guarda un seudónimo HMAC). ``extra="forbid"`` rechaza
cualquier campo adicional y los validadores rechazan literales en la plantilla SQL y patrones
sensibles en los textos.

No es un sistema de auditoría de producción completo (ver ``ai_service.audit``).
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

import sqlglot
from pydantic import AwareDatetime, Field, field_validator
from sqlglot import exp

from ai_service.audit.masking import (
    HMAC_PREFIX,
    AuditConfigError,
    AuditMaskingError,
    Pseudonymizer,
    contains_sensitive,
    mask_parameters,
    parametrize_sql,
    redact_text,
)
from ai_service.http.schemas import ResponseState, StrictModel, TraceId
from ai_service.llm.provider import Intent

HmacDigest = Annotated[str, Field(pattern=rf"^{HMAC_PREFIX}[0-9a-f]{{64}}$")]
ReasonCode = Annotated[str, Field(pattern=r"^[A-Z_]{3,40}$")]
TEMPLATE_UNAVAILABLE = "PLANTILLA_NO_DISPONIBLE"
MAX_DIAGNOSTIC_CHARS = 300


class MaskedParameter(StrictModel):
    tipo: Literal["text", "number"]
    hmac: HmacDigest


class AuditRecord(StrictModel):
    """Traza mínima de una consulta del asistente."""

    id_traza: TraceId
    usuario_seudonimo: HmacDigest
    registrado_en: AwareDatetime
    estado: ResponseState
    intencion: Intent | None = None
    codigos_rechazo: Annotated[list[ReasonCode], Field(max_length=20)] = Field(default_factory=list)
    plantilla_sql: Annotated[str, Field(min_length=1, max_length=4000)] | None = None
    parametros: Annotated[list[MaskedParameter], Field(max_length=100)] = Field(default_factory=list)
    versiones: dict[Annotated[str, Field(pattern=r"^[a-z0-9_.-]{1,40}$")], Annotated[str, Field(max_length=80)]] = Field(
        default_factory=dict
    )
    duracion_ms: Annotated[int, Field(ge=0)] = 0
    filas: Annotated[int, Field(ge=0)] | None = None  # solo el número de filas, nunca su contenido
    diagnostico: Annotated[str, Field(max_length=MAX_DIAGNOSTIC_CHARS)] | None = None

    @field_validator("plantilla_sql")
    @classmethod
    def _template_without_literals(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if contains_sensitive(value):
            raise ValueError("La plantilla SQL contiene datos sensibles.")
        try:
            tree = sqlglot.parse_one(value, read="postgres")
        except Exception as exc:
            raise ValueError("La plantilla SQL no es analizable.") from exc
        if tree.find(exp.Literal) is not None:
            raise ValueError("La plantilla SQL no puede contener literales en claro.")
        return value

    @field_validator("diagnostico")
    @classmethod
    def _diagnostic_without_sensitive_data(cls, value: str | None) -> str | None:
        if value is not None and contains_sensitive(value):
            raise ValueError("El diagnóstico contiene datos sensibles; debe redactarse antes.")
        return value

    @field_validator("versiones")
    @classmethod
    def _versions_without_sensitive_data(cls, value: dict[str, str]) -> dict[str, str]:
        if any(contains_sensitive(v) for v in value.values()):
            raise ValueError("Las versiones contienen datos sensibles.")
        return value


def build_audit_record(
    *,
    id_traza: str,
    user_id: int,
    estado: str,
    registrado_en: datetime,
    pseudonymizer: Pseudonymizer | None,
    intencion: str | None = None,
    codigos_rechazo: tuple[str, ...] = (),
    normalized_sql: str | None = None,
    versiones: dict[str, str] | None = None,
    duracion_ms: int = 0,
    filas: int | None = None,
    diagnostico: str | None = None,
) -> AuditRecord:
    """Construye una traza minimizada.

    - Sin seudonimizador (clave HMAC) → :class:`AuditConfigError` (fallo seguro).
    - El usuario se registra como seudónimo HMAC, nunca en claro.
    - El SQL se registra solo como plantilla parametrizada con parámetros ``tipo + HMAC``. Si no se
      puede parametrizar, **no se guarda** y se añade el código :data:`TEMPLATE_UNAVAILABLE`.
    - El diagnóstico se redacta y se recorta antes de registrarlo.
    """
    if pseudonymizer is None:
        raise AuditConfigError("Falta la clave de auditoría; no se generan trazas.")

    codes = list(codigos_rechazo)
    template: str | None = None
    masked: tuple[tuple[str, str], ...] = ()
    if normalized_sql is not None:
        try:
            parametrized = parametrize_sql(normalized_sql)
            template = parametrized.template
            masked = mask_parameters(parametrized.parameters, pseudonymizer)
        except AuditMaskingError:
            codes.append(TEMPLATE_UNAVAILABLE)

    safe_diagnostic = None
    if diagnostico:
        safe_diagnostic = redact_text(diagnostico)[:MAX_DIAGNOSTIC_CHARS]

    return AuditRecord(
        id_traza=id_traza,
        usuario_seudonimo=pseudonymizer.digest(str(user_id), context="usuario"),
        registrado_en=registrado_en,
        estado=estado,  # type: ignore[arg-type]
        intencion=intencion,  # type: ignore[arg-type]
        codigos_rechazo=codes,
        plantilla_sql=template,
        parametros=[MaskedParameter(tipo=kind, hmac=digest) for kind, digest in masked],  # type: ignore[arg-type]
        versiones=dict(versiones or {}),
        duracion_ms=duracion_ms,
        filas=filas,
        diagnostico=safe_diagnostic,
    )
