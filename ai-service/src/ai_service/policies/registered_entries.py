"""P-4: los cálculos financieros solo usan asientos **registrados** (``journal_entry.status = TRUE``).

Significado verificado en el módulo contable del ERP (sin modificarlo): ``status = true`` es
"Registrado" y ``status = false`` es "Anulado" (spec 002, ``app/api/journal-entries/route.ts``). El
Balance General y el Estado de Resultados ya filtran ``status: true``; el asistente hace lo mismo.

Reglas (sobre el AST de ``sqlglot``, nunca sobre el texto):

- Toda ``SELECT`` que lea ``journal_entry_detail`` o ``journal_entry`` debe incluir
  ``journal_entry`` y, en la conjunción de nivel superior de su ``WHERE``, el predicado
  ``<alias>.status = TRUE`` para cada aparición de ``journal_entry``.
- :func:`apply_registered_entries_filter` lo **añade** de forma determinista respetando el alias que
  eligió el modelo (la condición existente queda entre paréntesis, así un ``OR`` no puede esquivarlo).
- Cualquier otra referencia a ``status`` (``= FALSE``, ``<>``, dentro de un ``OR``, en la
  proyección, sin calificar…) o un detalle sin ``journal_entry`` hace imposible garantizar la regla:
  se rechaza la consulta. No se añaden uniones por cuenta propia.
- :func:`has_registered_entries_filter` lo comprueba de nuevo justo antes de ejecutar.
"""

from __future__ import annotations

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

ENTRY_TABLE = "journal_entry"
DETAIL_TABLE = "journal_entry_detail"
STATUS_COLUMN = "status"
FINANCIAL_TABLES = frozenset({ENTRY_TABLE, DETAIL_TABLE})


class RegisteredFilterError(ValueError):
    """No se puede garantizar que la consulta use solo asientos registrados."""


def _source_tables(select: exp.Select) -> list[exp.Table]:
    sources = []
    source = select.args.get("from_")
    if source is not None:
        sources.append(source.this)
    sources.extend(join.this for join in select.args.get("joins") or [])
    return [table for table in sources if isinstance(table, exp.Table)]


def _conjuncts(select: exp.Select) -> list[exp.Expression]:
    where = select.args.get("where")
    if where is None:
        return []
    condition = where.this
    return list(condition.flatten()) if isinstance(condition, exp.And) else [condition]


def _is_status(node: exp.Expression, alias: str) -> bool:
    return isinstance(node, exp.Column) and node.name == STATUS_COLUMN and node.table == alias


def _is_registered_predicate(node: exp.Expression, alias: str) -> bool:
    if not isinstance(node, exp.EQ):
        return False
    left, right = node.this, node.expression
    return (_is_status(left, alias) and right == exp.true()) or (_is_status(right, alias) and left == exp.true())


def _check_select(select: exp.Select, *, fix: bool) -> bool:
    """Comprueba (y opcionalmente corrige) una ``SELECT``. ``True`` si lee tablas financieras."""
    tables = _source_tables(select)
    names = {table.name for table in tables}
    if not names & FINANCIAL_TABLES:
        return False
    entries = [table.alias_or_name for table in tables if table.name == ENTRY_TABLE]
    if not entries:
        raise RegisteredFilterError("Detalle de asientos sin journal_entry: no se puede filtrar por estado.")

    status_columns = [
        column for column in select.find_all(exp.Column)
        if column.name == STATUS_COLUMN and column.find_ancestor(exp.Select) is select
    ]
    conjuncts = _conjuncts(select)
    for alias in entries:
        registered = [c for c in conjuncts if _is_registered_predicate(c, alias)]
        if not registered:
            if not fix:
                raise RegisteredFilterError("Falta el filtro de asientos registrados.")
            predicate = exp.EQ(this=exp.column(STATUS_COLUMN, table=alias), expression=exp.true())
            select.where(predicate, copy=False)
            conjuncts = _conjuncts(select)
    allowed = {id(col) for c in _conjuncts(select) for alias in entries if _is_registered_predicate(c, alias) for col in c.find_all(exp.Column)}
    if any(id(column) not in allowed for column in status_columns):
        raise RegisteredFilterError("Referencia a journal_entry.status distinta del filtro de registrados.")
    return True


def _parse(sql: str) -> exp.Expression:
    try:
        tree = sqlglot.parse_one(sql, read="postgres")
    except SqlglotError as exc:
        raise RegisteredFilterError("SQL no analizable.") from exc
    if not isinstance(tree, exp.Query):
        raise RegisteredFilterError("Solo se admiten consultas.")
    return tree


def apply_registered_entries_filter(sql: str) -> str:
    """Devuelve el SQL con ``<alias>.status = TRUE`` en cada ``SELECT`` financiera, o lo rechaza."""
    tree = _parse(sql)
    financial = [_check_select(select, fix=True) for select in list(tree.find_all(exp.Select))]
    if not any(financial):
        raise RegisteredFilterError("La consulta no lee asientos contables.")
    return tree.sql(dialect="postgres")


def has_registered_entries_filter(sql: str) -> bool:
    """``True`` si toda ``SELECT`` que lee asientos filtra solo los registrados (o si no lee asientos)."""
    try:
        tree = _parse(sql)
        for select in tree.find_all(exp.Select):
            _check_select(select, fix=False)
    except RegisteredFilterError:
        return False
    return True
