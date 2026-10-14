"""Executor **ficticio** del modo ``xiyansql``: reconoce el patrón de saldo sobre el AST validado.

No es un motor SQL. Recibe solo un ``Verdict`` aprobado, analiza su SQL **normalizado** con
``sqlglot`` y acepta únicamente el patrón entrenado de ``saldo_cuenta``, sea cual sea el orden o los
alias que elija el modelo:

- tablas ``journal_entry_detail``, ``accounting_account`` y ``journal_entry`` unidas por
  ``accounting_account.id = journal_entry_detail.account_id`` y
  ``journal_entry.id = journal_entry_detail.entry_id`` (en cualquier orden de operandos);
- ``WHERE`` con el filtro P-4 obligatorio ``journal_entry.status = TRUE`` (asientos registrados) y
  solo conjunciones (``AND``) de ``accounting_account.code = '<código>'`` y de
  un rango de ``journal_entry.entry_date`` (``>=``/``<``, ``<=`` o ``BETWEEN``);
- proyección solo de ``id``, ``code``, ``name`` y ``type`` de la cuenta y de ``SUM(debit)`` /
  ``SUM(credit)`` del detalle, con cualquier alias; ``GROUP BY`` obligatorio.

Las filas salen del dataset ficticio para ``(código, período)`` y se devuelven con los nombres de
columna del propio SQL. Cualquier otra construcción, o un período sin datos registrados, lanza
:class:`FixtureMiss` (``503`` controlado): nunca se inventa un resultado ni un "sin datos". Las cifras
las sigue calculando el motor financiero. Nunca se ejecuta SQL ni se abre una conexión.
"""

from __future__ import annotations

import copy
from collections.abc import Iterable, Mapping
from datetime import date, timedelta
from decimal import Decimal

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

from ai_service.orchestrator.ports import Row
from ai_service.policies.registered_entries import has_registered_entries_filter
from ai_service.simulation.components import ExecutorRefused
from ai_service.validation.validator import Verdict

REFERENCE_SALDO_SQL = (
    "SELECT aa.id AS account_id, aa.code, aa.name, aa.type, SUM(jed.debit) AS total_debit, "
    "SUM(jed.credit) AS total_credit FROM journal_entry_detail jed "
    "JOIN accounting_account aa ON aa.id = jed.account_id JOIN journal_entry je ON je.id = jed.entry_id "
    "WHERE aa.code = '{cuenta}' AND je.entry_date >= DATE '{start}' AND je.entry_date < DATE '{end}' "
    "GROUP BY aa.id, aa.code, aa.name, aa.type ORDER BY aa.code;"
)
ACCOUNT, ENTRY, DETAIL = "accounting_account", "journal_entry", "journal_entry_detail"
REQUIRED_JOINS = frozenset(
    {frozenset({(ACCOUNT, "id"), (DETAIL, "account_id")}), frozenset({(ENTRY, "id"), (DETAIL, "entry_id")})}
)
# Origen de cada columna proyectable → clave de la fila ficticia.
ACCOUNT_COLUMNS = {"id": "account_id", "code": "code", "name": "name", "type": "type"}
SUM_COLUMNS = {"debit": "total_debit", "credit": "total_credit"}
CENT = Decimal("0.01")


class FixtureMiss(LookupError):
    """El SQL aprobado no corresponde al patrón soportado o no hay datos ficticios para su período."""


class _Unsupported(Exception):
    pass


def _date_literal(node: exp.Expression) -> date:
    if isinstance(node, exp.Cast) and node.to.this == exp.DataType.Type.DATE:
        node = node.this
    if isinstance(node, exp.Literal) and node.is_string:
        try:
            return date.fromisoformat(node.this)
        except ValueError:
            pass
    raise _Unsupported()


def _leaves(node: exp.Expression) -> list[exp.Expression]:
    """Conjunción de nivel superior, entrando en paréntesis que solo contienen ``AND``."""
    if isinstance(node, exp.Paren):
        return _leaves(node.this)
    if isinstance(node, exp.And):
        return _leaves(node.this) + _leaves(node.expression)
    return [node]


