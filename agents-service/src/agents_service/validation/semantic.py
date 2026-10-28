"""Validación semántica del SQL candidato (T012).

Comprueba el AST ya validado estructuralmente contra los metadatos **del rol revalidado**:

1. **Rol**: si no existe en la allowlist, se rechaza.
2. **Catálogos del sistema** (``pg_catalog``, ``information_schema``, ``pg_*``): siempre rechazados.
3. **Tablas**: cada tabla debe pertenecer al esquema de la allowlist y estar permitida al rol. Se
   comprueba **explícitamente** antes y después de ``qualify``, porque ``qualify`` no rechaza una
   tabla desconocida si la consulta no referencia ninguna de sus columnas (p. ej.
   ``EXISTS (SELECT 1 FROM tabla_prohibida)``).
4. **Columnas y referencias**: ``sqlglot.optimizer.qualify`` con un esquema que contiene **solo**
   las columnas permitidas al rol. Una columna desconocida, no permitida, ambigua o no resoluble
   produce un rechazo.
5. **Tipos**: con ``annotate_types``, las comparaciones entre dos expresiones no literales de
   familias de tipos conocidas y distintas (numérico, texto, temporal, booleano) se rechazan.

Cualquier excepción del análisis se trata como consulta **no validable** y se rechaza. Este análisis
no sustituye la credencial de solo lectura (DE-3, P-16) ni los límites de ejecución (SEC-2).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlglot import exp
from sqlglot.errors import OptimizeError
from sqlglot.optimizer.annotate_types import annotate_types
from sqlglot.optimizer.qualify import qualify
from sqlglot.schema import MappingSchema

from agents_service.validation.allowlist import FORBIDDEN_SCHEMAS, Allowlist

ROLE_NOT_ALLOWED = "ROLE_NOT_ALLOWED"
SYSTEM_CATALOG = "SYSTEM_CATALOG"
TABLE_NOT_ALLOWED = "TABLE_NOT_ALLOWED"
UNRESOLVED_REFERENCE = "UNRESOLVED_REFERENCE"
TYPE_MISMATCH = "TYPE_MISMATCH"
NOT_VALIDATABLE = "NOT_VALIDATABLE"

DIALECT = "postgres"
COMPARISONS = (exp.EQ, exp.NEQ, exp.GT, exp.GTE, exp.LT, exp.LTE)


@dataclass(frozen=True)
class SemanticResult:
    """Resultado semántico: motivos de rechazo o el árbol cualificado listo para regenerar SQL."""

    reasons: tuple[str, ...]
    tree: exp.Expression | None
    tables: frozenset[str]


def _type_family(data_type: exp.DataType | None) -> str | None:
    if data_type is None:
        return None
    kind = data_type.this
    if kind in exp.DataType.NUMERIC_TYPES:
        return "numeric"
    if kind in exp.DataType.TEXT_TYPES:
        return "text"
    if kind in exp.DataType.TEMPORAL_TYPES:
        return "temporal"
    if kind == exp.DataType.Type.BOOLEAN:
        return "boolean"
    return None


def _is_literal_like(node: exp.Expression) -> bool:
    if isinstance(node, (exp.Literal, exp.Null, exp.Boolean)):
        return True
    if isinstance(node, (exp.Neg, exp.Paren)):
        return _is_literal_like(node.this)
    if isinstance(node, exp.Cast):
        return _is_literal_like(node.this)
    return False


def _normalized_name(identifier: exp.Expression | None) -> str:
    """Nombre como lo interpreta PostgreSQL: sin comillas se pasa a minúsculas."""
    if not isinstance(identifier, exp.Identifier):
        return ""
    return identifier.this if identifier.quoted else identifier.this.lower()


def _cte_names(tree: exp.Expression) -> set[str]:
    return {_normalized_name(cte.args.get("alias").this) for cte in tree.find_all(exp.CTE) if cte.args.get("alias")}


def _check_tables(tree: exp.Expression, allowlist: Allowlist, role: str, reasons: list[str]) -> set[str]:
    allowed = allowlist.allowed_tables(role)
    ctes = _cte_names(tree)
    used: set[str] = set()
    for table in tree.find_all(exp.Table):
        name = _normalized_name(table.this)
        db = _normalized_name(table.args.get("db"))
        catalog = _normalized_name(table.args.get("catalog"))
        if db in FORBIDDEN_SCHEMAS or db.startswith("pg_") or name.startswith("pg_") or name in {
            "information_schema"
        }:
            reasons.append(SYSTEM_CATALOG)
            continue
        if not db and not catalog and name in ctes:
            continue  # referencia a una CTE de la propia consulta
        effective_db = db or allowlist.schema
        if catalog or effective_db != allowlist.schema or name not in allowed:
            reasons.append(TABLE_NOT_ALLOWED)
            continue
        used.add(f"{effective_db}.{name}")
    return used


def check_semantics(tree: exp.Expression, allowlist: Allowlist, role: str) -> SemanticResult:
    """Valida tablas, columnas, referencias y tipos contra la allowlist del rol."""
    if not isinstance(role, str) or not allowlist.has_role(role):
        return SemanticResult((ROLE_NOT_ALLOWED,), None, frozenset())

    reasons: list[str] = []
    _check_tables(tree, allowlist, role, reasons)
    if reasons:
        return SemanticResult(tuple(dict.fromkeys(reasons)), None, frozenset())

    schema = MappingSchema(allowlist.schema_for_role(role), dialect=DIALECT)
    try:
        qualified = qualify(
            tree.copy(),
            dialect=DIALECT,
            schema=schema,
            db=allowlist.schema,
            expand_stars=False,
            quote_identifiers=False,
            identify=False,
            validate_qualify_columns=True,
        )
    except OptimizeError:
        return SemanticResult((UNRESOLVED_REFERENCE,), None, frozenset())
    except Exception:  # cualquier fallo del análisis: no validable → rechazo
        return SemanticResult((NOT_VALIDATABLE,), None, frozenset())

    tables = _check_tables(qualified, allowlist, role, reasons)  # defensa tras normalizar
    if reasons:
        return SemanticResult(tuple(dict.fromkeys(reasons)), None, frozenset())

    try:
        annotate_types(qualified, schema=schema, dialect=DIALECT)
    except Exception:
        return SemanticResult((NOT_VALIDATABLE,), None, frozenset())

    for comparison in qualified.find_all(*COMPARISONS):
        left, right = comparison.left, comparison.right
        if _is_literal_like(left) or _is_literal_like(right):
            continue
        left_family, right_family = _type_family(left.type), _type_family(right.type)
        if left_family and right_family and left_family != right_family:
            reasons.append(TYPE_MISMATCH)
            break

    if reasons:
        return SemanticResult(tuple(reasons), None, frozenset())
    return SemanticResult((), qualified, frozenset(tables))
