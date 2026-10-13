"""Interfaz ``LlmProvider`` y contratos del Modelo 1 (T014, D-12 APROBADA).

El orquestador depende solo de :class:`LlmProvider`; cambiar de proveedor equivale a escribir un
adaptador nuevo. **En B2 no existe ningún adaptador real** ni llamadas a APIs comerciales; el
proveedor y el presupuesto siguen pendientes (P-22).

Protecciones de diseño:

- La entrada de la tarea ``explicar`` **no tiene ningún campo para cifras**: solo identificadores
  de marcador (BR-2, BR-13). Las cifras las inserta después el orquestador con los valores del
  SQL Executor o del motor financiero; la validación de marcadores contra resultados autorizados
  corresponde a T023 (B3).
- Las salidas son estructuradas y se validan con Pydantic (``extra="forbid"``, tipos estrictos).
"""

from __future__ import annotations

import re
from typing import Annotated, Literal, Protocol

from pydantic import Field, field_validator

from ai_service.http.schemas import (
    MAX_HISTORY_TURNS,
    AccountCode,
    MarkerId,
    Money,
    NonBlankMessage,
    Period,
    ScreenContext,
    StrictModel,
    TraceId,
    Turn,
)

Intent = Literal["consulta_financiera", "seguimiento", "escritura", "fuera_de_dominio"]
MARKER_IN_TEXT = re.compile(r"\{\{([^{}]*)\}\}")
MARKER_ID = re.compile(r"^c[0-9]{1,3}$")


# --------------------------------------------------------------------------- entradas


class InterpretInput(StrictModel):
    tarea: Literal["interpretar"]
    mensaje: NonBlankMessage
    historial: Annotated[list[Turn], Field(max_length=MAX_HISTORY_TURNS)] = Field(default_factory=list)
    contexto: ScreenContext | None = None


class ExplainInput(StrictModel):
    """Entrada de la explicación: **sin cifras**, solo identificadores de marcador."""

    tarea: Literal["explicar"]
    intencion: Intent
    periodo: Period | None = None
    marcadores: Annotated[list[MarkerId], Field(max_length=20)] = Field(default_factory=list)


class LlmRequest(StrictModel):
    id_traza: TraceId
    instrucciones_version: Annotated[str, Field(pattern=r"^[a-z0-9_.-]{1,40}$")]
    entrada: Annotated[InterpretInput | ExplainInput, Field(discriminator="tarea")]
    esquema_salida: Annotated[str, Field(pattern=r"^[a-z0-9_.-]{1,40}$")]
    max_tokens_entrada: Annotated[int, Field(gt=0)]
    max_tokens_salida: Annotated[int, Field(gt=0)]
    timeout_ms: Annotated[int, Field(gt=0, le=60_000)]


# --------------------------------------------------------------------------- salidas


class Entities(StrictModel):
    cuenta: AccountCode | None = None
    periodo: Period | None = None
    indicador: Annotated[str, Field(min_length=1, max_length=50)] | None = None


class InterpretOutput(StrictModel):
    tarea: Literal["interpretar"]
    intencion: Intent
    entidades: Entities = Field(default_factory=Entities)
    necesita_aclaracion: bool


class ExplainOutput(StrictModel):
    tarea: Literal["explicar"]
    texto: Annotated[str, Field(min_length=1, max_length=2000)]

    @field_validator("texto")
    @classmethod
    def _well_formed_markers(cls, value: str) -> str:
        for marker in MARKER_IN_TEXT.findall(value):
            if not MARKER_ID.match(marker):
                raise ValueError("Marcador con formato inválido en la explicación.")
        if value.count("{{") != value.count("}}"):
            raise ValueError("Marcadores desbalanceados en la explicación.")
        return value


class LlmResponse(StrictModel):
    id_traza: TraceId
    salida: Annotated[InterpretOutput | ExplainOutput, Field(discriminator="tarea")]
    tokens_entrada: Annotated[int, Field(ge=0)]
    tokens_salida: Annotated[int, Field(ge=0)]
    modelo: Annotated[str, Field(min_length=1, max_length=80)]
    version: Annotated[str, Field(min_length=1, max_length=80)]
    latencia_ms: Annotated[int, Field(ge=0)]
    costo_estimado: Money

    @field_validator("costo_estimado")
    @classmethod
    def _non_negative_cost(cls, value):  # type: ignore[no-untyped-def]
        if value < 0:
            raise ValueError("El coste estimado no puede ser negativo.")
        return value


class TaskMismatchError(ValueError):
    """La respuesta no corresponde a la tarea o a la traza solicitadas."""


def ensure_matches(request: LlmRequest, response: LlmResponse) -> None:
    """Verifica que la respuesta corresponda a la misma traza y tarea que la solicitud."""
    if request.id_traza != response.id_traza or request.entrada.tarea != response.salida.tarea:
        raise TaskMismatchError("La respuesta del Modelo 1 no corresponde a la solicitud.")


class LlmProvider(Protocol):
    """Interfaz desacoplada del proveedor del Modelo 1 (sin adaptadores reales en B2)."""

    def complete(self, request: LlmRequest) -> LlmResponse:  # pragma: no cover - interfaz
        ...