class SaldoFixtureExecutor:
    """Datos ficticios por movimientos: ``accounts`` (metadatos de cuenta) y ``dataset`` con
    ``movimientos`` de asientos registrados o anulados. Solo responde a SQL con el filtro P-4 y solo
    totaliza los movimientos de asientos registrados."""

    def __init__(self, dataset: Iterable[Mapping[str, object]], accounts: Mapping[str, Mapping[str, object]]) -> None:
        self._accounts = {code: dict(info) for code, info in accounts.items()}
        self._data: dict[tuple[str, date, date], list[Mapping[str, object]]] = {}
        for entry in dataset:
            start = date.fromisoformat(str(entry["desde"]))
            end_exclusive = date.fromisoformat(str(entry["hasta"])) + timedelta(days=1)
            self._data[(str(entry["cuenta"]), start, end_exclusive)] = list(entry["movimientos"])  # type: ignore[call-overload]
        self.calls = 0

    def execute(self, verdict: Verdict) -> list[Row]:
        if not isinstance(verdict, Verdict) or not verdict.approved or not verdict.normalized_sql:
            raise ExecutorRefused("El Executor solo acepta SQL aprobado por el validador.")
        self.calls += 1
        if not has_registered_entries_filter(verdict.normalized_sql):
            raise FixtureMiss("La consulta no garantiza el filtro de asientos registrados (P-4).")
        try:
            code, start, end_exclusive, outputs = self._analyze(verdict.normalized_sql)
        except (_Unsupported, SqlglotError, AttributeError) as exc:
            raise FixtureMiss("Consulta fuera del patrón soportado por los datos ficticios.") from exc
        movements = self._data.get((code, start, end_exclusive))
        if movements is None or code not in self._accounts:
            raise FixtureMiss("Sin datos ficticios registrados para ese período.")
        registered = [m for m in movements if m["registrado"] is True]
        if not registered:
            return []  # JOIN internos + GROUP BY: sin movimientos registrados no hay fila
        row = dict(self._accounts[code])
        row["total_debit"] = str(sum((Decimal(str(m["debe"])) for m in registered), Decimal("0")).quantize(CENT))
        row["total_credit"] = str(sum((Decimal(str(m["haber"])) for m in registered), Decimal("0")).quantize(CENT))
        return [{name: copy.deepcopy(row[source]) for name, source in outputs}]

    # ----------------------------------------------------------------- análisis del AST validado
    def _analyze(self, sql: str) -> tuple[str, date, date, list[tuple[str, str]]]:
        tree = sqlglot.parse_one(sql, read="postgres")
        if not isinstance(tree, exp.Select) or tree.args.get("with_") or tree.args.get("distinct") or tree.args.get("having"):
            raise _Unsupported()
        if tree.find(exp.Subquery, exp.Union, exp.Window) or tree.args.get("group") is None:
            raise _Unsupported()

        source = tree.args.get("from_")
        joins = tree.args.get("joins") or []
        tables = [source.this] + [join.this for join in joins]
        if not all(isinstance(t, exp.Table) for t in tables):
            raise _Unsupported()
        alias_to_table = {t.alias_or_name: t.name for t in tables}
        if sorted(alias_to_table.values()) != sorted({ACCOUNT, ENTRY, DETAIL}) or len(tables) != 3:
            raise _Unsupported()

        def column(node: exp.Expression) -> tuple[str, str]:
            if not isinstance(node, exp.Column) or node.table not in alias_to_table:
                raise _Unsupported()
            return alias_to_table[node.table], node.name

        found_joins = set()
        for join in joins:
            if join.side or join.kind not in ("", "INNER"):
                raise _Unsupported()
            condition = join.args.get("on")
            if not isinstance(condition, exp.EQ):
                raise _Unsupported()
            found_joins.add(frozenset({column(condition.this), column(condition.expression)}))
        if found_joins != REQUIRED_JOINS:
            raise _Unsupported()

        code = start = end_exclusive = None
        registered_filter = False
        where = tree.args.get("where")
        if where is None:
            raise _Unsupported()
        for predicate in _leaves(where.this):
            if isinstance(predicate, exp.EQ) and column(predicate.this) == (ENTRY, "status"):
                if registered_filter or predicate.expression != exp.true():
                    raise _Unsupported()
                registered_filter = True
            elif isinstance(predicate, exp.EQ) and column(predicate.this) == (ACCOUNT, "code"):
                literal = predicate.expression
                if code is not None or not (isinstance(literal, exp.Literal) and literal.is_string):
                    raise _Unsupported()
                code = literal.this
            elif isinstance(predicate, exp.Between) and column(predicate.this) == (ENTRY, "entry_date"):
                if start is not None or end_exclusive is not None:
                    raise _Unsupported()
                start = _date_literal(predicate.args["low"])
                end_exclusive = _date_literal(predicate.args["high"]) + timedelta(days=1)
            elif isinstance(predicate, exp.GTE) and column(predicate.this) == (ENTRY, "entry_date") and start is None:
                start = _date_literal(predicate.expression)
            elif isinstance(predicate, exp.LT) and column(predicate.this) == (ENTRY, "entry_date") and end_exclusive is None:
                end_exclusive = _date_literal(predicate.expression)
            elif isinstance(predicate, exp.LTE) and column(predicate.this) == (ENTRY, "entry_date") and end_exclusive is None:
                end_exclusive = _date_literal(predicate.expression) + timedelta(days=1)
            else:
                raise _Unsupported()
        if code is None or start is None or end_exclusive is None or not registered_filter:
            raise _Unsupported()

        outputs: list[tuple[str, str]] = []
        for projection in tree.expressions:
            name = projection.alias_or_name
            node = projection.this if isinstance(projection, exp.Alias) else projection
            if isinstance(node, exp.Sum):
                table, col = column(node.this)
                if table != DETAIL or col not in SUM_COLUMNS:
                    raise _Unsupported()
                outputs.append((name, SUM_COLUMNS[col]))
            else:
                table, col = column(node)
                if table != ACCOUNT or col not in ACCOUNT_COLUMNS:
                    raise _Unsupported()
                outputs.append((name, ACCOUNT_COLUMNS[col]))
        if len({name for name, _ in outputs}) != len(outputs):
            raise _Unsupported()
        return code, start, end_exclusive, outputs
