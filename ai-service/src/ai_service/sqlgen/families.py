"""Catálogo de **familias de consulta entrenadas** (P1): tipos de consulta que el adaptador XiYanSQL v1.7
vio en el entrenamiento, más allá del saldo de una cuenta.

Cada familia (``knowledge/query_families_v1.json``, generado por ``scripts/extract_query_families.py``
desde el dataset) fija, igual que en el ejemplo de entrenamiento anclado:

- la solicitud JSON 1.0 (``domain``, ``intent``, ``subject``, ``metrics``…); solo el período lo pone el
  backend a partir de ``fecha_referencia_lima``;
- el M-Schema y la evidencia ``〖参考信息〗``, filtrados a lo que el rol de la petición puede ver.

El Modelo 1 solo **elige** la familia de una lista cerrada (``Entities.consulta``); nunca escribe la
solicitud. El SQL lo genera XiYanSQL en cada consulta y pasa siempre por el SQL Validator. El catálogo
no contiene preguntas, respuestas ni SQL.
"""

from __future__ import annotations

import copy
import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import Any, Literal

from ai_service.http.schemas import Period

Shape = Literal["escalar", "agrupada", "ranking", "serie", "comparacion", "lista"]
Unit = Literal["PEN", "N"]
SHAPES: frozenset[str] = frozenset({"escalar", "agrupada", "ranking", "serie", "comparacion", "lista"})
FAMILY_ID_RE = re.compile(r"^[a-z][a-z_]{2,59}$")
_TABLE_RE = re.compile(r"^# Table: ([a-z_][a-z0-9_]*)$")
_COLUMN_RE = re.compile(r"^\(([a-z_][a-z0-9_]*):.*\),?$")  # el tipo puede llevar paréntesis: VARCHAR(11)
_FK_RE = re.compile(r"^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)=([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$")
_COLUMN_REF_RE = re.compile(r"\b([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\b")


class FamilyError(ValueError):
    """La familia no existe o no puede construirse para el rol de la petición (sin detalles)."""


