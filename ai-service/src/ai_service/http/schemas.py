"""Esquemas Pydantic del contrato CT-B (proxy del ERP → servicio de IA) (T014, D-12).

Reglas comunes:

- ``extra="forbid"``: cualquier campo inesperado se rechaza.
- ``strict=True``: sin conversiones implícitas de tipos (p. ej. ``"1"`` no es un entero). Los
  payloads del cable se validan con ``model_validate_json``, donde las fechas ISO son válidas.
- Importes con :data:`Money`, que reutiliza ``finance.money.to_decimal`` (B1): se aceptan como
  texto o ``Decimal``; los números JSON en coma flotante se rechazan.
- La identidad y el rol del usuario los añade el proxy desde la sesión del servidor; el historial
  y el contexto se tratan como datos **no confiables** (BR-12).

Límites marcados como *provisionales* dependen de P-11.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from ai_service.finance.money import to_decimal

# --------------------------------------------------------------------------- tipos comunes

Money = Annotated[Decimal, BeforeValidator(to_decimal)]
"""Importe exacto; rechaza ``float`` (reutiliza la regla de B1)."""

TraceId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")]
MarkerId = Annotated[str, Field(pattern=r"^c[0-9]{1,3}$")]
AccountCode = Annotated[str, Field(pattern=r"^[0-9]{1,10}$")]

MAX_MESSAGE_CHARS = 1000  # provisional (P-11)
MAX_HISTORY_TURNS = 10  # provisional (P-11)
MAX_TEXT_CHARS = 4000  # provisional (P-11)

AuthorizedRoute = Literal[
    "/accounting/entries",
    "/accounting/journal",
    "/accounting/accounts",
    "/accounting/ledger",
    "/accounting/balance",
    "/accounting/periods",
]
"""Lista explícita de pantallas habilitadas (P-2, CONFIRMADA)."""

ResponseState = Literal[
    "respondida",
    "sin_datos",
    "requiere_aclaracion",
    "solo_lectura",
    "fuera_de_dominio",
    "no_resoluble",
]


class StrictModel(BaseModel):
    """Base de todos los contratos: sin campos extra, tipos estrictos e inmutables."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


def _not_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("El texto no puede estar vacío.")
    return value


NonBlankMessage = Annotated[str, Field(min_length=1, max_length=MAX_MESSAGE_CHARS)]


# --------------------------------------------------------------------------- CT-B request


class User(StrictModel):
    """Identidad tomada **siempre** de la sesión del servidor (nunca del navegador)."""

    id: Annotated[int, Field(gt=0)]
    rol: Annotated[str, Field(min_length=1, max_length=50)]


class Period(StrictModel):
    desde: date
    hasta: date

    @model_validator(mode="after")
    def _ordered(self) -> "Period":
        if self.desde > self.hasta:
            raise ValueError("La fecha inicial no puede ser posterior a la fecha final.")
        return self


class Filters(StrictModel):
    codigo: AccountCode | None = None
    desde: date | None = None
    hasta: date | None = None

    @model_validator(mode="after")
    def _ordered(self) -> "Filters":
        if self.desde and self.hasta and self.desde > self.hasta:
            raise ValueError("La fecha inicial no puede ser posterior a la fecha final.")
        return self


class ScreenContext(StrictModel):
    ruta: AuthorizedRoute
    filtros: Filters = Field(default_factory=Filters)


class Turn(StrictModel):
    rol: Literal["usuario", "asistente"]
    texto: Annotated[str, Field(min_length=1, max_length=MAX_TEXT_CHARS)]


class QueryRequest(StrictModel):
    """CT-B: petición del proxy del ERP al servicio de IA."""

    id_traza: TraceId
    usuario: User
    mensaje: NonBlankMessage
    contexto: ScreenContext | None = None
    historial: Annotated[list[Turn], Field(max_length=MAX_HISTORY_TURNS)] = Field(default_factory=list)
    fecha_referencia_lima: date

    @model_validator(mode="after")
    def _message_not_blank(self) -> "QueryRequest":
        _not_blank(self.mensaje)
        return self


# --------------------------------------------------------------------------- CT-B response


class Figure(StrictModel):
    """Cifra verificada, producida solo por el SQL Executor o el motor financiero (BR-2)."""

    marcador: MarkerId
    valor: Money
    unidad: Literal["PEN", "%"]
    origen: Literal["executor", "motor"]


class Evidence(StrictModel):
    """Evidencia mínima de una consulta (sin parámetros en claro ni filas)."""

    plantilla_sql: Annotated[str, Field(min_length=1, max_length=4000)]
    parametros: Annotated[int, Field(ge=0)]
    filas: Annotated[int, Field(ge=0)]
    duracion_ms: Annotated[int, Field(ge=0)]


class FigureLabel(StrictModel):
    """Etiqueta en lenguaje sencillo de una cifra verificada (la fija el backend, nunca un modelo)."""

    marcador: MarkerId
    etiqueta: Annotated[str, Field(min_length=1, max_length=80)]


class Detail(StrictModel):
    """Detalle opcional del cálculo, generado solo con datos verificados del backend.

    ``cuenta`` y ``periodo`` provienen del ``QueryPlan`` revalidado; ``etiquetas`` describen las
    cifras de ``QueryResponse.cifras`` (mismos marcadores). ``nota`` aclara el alcance del cálculo.
    """

    tipo: Literal["saldo_cuenta"]
    cuenta: AccountCode
    cuenta_nombre: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    periodo: Period
    etiquetas: Annotated[list[FigureLabel], Field(min_length=1, max_length=20)]
    nota: Annotated[str, Field(max_length=200)] | None = None


class PublicResponse(StrictModel):
    """Lo único que el proxy reenvía al navegador (CT-A)."""

    estado: ResponseState
    texto: Annotated[str, Field(max_length=MAX_TEXT_CHARS)]
    id_traza: TraceId


class QueryResponse(StrictModel):
    """CT-B: respuesta del servicio de IA al proxy del ERP."""

    id_traza: TraceId
    estado: ResponseState
    texto: Annotated[str, Field(max_length=MAX_TEXT_CHARS)]
    cifras: list[Figure] = Field(default_factory=list)
    evidencias: list[Evidence] = Field(default_factory=list)
    versiones: dict[Annotated[str, Field(pattern=r"^[a-z0-9_.-]{1,40}$")], Annotated[str, Field(max_length=80)]] = Field(
        default_factory=dict
    )
    detalle: Detail | None = None

    @model_validator(mode="after")
    def _unique_markers(self) -> "QueryResponse":
        markers = [figure.marcador for figure in self.cifras]
        if len(markers) != len(set(markers)):
            raise ValueError("Los marcadores de las cifras deben ser únicos.")
        if self.detalle is not None:
            labelled = [label.marcador for label in self.detalle.etiquetas]
            if self.estado != "respondida" or sorted(labelled) != sorted(markers):
                raise ValueError("El detalle solo describe las cifras de una respuesta respondida.")
        return self

    def public_view(self) -> PublicResponse:
        """Vista mínima para el navegador: estado, texto e id de traza."""
        return PublicResponse(estado=self.estado, texto=self.texto, id_traza=self.id_traza)
