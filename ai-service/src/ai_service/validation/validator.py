"""SQL Validator del asistente (T011, FR-017, SEC-1, SC-003).

Comprobar que el SQL empieza por ``SELECT`` **no es suficiente**. Este validador aplica, en orden:

1. Límite de tamaño del texto y **rechazo de cualquier comentario** (tokenizador de ``sqlglot``).
2. Análisis con ``sqlglot`` (dialecto ``postgres``): **exactamente una** sentencia; cualquier error
   de análisis o sentencia no soportada (``Command``) se rechaza.
3. Raíz ``SELECT`` (se rechazan DML, DDL, ``COPY``, ``GRANT`` y operaciones de conjunto).
4. **Allowlist de tipos de nodo y de funciones** sobre todo el AST: lo no listado se rechaza
   (DML dentro de ``WITH``, ``SELECT … INTO``, ``FOR UPDATE/SHARE``, CTE recursivas, funciones
   desconocidas o peligrosas, funciones de tabla, casts a ``regclass``/``oid``, ``SELECT *``,
   ``current_date``/``now()``, que usan la zona horaria del servidor y no la de Lima, BR-10).
5. Límites de complejidad verificables (nodos, joins, profundidad de subconsultas) y de
   ``LIMIT``/``OFFSET``: si falta ``LIMIT`` se añade el máximo; si lo excede, se rechaza.
6. Validación semántica contra la allowlist del rol (``semantic.check_semantics``).
7. El SQL aprobado se **regenera desde el AST validado** y se **vuelve a validar**; el Executor
   recibe ese SQL, nunca el texto original.

Los límites son constantes **provisionales** (umbrales finales: P-11). Este validador no sustituye
la credencial PostgreSQL de solo lectura (DE-3, P-16) ni los límites de ejecución (SEC-2).
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

import sqlglot
from sqlglot import exp
from sqlglot.tokens import Tokenizer

from ai_service.validation.allowlist import Allowlist
from ai_service.validation.semantic import NOT_VALIDATABLE, check_semantics

DIALECT = "postgres"

# Códigos de rechazo estructurales (los semánticos están en ``semantic``).
TOO_LONG = "TOO_LONG"
EMPTY = "EMPTY"
COMMENT = "COMMENT"
PARSE_ERROR = "PARSE_ERROR"
MULTIPLE_STATEMENTS = "MULTIPLE_STATEMENTS"
COMMAND_NOT_ALLOWED = "COMMAND_NOT_ALLOWED"
WRITE_OPERATION = "WRITE_OPERATION"
NOT_SELECT = "NOT_SELECT"
SET_OPERATION = "SET_OPERATION"
LOCKING_CLAUSE = "LOCKING_CLAUSE"
SELECT_INTO = "SELECT_INTO"
RECURSIVE_CTE = "RECURSIVE_CTE"
FORBIDDEN_FUNCTION = "FORBIDDEN_FUNCTION"
FORBIDDEN_CAST = "FORBIDDEN_CAST"
FORBIDDEN_NODE = "FORBIDDEN_NODE"
STAR_NOT_ALLOWED = "STAR_NOT_ALLOWED"
TOO_COMPLEX = "TOO_COMPLEX"
INVALID_LIMIT = "INVALID_LIMIT"
LIMIT_EXCEEDED = "LIMIT_EXCEEDED"
INVALID_OFFSET = "INVALID_OFFSET"
OFFSET_EXCEEDED = "OFFSET_EXCEEDED"


def _classes(*names: str) -> tuple[type[exp.Expression], ...]:
    """Clases de ``sqlglot.exp`` existentes en la versión instalada (robusto entre versiones)."""
    return tuple(getattr(exp, name) for name in names if hasattr(exp, name))


WRITE_NODES = _classes(
    "Insert", "Update", "Delete", "Merge", "Create", "Drop", "Alter", "AlterTable",
    "TruncateTable", "Copy", "Grant", "Revoke", "Returning", "LoadData", "Set",
)
ALLOWED_FUNCTIONS = _classes(
    "Count", "Sum", "Avg", "Min", "Max", "Coalesce", "Round", "Abs",
    "Extract", "TimestampTrunc", "DateTrunc",
    # DATE(x): función pura, equivalente a CAST(x AS DATE) (ya permitido); la usa XiYanSQL para agrupar por día.
    "Date",
)
ALLOWED_NODES = _classes(
    "Select", "From", "Join", "Where", "Group", "Having", "Order", "Ordered", "Limit", "Offset",
    "Column", "Identifier", "Table", "TableAlias", "Alias", "Literal", "Null", "Boolean", "Paren",
    "Subquery", "Exists", "In", "Between", "Is", "Like", "ILike", "Not", "And", "Or",
    "EQ", "NEQ", "GT", "GTE", "LT", "LTE", "Add", "Sub", "Mul", "Div", "Neg",
    "Case", "If", "With", "CTE", "Distinct", "Cast", "DataType", "Star", "Var",
) + ALLOWED_FUNCTIONS
ALLOWED_CAST_TYPES = frozenset(
    {
        exp.DataType.Type.INT, exp.DataType.Type.BIGINT, exp.DataType.Type.SMALLINT,
        exp.DataType.Type.DECIMAL, exp.DataType.Type.TEXT, exp.DataType.Type.VARCHAR,
        exp.DataType.Type.DATE, exp.DataType.Type.TIMESTAMP, exp.DataType.Type.BOOLEAN,
    }
)
VAR_PARENTS = _classes("Extract", "TimestampTrunc", "DateTrunc")


@dataclass(frozen=True)
class ValidatorLimits:
    """Límites provisionales (los umbrales definitivos dependen de P-11)."""

    max_sql_chars: int = 4000
    max_nodes: int = 400
    max_joins: int = 4
    max_subquery_depth: int = 3
    max_limit: int = 200
    max_offset: int = 10_000


DEFAULT_LIMITS = ValidatorLimits()


@dataclass(frozen=True)
class Verdict:
    """Veredicto del validador. ``normalized_sql`` solo existe si ``approved`` es ``True``."""

    approved: bool
    reasons: tuple[str, ...]
    normalized_sql: str | None = None
    tables: frozenset[str] = frozenset()


def _reject(*reasons: str) -> Verdict:
    return Verdict(approved=False, reasons=tuple(dict.fromkeys(reasons)))


@contextmanager
def _quiet_sqlglot() -> Iterator[None]:
    """Silencia los avisos de ``sqlglot`` (p. ej. el *fallback* a ``Command``) durante el análisis."""
    logger = logging.getLogger("sqlglot")
    previous = logger.level
    logger.setLevel(logging.ERROR)
    try:
        yield
    finally:
        logger.setLevel(previous)


def _int_literal(node: exp.Expression | None) -> int | None:
    if not isinstance(node, exp.Literal) or node.is_string:
        return None
    try:
        value = int(str(node.this))
    except ValueError:
        return None
    return value if value >= 0 else None


def _subquery_depth(node: exp.Expression) -> int:
    depth = 0
    parent = node.parent
    while parent is not None:
        if isinstance(parent, exp.Select):
            depth += 1
        parent = parent.parent
    return depth


class SqlValidator:
    """Valida SQL candidato de solo lectura para un rol ya revalidado por el backend."""

    def __init__(self, allowlist: Allowlist, limits: ValidatorLimits = DEFAULT_LIMITS) -> None:
        self._allowlist = allowlist
        self._limits = limits

    def validate(self, sql: str, role: str) -> Verdict:
        """Devuelve el veredicto; nunca ejecuta SQL ni abre conexiones."""
        if not isinstance(sql, str) or not sql.strip():
            return _reject(EMPTY)
        if len(sql) > self._limits.max_sql_chars:
            return _reject(TOO_LONG)

        root, reasons = self._parse_single_select(sql)
        if root is None:
            return _reject(*reasons)

        reasons = self._structural_reasons(root)
        if reasons:
            return _reject(*reasons)

        semantic = check_semantics(root, self._allowlist, role)
        if semantic.reasons or semantic.tree is None:
            return _reject(*(semantic.reasons or (NOT_VALIDATABLE,)))

        tree = semantic.tree
        if tree.args.get("limit") is None:
            tree = tree.limit(self._limits.max_limit, copy=False)
        normalized = tree.sql(dialect=DIALECT)

        # Defensa: el SQL regenerado debe volver a superar las comprobaciones estructurales.
        regenerated, regen_reasons = self._parse_single_select(normalized)
        if regenerated is None or self._structural_reasons(regenerated):
            return _reject(NOT_VALIDATABLE, *regen_reasons)

        return Verdict(approved=True, reasons=(), normalized_sql=normalized, tables=semantic.tables)

    # ------------------------------------------------------------------ comprobaciones internas

    def _parse_single_select(self, sql: str) -> tuple[exp.Select | None, list[str]]:
        try:
            tokens = Tokenizer(dialect=DIALECT).tokenize(sql)
        except Exception:
            return None, [PARSE_ERROR]
        if any(token.comments for token in tokens):
            return None, [COMMENT]

        try:
            with _quiet_sqlglot():
                statements = [s for s in sqlglot.parse(sql, read=DIALECT) if s is not None]
        except Exception:
            return None, [PARSE_ERROR]

        if not statements:
            return None, [PARSE_ERROR]
        if len(statements) > 1:
            return None, [MULTIPLE_STATEMENTS]

        root = statements[0]
        if isinstance(root, exp.Command):
            return None, [COMMAND_NOT_ALLOWED]
        if isinstance(root, exp.SetOperation):
            return None, [SET_OPERATION]
        if isinstance(root, WRITE_NODES):
            return None, [WRITE_OPERATION]
        if not isinstance(root, exp.Select):
            return None, [NOT_SELECT]
        return root, []

    def _structural_reasons(self, root: exp.Select) -> list[str]:
        reasons: list[str] = []
        nodes = 0
        joins = 0
        max_depth = 0
        for node in root.walk():
            nodes += 1
            if isinstance(node, exp.Join):
                joins += 1
            if isinstance(node, exp.Select):
                max_depth = max(max_depth, _subquery_depth(node))
            reason = self._node_reason(node)
            if reason:
                reasons.append(reason)

        if (
            nodes > self._limits.max_nodes
            or joins > self._limits.max_joins
            or max_depth > self._limits.max_subquery_depth
        ):
            reasons.append(TOO_COMPLEX)

        reasons.extend(self._limit_reasons(root))
        return list(dict.fromkeys(reasons))

    @staticmethod
    def _node_reason(node: exp.Expression) -> str | None:
        if isinstance(node, WRITE_NODES):
            return WRITE_OPERATION
        if isinstance(node, exp.Command):
            return COMMAND_NOT_ALLOWED
        if isinstance(node, exp.SetOperation):
            return SET_OPERATION
        if isinstance(node, exp.Lock):
            return LOCKING_CLAUSE
        if isinstance(node, exp.Into):
            return SELECT_INTO
        if isinstance(node, exp.With) and node.args.get("recursive"):
            return RECURSIVE_CTE
        if isinstance(node, exp.ObjectIdentifier):
            return FORBIDDEN_CAST
        if isinstance(node, exp.DataType):
            return None if node.this in ALLOWED_CAST_TYPES else FORBIDDEN_CAST
        if isinstance(node, exp.Star):
            return None if isinstance(node.parent, exp.Count) else STAR_NOT_ALLOWED
        if isinstance(node, exp.Var):
            return None if isinstance(node.parent, VAR_PARENTS) else FORBIDDEN_NODE
        if isinstance(node, exp.Func) and not isinstance(node, ALLOWED_NODES):
            # CASE/IF y CAST también son ``Func`` en sqlglot; solo se rechazan las no permitidas.
            return FORBIDDEN_FUNCTION
        if not isinstance(node, ALLOWED_NODES):
            return FORBIDDEN_NODE
        return None

    def _limit_reasons(self, root: exp.Select) -> list[str]:
        reasons: list[str] = []
        limit = root.args.get("limit")
        if limit is not None:
            value = _int_literal(limit.expression) if isinstance(limit, exp.Limit) else None
            if value is None:
                reasons.append(INVALID_LIMIT)
            elif value > self._limits.max_limit:
                reasons.append(LIMIT_EXCEEDED)
        offset = root.args.get("offset")
        if offset is not None:
            value = _int_literal(offset.expression) if isinstance(offset, exp.Offset) else None
            if value is None:
                reasons.append(INVALID_OFFSET)
            elif value > self._limits.max_offset:
                reasons.append(OFFSET_EXCEEDED)
        return reasons