@dataclass(frozen=True)
class SchemaEquivalences:
    """Nombres del esquema del entrenamiento → nombres de la base desplegada (determinista).

    El adaptador se entrenó con ``dish``/``order_item.dish_id``; la base real los unificó en ``product``
    (commit ``2f10622`` de ``develop``). El modelo sigue viendo el esquema del entrenamiento y el SQL
    generado se traduce sobre el AST antes del SQL Validator, que lo revisa con la allowlist real.
    """

    tables: Mapping[str, str]
    columns: Mapping[tuple[str, str], str]  # (tabla del entrenamiento, columna) → columna real

    def real_table(self, table: str) -> str:
        return self.tables.get(table, table)

    def real_column(self, table: str, column: str) -> str:
        return self.columns.get((table, column), column)

    def touches(self, tables: Sequence[str]) -> bool:
        return any(t in self.tables or any(t == ct for ct, _ in self.columns) for t in tables)

    def rewrite(self, sql: str) -> str:
        """Traduce tablas y columnas; una tabla sin alias conserva su nombre de entrenamiento como alias,
        así que ``dish.name`` sigue resolviéndose (``FROM product AS dish``)."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            raise FamilyError("UNPARSEABLE_OUTPUT") from None
        for select in tree.find_all(exp.Select):
            sources = [s.this for s in [select.args.get("from_")] if s is not None]
            sources += [j.this for j in select.args.get("joins") or []]
            by_alias = {t.alias_or_name: t.name for t in sources if isinstance(t, exp.Table)}
            for column in select.find_all(exp.Column):
                if column.find_ancestor(exp.Select) is not select:
                    continue
                owner = by_alias.get(column.table) if column.table else next(
                    (t for t in by_alias.values() if (t, column.name) in self.columns), None)
                if owner is not None and (owner, column.name) in self.columns:
                    column.set("this", exp.to_identifier(self.columns[(owner, column.name)]))
        for table in tree.find_all(exp.Table):
            if table.name in self.tables:
                if not table.alias:
                    table.set("alias", exp.TableAlias(this=exp.to_identifier(table.name)))
                table.set("this", exp.to_identifier(self.tables[table.name]))
        return tree.sql(dialect="postgres")


NO_EQUIVALENCES = SchemaEquivalences(tables={}, columns={})


@dataclass(frozen=True)
class QueryFamily:
    id: str
    titulo: str
    descripcion: str
    shape: Shape
    metrics: Mapping[str, tuple[Unit, str]]
    labels: tuple[str, ...]
    solicitud: Mapping[str, Any]
    mschema: str
    evidencia: str
    contable: bool
    diferencia: tuple[str, str, str] | None = None
    # Columnas alternativas del resultado para cada métrica (p. ej. ``total_amount`` sin alias).
    aliases: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    equivalencias: SchemaEquivalences = NO_EQUIVALENCES
    # Magnitud contable que mide (``ventas_facturadas``, ``cobros``, ``compras_facturadas``…).
    concepto: str = ""

    @property
    def tables(self) -> tuple[str, ...]:
        """Tablas del M-Schema del entrenamiento (lo que ve el modelo)."""
        return tuple(m.group(1) for line in self.mschema.splitlines() if (m := _TABLE_RE.match(line)))

    @property
    def real_tables(self) -> tuple[str, ...]:
        """Las mismas tablas con los nombres de la base desplegada (lo que debe autorizar la allowlist)."""
        return tuple(self.equivalencias.real_table(t) for t in self.tables)

    def _granted(self, grants: Mapping[str, Sequence[str]], table: str, column: str) -> bool:
        eq = self.equivalencias
        return eq.real_column(table, column) in grants.get(eq.real_table(table), ())

    def request(self, periodo: Period) -> dict[str, Any]:
        """Solicitud del entrenamiento con el período del plan (``[start, end_exclusive)``)."""
        request = copy.deepcopy(dict(self.solicitud))
        request["time"] = {
            **request["time"],
            "start": periodo.desde.isoformat(),
            "end_exclusive": (periodo.hasta + timedelta(days=1)).isoformat(),
        }
        return request

    def schema_for(self, grants: Mapping[str, Sequence[str]]) -> str:
        """M-Schema del entrenamiento sin las columnas ni relaciones que el rol no ve.

        Si el rol no ve alguna tabla de la familia, la consulta no es resoluble (:class:`FamilyError`).
        """
        missing = [t for t in self.real_tables if t not in grants]
        if missing:
            raise FamilyError("ROLE_SCOPE_INSUFFICIENT")
        out: list[str] = []
        table: str | None = None
        entries: list[str] = []
        for line in self.mschema.splitlines():
            if match := _TABLE_RE.match(line):
                table = match.group(1)
                out.append(line)
            elif line == "[":
                entries = []
                out.append(line)
            elif line == "]":
                out.append(",\n".join(entries))
                out.append(line)
                table = None
            elif table is not None:
                column = _COLUMN_RE.match(line)
                if column is None:
                    raise FamilyError("INVALID_CATALOG")  # nunca se copia una línea de esquema sin filtrar
                if self._granted(grants, table, column.group(1)):
                    entries.append(line.rstrip(","))
            elif fk := _FK_RE.match(line):
                left_t, left_c, right_t, right_c = fk.groups()
                if self._granted(grants, left_t, left_c) and self._granted(grants, right_t, right_c):
                    out.append(line)
            else:
                out.append(line)  # 〖DB_ID〗, 〖Schema〗, 〖Foreign keys〗
        if out and out[-1] == "〖Foreign keys〗":
            out.pop()
        return "\n".join(out)

    def evidence_for(self, grants: Mapping[str, Sequence[str]]) -> str:
        """Evidencia del entrenamiento; solo si toda columna que nombra es visible para el rol."""
        for table, column in _COLUMN_REF_RE.findall(self.evidencia):
            if table in self.tables and not self._granted(grants, table, column):
                raise FamilyError("EVIDENCE_NOT_VISIBLE")
        return self.evidencia

    def to_real_schema(self, sql: str) -> str:
        """SQL del modelo (nombres del entrenamiento) → nombres de la base desplegada."""
        return self.equivalencias.rewrite(sql) if self.equivalencias.touches(self.tables) else sql


@dataclass(frozen=True)
class Concept:
    """Magnitud contable que distingue el intérprete; ``canonica`` es su familia por defecto o ``None``
    (sin familia entrenada: gastos operativos; o flujo propio: saldo de una cuenta)."""

    id: str
    canonica: str | None
    definicion: str


class FamilyCatalog:
    def __init__(self, version: str, families: Sequence[QueryFamily], concepts: Sequence[Concept] = ()) -> None:
        self.version = version
        self._families = {family.id: family for family in families}
        self.concepts = {concept.id: concept for concept in concepts}

    def __contains__(self, family_id: object) -> bool:
        return family_id in self._families

    def __iter__(self):
        return iter(self._families.values())

    def __len__(self) -> int:
        return len(self._families)

    @property
    def ids(self) -> tuple[str, ...]:
        return tuple(self._families)

    def get(self, family_id: str) -> QueryFamily:
        family = self._families.get(family_id)
        if family is None:
            raise FamilyError("UNKNOWN_FAMILY")
        return family

    def menu(self) -> str:
        """Lista para el intérprete: ``id: descripción`` (sin cifras, tablas ni SQL)."""
        return "\n".join(f"- {family.id}: {family.descripcion}" for family in self)

    def concept_menu(self) -> str:
        return "\n".join(f"- {concept.id}: {concept.definicion}" for concept in self.concepts.values())

    def resolve(self, family_id: str | None, concepto: str | None) -> tuple[QueryFamily | None, str | None]:
        """Familia coherente con el concepto contable del intérprete y, si hubo que cambiarla, el motivo.

        - Concepto sin familia (gastos operativos, saldo de cuenta) → ``(None, None)``: lo decide el pipeline.
        - Familia de otro concepto → la canónica del concepto (``FAMILY_ADJUSTED_TO_CONCEPT``).
        - Sin familia pero con concepto → la canónica (``FAMILY_FROM_CONCEPT``).
        """
        family = self._families.get(family_id) if family_id else None
        concept = self.concepts.get(concepto) if concepto else None
        if concept is None:
            return family, None
        if concept.canonica is None:
            return None, None
        if family is None:
            return self._families[concept.canonica], "FAMILY_FROM_CONCEPT"
        if family.concepto != concept.id:
            return self._families[concept.canonica], "FAMILY_ADJUSTED_TO_CONCEPT"
        return family, None


def load_family_catalog(path: Path) -> FamilyCatalog:
    data = json.loads(path.read_text(encoding="utf-8"))
    raw_eq = data.get("equivalencias_esquema") or {}
    equivalences = SchemaEquivalences(
        tables=dict(raw_eq.get("tablas", {})),
        columns={tuple(key.split(".", 1)): value for key, value in raw_eq.get("columnas", {}).items()},  # type: ignore[misc]
    )
    families = []
    for raw in data["familias"]:
        if not FAMILY_ID_RE.match(raw["id"]) or raw["shape"] not in SHAPES:
            raise FamilyError("INVALID_CATALOG")
        metrics = {column: (spec[0], spec[1]) for column, spec in raw["metrics"].items()}
        aliases = {column: tuple(spec[2]) for column, spec in raw["metrics"].items() if len(spec) > 2}
        if not metrics or any(unit not in ("PEN", "N") for unit, _ in metrics.values()):
            raise FamilyError("INVALID_CATALOG")
        diferencia = tuple(raw["diferencia"]) if raw.get("diferencia") else None
        families.append(
            QueryFamily(
                id=raw["id"],
                titulo=raw["titulo"],
                descripcion=raw["descripcion"],
                shape=raw["shape"],
                metrics=metrics,  # type: ignore[arg-type]
                labels=tuple(raw["labels"]),
                solicitud=raw["solicitud"],
                mschema=raw["mschema"],
                evidencia=raw["evidencia"],
                contable=bool(raw["contable"]),
                diferencia=diferencia,  # type: ignore[arg-type]
                aliases=aliases,
                equivalencias=equivalences,
                concepto=raw.get("concepto", ""),
            )
        )
    concepts = [Concept(id=key, canonica=value["canonica"], definicion=value["definicion"])
                for key, value in (data.get("conceptos") or {}).items()]
    ids = {family.id for family in families}
    if any(c.canonica is not None and c.canonica not in ids for c in concepts):
        raise FamilyError("INVALID_CATALOG")
    return FamilyCatalog(data["version"], families, concepts)
