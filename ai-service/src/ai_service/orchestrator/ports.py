"""Interfaces desacopladas del orquestador (T020, AR-1).

Cada interfaz tiene una implementación simulada en B3 y podrá sustituirse por una real sin tocar
el pipeline. Reglas de separación (AR-1):

- Ningún modelo accede a la base de datos: solo :class:`SqlExecutor` recibe SQL, y únicamente un
  :class:`~ai_service.validation.validator.Verdict` **aprobado**.
- Ningún modelo calcula cifras: solo :class:`FinanceEngine` produce
  :class:`~ai_service.http.schemas.Figure`.
- La interfaz del Modelo 1 es :class:`~ai_service.llm.provider.LlmProvider` (D-12), reutilizada.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Literal, Protocol

from ai_service.audit.record import AuditRecord
from ai_service.http.schemas import Figure, Period, QueryRequest
from ai_service.llm.provider import Intent, LlmProvider
from ai_service.validation.validator import Verdict

__all__ = [
    "AuditSink",
    "Explainer",
    "FinanceEngine",
    "FinanceResult",
    "Fragment",
    "Interpretation",
    "Interpreter",
    "LlmProvider",
    "QueryPlan",
    "Retriever",
    "Row",
    "SqlCandidate",
    "SqlExecutor",
    "SqlGenerator",
    "SqlValidator",
]

Row = Mapping[str, object]


@dataclass(frozen=True)
class Interpretation:
    """Resultado de la interpretación (Modelo 1 o sustituto), aún **no confiable**."""

    intencion: Intent
    cuenta: str | None = None
    indicador: str | None = None
    necesita_aclaracion: bool = False


@dataclass(frozen=True)
class Fragment:
    """Fragmento recuperado por RAG: solo metadatos, reglas o ejemplos ficticios."""

    tipo: Literal["esquema", "relacion", "regla", "ejemplo"]
    fuente: str
    version: str
    contenido: str


@dataclass(frozen=True)
class QueryPlan:
    """Consulta ya resuelta y revalidada por el backend (BR-12)."""

    kind: Literal["saldo_cuenta"]
    cuenta: str
    periodo: Period


@dataclass(frozen=True)
class SqlCandidate:
    sql: str
    kind: str


@dataclass(frozen=True)
class FinanceResult:
    """Cifras verificadas o ausencia de datos (BR-5)."""

    figures: tuple[Figure, ...] = ()
    no_data: bool = False
    notes: tuple[str, ...] = field(default_factory=tuple)


class Interpreter(Protocol):
    def interpret(self, request: QueryRequest) -> Interpretation: ...


class Retriever(Protocol):
    def retrieve(self, query: str, k: int) -> list[Fragment]: ...


class SqlGenerator(Protocol):
    def generate(self, plan: QueryPlan, fragments: Sequence[Fragment]) -> SqlCandidate: ...


class SqlValidator(Protocol):
    """Implementación real: :class:`ai_service.validation.validator.SqlValidator` (B2)."""

    def validate(self, sql: str, role: str) -> Verdict: ...


class SqlExecutor(Protocol):
    """Solo acepta veredictos aprobados; nunca recibe SQL sin validar."""

    def execute(self, verdict: Verdict) -> list[Row]: ...


class FinanceEngine(Protocol):
    def compute(self, plan: QueryPlan, rows: Sequence[Row]) -> FinanceResult: ...


class Explainer(Protocol):
    """Devuelve el texto final con las cifras ya verificadas e insertadas (T023)."""

    def explain(
        self,
        *,
        trace_id: str,
        intencion: Intent,
        periodo: Period | None,
        figures: Sequence[Figure],
    ) -> str: ...


class AuditSink(Protocol):
    def write(self, record: AuditRecord) -> None: ...
