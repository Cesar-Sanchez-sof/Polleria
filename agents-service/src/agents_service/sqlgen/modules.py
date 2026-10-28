"""Módulos del ERP para la **ruta ampliada** (consultas no cubiertas por las familias entrenadas).

``knowledge/erp_modules_v1.json`` (``scripts/extract_erp_modules.py``) describe, verificado contra el
catálogo de Neon, qué tablas y columnas de cada módulo puede ver el asistente, sus tipos y relaciones
y notas de negocio. Con eso este módulo construye, solo con lo que el rol y los módulos permitidos
autorizan:

- el M-Schema con el mismo formato del entrenamiento (``〖DB_ID〗 los_betos`` …);
- la evidencia ``〖参考信息〗`` en inglés (descripción de tablas y significado de estados);
- los fragmentos del RAG local (uno por tabla, en español) con los que se eligen las tablas.

El catálogo no contiene preguntas, respuestas ni SQL: XiYanSQL genera el SQL y el validador lo revisa.
Estas solicitudes están **fuera de la distribución** del adaptador v1.7 (vocabulario y tablas nuevos).
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from agents_service.orchestrator.ports import Fragment
from agents_service.sqlgen.profile import TRAINING_DB_ID

# Dominio del contrato 1.0 para cada módulo (el entrenamiento usa sales, purchases, inventory, accounting).
MODULE_DOMAIN = {
    "ventas": "sales", "productos": "inventory", "inventario": "inventory", "compras": "purchases",
    "proveedores": "purchases", "caja": "sales", "contabilidad": "accounting",
}
MAX_EVIDENCE_CHARS = 700
# Columnas cuyos valores son palabras que el usuario escribe tal cual (tipo de comprobante, de pedido, medio de pago).
LITERAL_COLUMNS = frozenset({("sales_invoice", "voucher_type"), ("purchase_invoice", "voucher_type"),
                             ("sales_order", "order_type"), ("payment_type", "name")})


def _fold(text: str) -> str:
    import unicodedata

    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def _value_keys(value: str) -> set[str]:
    """Palabras que identifican un valor ("Tarjeta / POS" → {tarjeta, pos})."""
    import re

    return {w for w in re.findall(r"[a-z]+", _fold(value)) if len(w) >= 3}


def _words_of(text: str) -> set[str]:
    """Palabras significativas (≥ 4 letras) de un texto en inglés, sin mayúsculas ni tildes."""
    import re

    return {w for w in re.findall(r"[a-z_]+", _fold(text)) if len(w) >= 4}


def _message_words(message: str) -> set[str]:
    """Palabras de la pregunta y su singular ("facturas" → factura, "boletas" → boleta)."""
    import re

    words = set(re.findall(r"[a-z]+", _fold(message)))
    return words | {w[:-1] for w in words if w.endswith("s")} | {w[:-2] for w in words if w.endswith("es")}


@dataclass(frozen=True)
class Column:
    name: str
    type: str
    nullable: bool
    pk: bool


@dataclass(frozen=True)
class TableDoc:
    name: str
    module: str
    description: str
    evidence: str
    columns: tuple[Column, ...]
    relations: tuple[tuple[str, str, str], ...]  # (columna, tabla destino, columna destino)
    notes: Mapping[str, str]
    values: Mapping[str, tuple[str, ...]] = None  # type: ignore[assignment]  # valores conocidos por columna
    closed: frozenset[str] = frozenset()  # columnas cuya lista de valores es completa (enums)


class ErpModules:
    def __init__(self, version: str, modules: Mapping[str, Mapping], tables: Mapping[str, TableDoc]) -> None:
        self.version = version
        self.modules = dict(modules)
        self.tables = dict(tables)

    def module_name(self, module: str) -> str:
        return str(self.modules.get(module, {}).get("nombre", module))

    def tables_for(self, modules: Iterable[str] | None) -> set[str]:
        """Tablas de los módulos dados (``None``: todos)."""
        wanted = set(self.modules) if modules is None else set(modules) & set(self.modules)
        return {name for name, table in self.tables.items() if table.module in wanted}

    def fragments(self, tables: Iterable[str] | None = None) -> list[Fragment]:
        """Un fragmento por tabla para el RAG local: descripción en español, columnas y notas."""
        names = sorted(self.tables) if tables is None else sorted(set(tables) & set(self.tables))
        out = []
        for name in names:
            table = self.tables[name]
            columns = ", ".join(c.name for c in table.columns)
            notes = " ".join(table.notes.values())
            out.append(Fragment(tipo="esquema", fuente=f"modulo:{name}", version=self.version,
                                contenido=f"{self.module_name(table.module)}. Tabla {name}: {table.description} "
                                          f"Columnas: {columns}. {notes}".strip()))
        return out

    def mschema(self, tables: Sequence[str], grants: Mapping[str, Sequence[str]]) -> str:
        """M-Schema (formato del entrenamiento) con solo las columnas autorizadas al rol."""
        lines = [f"〖DB_ID〗 {TRAINING_DB_ID}", "〖Schema〗"]
        visible = [t for t in tables if t in self.tables and t in grants]
        for name in visible:
            allowed = set(grants[name])
            entries = []
            for column in self.tables[name].columns:
                if column.name in allowed:
                    flags = (", Primary Key" if column.pk else "") + (", Nullable" if column.nullable else "")
                    entries.append(f"({column.name}:{column.type}{flags})")
            lines += [f"# Table: {name}", "[", ",\n".join(entries), "]"]
        foreign = [f"{name}.{col}={target}.{target_col}"
                   for name in visible for col, target, target_col in self.tables[name].relations
                   if target in visible and col in grants[name] and target_col in grants[target]]
        if foreign:
            lines += ["〖Foreign keys〗", *foreign]
        return "\n".join(lines)

    def evidence(self, tables: Sequence[str], grants: Mapping[str, Sequence[str]], hint: str | None = None) -> str:
        """Evidencia en inglés: qué es cada tabla y el significado de sus estados (columnas visibles)."""
        parts, extra = [], []
        for name in tables:
            table = self.tables.get(name)
            if table is None or name not in grants:
                continue
            parts.append(table.evidence)
            extra += [note for column, note in table.notes.items() if column in grants[name]]
            extra += [f"{name}.{column} values: {', '.join(values)}." for column, values in (table.values or {}).items()
                      if column in grants[name] and column not in table.notes]
        # Con el límite de longitud, primero las notas que comparten palabras con el objetivo de la pregunta
        # (orden estable: a igual relevancia, el del catálogo).
        focus = _words_of(hint or "")
        parts += sorted(extra, key=lambda note: -len(_words_of(note) & focus))
        if hint:
            parts.insert(0, hint)  # corrección controlada: va primero para que no se recorte
        text = " ".join(parts)
        return text[:MAX_EVIDENCE_CHARS].rsplit(" ", 1)[0] if len(text) > MAX_EVIDENCE_CHARS else text


    # ------------------------------------------------------------------ estados y tipos
    def _comparisons(self, tree):
        """(tabla, columna, literal) de cada comparación columna = / <> / IN con texto, resolviendo alias."""
        from sqlglot import exp

        for select in tree.find_all(exp.Select):
            sources = [s.this for s in [select.args.get("from_")] if s is not None]
            sources += [j.this for j in select.args.get("joins") or []]
            by_alias = {t.alias_or_name: t.name for t in sources if isinstance(t, exp.Table)}
            for node in select.find_all(exp.EQ, exp.NEQ, exp.In):
                if node.find_ancestor(exp.Select) is not select:
                    continue
                column = node.this if isinstance(node.this, exp.Column) else node.expression
                if not isinstance(column, exp.Column):
                    continue
                if column.table:
                    owner = by_alias.get(column.table)
                else:  # sin calificar: la única tabla de la consulta que tiene esa columna con valores conocidos
                    owners = [t for t in by_alias.values() if t in self.tables and column.name in (self.tables[t].values or {})]
                    owner = owners[0] if len(owners) == 1 else None
                if owner not in self.tables or column.name not in (self.tables[owner].values or {}):
                    continue
                literals = node.expressions if isinstance(node, exp.In) else [node.expression, node.this]
                for literal in literals:
                    if isinstance(literal, exp.Literal) and literal.is_string:
                        yield owner, column.name, literal

    def normalize_literals(self, sql: str) -> tuple[str, bool]:
        """Corrige SOLO mayúsculas/minúsculas de literales de estados y tipos conocidos ('open' → 'OPEN').
        Determinista y sin inventar: si el texto no coincide con ningún valor conocido, no se toca."""
        import sqlglot
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return sql, False
        changed = False
        for table, column, literal in list(self._comparisons(tree)):
            known = {v.lower(): v for v in self.tables[table].values[column]}
            exact = known.get(literal.this.lower())
            if exact is not None and exact != literal.this:
                literal.set("this", exact)
                changed = True
        return (tree.sql(dialect="postgres"), True) if changed else (sql, False)

    def unknown_values(self, sql: str) -> list[tuple[str, str, str]]:
        """Literales que no existen en una lista COMPLETA de valores (p. ej. ``status = 'pending'``)."""
        import sqlglot
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return []
        return [(t, c, lit.this) for t, c, lit in self._comparisons(tree)
                if c in self.tables[t].closed and lit.this not in self.tables[t].values[c]]

    def date_columns(self, table: str) -> tuple[str, ...]:
        doc = self.tables.get(table)
        return tuple(c.name for c in doc.columns if c.type in ("DATE", "TIMESTAMP")) if doc else ()

    def time_concept(self, requested: str | None, tables: Sequence[str], subject: str | None) -> tuple[str | None, bool]:
        """Columna de fecha para ``time.concept``: la pedida si es una fecha de las tablas elegidas; si no,
        la primera fecha de la tabla principal (o de las demás). ``(columna, ajustada)``."""
        candidates = [c for t in tables for c in self.date_columns(t)]
        if requested in candidates:
            return requested, False
        ordered = [subject, *tables] if subject in tables else list(tables)
        fallback = next((c for t in ordered for c in self.date_columns(t)), None)
        return (fallback, True) if fallback else (requested, False)

    def latest_tiebreak(self, sql: str) -> tuple[str, bool]:
        """``ORDER BY <fecha DATE> DESC … LIMIT n`` sin desempate: varias filas comparten el día y "la última" sería
        una cualquiera. Se añade ``<alias>.id DESC`` (el registro más reciente) si la tabla tiene esa clave. No cambia
        qué filas cumplen la consulta, solo el orden entre empates."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return sql, False
        changed = False
        for select in tree.find_all(exp.Select):
            order, source = select.args.get("order"), select.args.get("from_")
            if order is None or select.args.get("limit") is None or source is None or select.args.get("group"):
                continue
            table = source.this if isinstance(source.this, exp.Table) else None
            doc = self.tables.get(table.name) if table is not None else None
            keys = order.expressions
            if doc is None or len(keys) != 1 or not keys[0].args.get("desc") or not isinstance(keys[0].this, exp.Column):
                continue
            column = next((c for c in doc.columns if c.name == keys[0].this.name), None)
            if column is None or column.type != "DATE" or not any(c.name == "id" and c.pk for c in doc.columns):
                continue
            order.append("expressions", exp.Ordered(this=exp.column("id", table=table.alias_or_name), desc=True, nulls_first=False))
            changed = True
        return (tree.sql(dialect="postgres"), True) if changed else (sql, False)

    @staticmethod
    def nulls_last(sql: str) -> tuple[str, bool]:
        """``ORDER BY … DESC`` sin indicación explícita → ``NULLS LAST``: en PostgreSQL los NULL van primero
        en orden descendente y "el más caro" sería un registro sin precio. Determinista; no cambia filas."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        if "NULLS" in sql.upper():
            return sql, False  # el modelo ya decidió explícitamente
        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return sql, False
        changed = False
        for ordered in tree.find_all(exp.Ordered):
            if ordered.args.get("desc"):
                ordered.set("nulls_first", False)
                changed = True
        return (tree.sql(dialect="postgres"), True) if changed else (sql, False)

    # ------------------------------------------------------------------ valores pedidos y validación semántica
    def find_value(self, text: str, tables: Sequence[str]) -> tuple[str, str, str] | None:
        """``(tabla, columna, valor exacto)`` de un valor conocido de las tablas dadas ("yape" → Yape,
        "Tarjeta" → "Tarjeta / POS"); ``None`` si no es un valor conocido."""
        wanted = text.strip().strip("%").lower()
        if len(wanted) < 3:
            return None
        for table in tables:
            for column, values in ((self.tables[table].values or {}).items() if table in self.tables else ()):
                for value in values:
                    if value.lower() == wanted or wanted in _value_keys(value):
                        return table, column, value
        return None

    def mentioned_values(self, message: str, tables: Sequence[str]) -> list[tuple[str, str, str]]:
        """Valores de columnas con etiquetas en español (``LITERAL_COLUMNS``) escritos en la pregunta: "facturas",
        "para llevar", "con Yape". Si se nombran dos valores de una misma columna es un desglose, no un filtro."""
        words = _message_words(message)
        found: dict[tuple[str, str], set[str]] = {}
        for table, column in sorted(LITERAL_COLUMNS):
            if table not in tables or table not in self.tables:
                continue
            for value in (self.tables[table].values or {}).get(column, ()):
                if _value_keys(value) & words:
                    found.setdefault((table, column), set()).add(value)
        return [(t, c, next(iter(v))) for (t, c), v in found.items() if len(v) == 1]

    def filter_problem(self, sql: str, filters: Sequence[tuple[str, str]], tables: Sequence[str]) -> str | None:
        """Coherencia entre los filtros pedidos (``(operador, valor)``) y el SQL validado:

        - ``FILTER_NOT_APPLIED``: se pidió un valor conocido (Yape, Factura, Cancelled…) y no aparece en el SQL;
        - ``FILTER_NOOP``: un ``IN`` enumera TODOS los valores de una lista cerrada (no filtra nada)."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return None
        literals = [lit.this.lower().strip("%") for lit in tree.find_all(exp.Literal) if lit.is_string]
        for operator, value in filters:
            if operator not in ("eq", "contains"):
                continue
            hit = self.find_value(value, tables)
            if hit is None:
                continue
            canonical = hit[2].lower()
            if not any(canonical in lit or (len(lit) >= 3 and lit in canonical) for lit in literals):
                return "FILTER_NOT_APPLIED"
        for node in tree.find_all(exp.In):
            if not isinstance(node.this, exp.Column):
                continue
            listed = {e.this.lower() for e in node.expressions if isinstance(e, exp.Literal) and e.is_string}
            for table in tables:
                doc = self.tables.get(table)
                if doc and node.this.name in doc.closed and len(listed) > 1 and \
                        listed >= {v.lower() for v in (doc.values or {}).get(node.this.name, ())}:
                    return "FILTER_NOOP"
        return None

    def unrequested_flags(self, sql: str, requested: str, tables: Sequence[str]) -> list[str]:
        """Columnas booleanas de estado de negocio (``active``, ``sellable``…) comparadas con TRUE/FALSE en el SQL sin
        que la pregunta ni su interpretación las nombren: "¿cuántos productos tenemos?" no es "¿cuántos activos?".
        ``annulled`` y ``status`` quedan fuera: son filtros de validez que el catálogo y P-4 exigen."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return []
        flags = {c.name for t in tables if t in self.tables for c in self.tables[t].columns
                 if c.type == "BOOLEAN" and c.name not in ("annulled", "status")}
        mentioned = _words_of(requested) | {w.rstrip("s") for w in _words_of(requested)}
        found = []
        for node in tree.find_all(exp.EQ, exp.NEQ, exp.Is):
            column = node.this if isinstance(node.this, exp.Column) else None
            if column is not None and column.name in flags and isinstance(node.expression, exp.Boolean) \
                    and column.name not in mentioned and column.name not in found:
                found.append(column.name)
        return found

    @staticmethod
    def invented_patterns(sql: str, requested: str) -> list[str]:
        """Patrones ``LIKE``/``ILIKE`` sin ninguna palabra de la pregunta ni de su interpretación (p. ej. el modelo
        copió un ejemplo de la evidencia): filtrarían por un texto que nadie pidió."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return []
        words = {w for w in _message_words(requested) if len(w) >= 3}
        invented = []
        for node in tree.find_all(exp.Like, exp.ILike):
            pattern = node.expression
            if isinstance(pattern, exp.Literal) and pattern.is_string:
                found = {w for w in _message_words(pattern.this) if len(w) >= 3}
                if found and not found & words:
                    invented.append(pattern.this)
        return invented

    def unknown_columns(self, sql: str, tables: Sequence[str]) -> tuple[list[str], list[str]]:
        """``(columnas que no existen en las tablas dadas, columnas de fecha válidas)`` para la pista del reintento.
        Solo nombres del esquema autorizado; nunca datos."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return [], []
        known = {c.name for t in tables if t in self.tables for c in self.tables[t].columns}
        aliases = {a.alias for a in tree.find_all(exp.Alias)}
        missing = sorted({c.name for c in tree.find_all(exp.Column) if c.name not in known and c.name not in aliases})
        dates = [f"{t}.{c}" for t in tables for c in self.date_columns(t)]
        return missing, dates

    @staticmethod
    def left_join_nullified(sql: str) -> bool:
        """``LEFT JOIN t … WHERE t.col …`` (sin ``IS NULL``): la condición descarta las filas sin pareja y el
        LEFT JOIN se vuelve INNER; con ``COUNT(t.x) = 0`` la consulta nunca devuelve nada ("productos sin ventas")."""
        import sqlglot
        from sqlglot import exp
        from sqlglot.errors import SqlglotError

        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return False
        for select in tree.find_all(exp.Select):
            joins = select.args.get("joins") or []
            left = {j.this.alias_or_name for j in joins if (j.side or "").upper() == "LEFT" and isinstance(j.this, exp.Table)}
            where = select.args.get("where")
            if not left or where is None:
                continue
            conditions = list(where.this.flatten()) if isinstance(where.this, exp.And) else [where.this]
            for condition in conditions:
                if condition.find(exp.Is) or condition.find(exp.Exists) or condition.find(exp.Subquery):
                    continue
                if any(column.table in left for column in condition.find_all(exp.Column)):
                    return True
        return False

    def values_hint(self, tables: Sequence[str]) -> str:
        parts = [f"{t}.{c} values are exactly: {', '.join(v)}." for t in tables if t in self.tables
                 for c, v in (self.tables[t].values or {}).items()]
        return " ".join(parts)


def load_erp_modules(path: Path) -> ErpModules:
    data = json.loads(path.read_text(encoding="utf-8"))
    tables = {}
    for name, raw in data["tablas"].items():
        tables[name] = TableDoc(
            name=name, module=raw["modulo"], description=raw["descripcion"], evidence=raw["evidencia"],
            columns=tuple(Column(c["nombre"], c["tipo"], bool(c["nullable"]), bool(c["pk"])) for c in raw["columnas"]),
            relations=tuple((r["columna"], r["tabla"], r["columna_destino"]) for r in raw["relaciones"]),
            notes=dict(raw.get("notas", {})),
            values={c: tuple(v) for c, v in (raw.get("valores") or {}).items()},
            closed=frozenset(raw.get("valores_cerrados") or ()),
        )
    return ErpModules(data["version"], data["modulos"], tables)
