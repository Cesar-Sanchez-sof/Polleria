"""Recuperación, generación de SQL, Executor y auditoría **simulados** (T020).

- :class:`KeywordRetriever`: devuelve fragmentos ficticios (metadatos, reglas, ejemplos) por
  coincidencia de palabras; sin embeddings ni Milvus.
- :class:`TemplateSqlGenerator`: genera SQL de lectura desde una plantilla con entidades ya
  validadas; puede forzarse a devolver SQL arbitrario para probar el validador.
- :class:`FixtureExecutor`: **nunca ejecuta SQL**. Solo acepta veredictos aprobados y devuelve
  filas ficticias registradas para el SQL normalizado; un SQL no registrado devuelve "sin filas".
- :class:`InMemoryAuditSink`: guarda trazas en memoria; no es un almacén de auditoría de producción.
"""

from __future__ import annotations

import copy
import re
from collections.abc import Iterable, Mapping, Sequence

from ai_service.audit.record import AuditRecord
from ai_service.http.schemas import Period
from ai_service.orchestrator.ports import Fragment, QueryPlan, Row, SqlCandidate, SqlValidator
from ai_service.validation.validator import Verdict

_ACCOUNT_RE = re.compile(r"^[0-9]{1,10}$")
_WORD_RE = re.compile(r"\w+", re.UNICODE)

SALDO_CUENTA_TEMPLATE = (
    "SELECT c.tipo, SUM(d.debe) AS debe, SUM(d.haber) AS haber, COUNT(d.id) AS movimientos "
    "FROM cuenta_demo c "
    "JOIN detalle_asiento_demo d ON d.cuenta_codigo = c.codigo "
    "JOIN asiento_demo a ON a.id = d.asiento_id "
    "WHERE c.codigo = '{cuenta}' AND a.fecha BETWEEN '{desde}' AND '{hasta}' "
    "GROUP BY c.tipo"
)


class ExecutorRefused(Exception):
    """Se intentó ejecutar algo que no es un veredicto aprobado."""


class KeywordRetriever:
    def __init__(self, fragments: Iterable[Fragment]) -> None:
        self._fragments = list(fragments)

    def retrieve(self, query: str, k: int) -> list[Fragment]:
        words = {w.lower() for w in _WORD_RE.findall(query)}
        scored = [
            (len(words & {w.lower() for w in _WORD_RE.findall(f.contenido)}), index, f)
            for index, f in enumerate(self._fragments)
        ]
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [f for score, _, f in scored[:k] if score > 0]


class TemplateSqlGenerator:
    """Sustituto del Modelo 2: plantilla determinista (o SQL forzado en pruebas)."""

    def __init__(self, override_sql: str | None = None) -> None:
        self._override_sql = override_sql
        self.calls = 0

    @staticmethod
    def render(plan: QueryPlan) -> str:
        if plan.kind != "saldo_cuenta" or not _ACCOUNT_RE.match(plan.cuenta):
            raise ValueError("Plan no soportado por la plantilla.")
        return SALDO_CUENTA_TEMPLATE.format(
            cuenta=plan.cuenta,
            desde=plan.periodo.desde.isoformat(),
            hasta=plan.periodo.hasta.isoformat(),
        )

    def generate(self, plan: QueryPlan, fragments: Sequence[Fragment]) -> SqlCandidate:
        self.calls += 1
        sql = self._override_sql if self._override_sql is not None else self.render(plan)
        return SqlCandidate(sql=sql, kind=plan.kind)


class FixtureExecutor:
    """Executor ficticio: devuelve filas registradas; no abre conexiones ni ejecuta SQL."""

    def __init__(self) -> None:
        self._results: dict[str, list[dict[str, object]]] = {}
        self.calls = 0
        self.fail_with: Exception | None = None

    def register(self, normalized_sql: str, rows: Sequence[Mapping[str, object]]) -> None:
        self._results[normalized_sql] = [dict(row) for row in rows]

    def execute(self, verdict: Verdict) -> list[Row]:
        if not isinstance(verdict, Verdict) or not verdict.approved or not verdict.normalized_sql:
            raise ExecutorRefused("El Executor solo acepta SQL aprobado por el validador.")
        self.calls += 1
        if self.fail_with is not None:
            raise self.fail_with
        return copy.deepcopy(self._results.get(verdict.normalized_sql, []))


def build_fixture_executor(
    dataset: Iterable[Mapping[str, object]],
    validator: SqlValidator,
    role: str,
) -> FixtureExecutor:
    """Registra filas ficticias para el SQL **normalizado por el validador real** de cada caso.

    Cada entrada: ``{"cuenta", "desde", "hasta", "rows"}``. Así el Executor solo responde a SQL que
    el validador habría aprobado.
    """
    executor = FixtureExecutor()
    for entry in dataset:
        plan = QueryPlan(
            kind="saldo_cuenta",
            cuenta=str(entry["cuenta"]),
            periodo=Period.model_validate({"desde": entry["desde"], "hasta": entry["hasta"]}, strict=False),
        )
        verdict = validator.validate(TemplateSqlGenerator.render(plan), role)
        if not verdict.approved or verdict.normalized_sql is None:
            raise ValueError(f"La plantilla de prueba no supera el validador: {verdict.reasons}")
        executor.register(verdict.normalized_sql, entry["rows"])  # type: ignore[arg-type]
    return executor


class InMemoryAuditSink:
    """Almacén de trazas **en memoria** (solo simulación; ver P-10 y T020)."""

    def __init__(self) -> None:
        self.records: list[AuditRecord] = []

    def write(self, record: AuditRecord) -> None:
        self.records.append(record)
