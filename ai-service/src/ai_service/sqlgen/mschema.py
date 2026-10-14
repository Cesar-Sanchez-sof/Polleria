"""``MSchemaBuilder``: bloque ``〖数据库schema〗`` en formato M-Schema, solo con objetos autorizados.

Fuentes:

- **Qué** se muestra: la allowlist del rol (tablas y columnas explícitas, BR-8). Una tabla o
  columna que el rol no tiene nunca aparece, aunque exista en el ERP.
- **Cómo** se describe: ``knowledge/erp_schema_metadata.json`` (tipos, nulabilidad, clave primaria
  y relaciones extraídos de Prisma). Un tipo sin traducción conocida hace fallar la construcción.

Formato del entrenamiento (verificado)::

    〖DB_ID〗 los_betos
    〖Schema〗
    # Table: <tabla>
    [
    (<columna>:<TIPO>[, Primary Key][, Nullable]),
    ...
    ]
    〖Foreign keys〗
    <tabla>.<columna>=<tabla>.<columna>

Las claves foráneas se listan en el orden de las tablas, solo si ambos extremos están autorizados.
Las autorreferencias (``accounting_account.parent_id``) se omiten por defecto, como en la variante
de entrenamiento equivalente a ``saldo_cuenta``.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

from ai_service.sqlgen.profile import TRAINING_DB_ID
from ai_service.validation.allowlist import Allowlist

_VARCHAR_RE = re.compile(r"^VarChar\((\d{1,5})\)$")
_DECIMAL_RE = re.compile(r"^Decimal\((\d{1,2}),\s*(\d{1,2})\)$")


class MSchemaError(ValueError):
    """El esquema no puede describirse de forma segura."""


def mschema_type(column: Mapping[str, Any]) -> str:
    """Traduce el tipo Prisma de la metadata al tipo M-Schema del entrenamiento."""
    prisma_type, db_type = column.get("type"), column.get("db_type")
    if prisma_type == "Int" and db_type is None:
        return "INTEGER"
    if prisma_type == "Boolean" and db_type is None:
        return "BOOLEAN"
    if prisma_type == "String" and isinstance(db_type, str) and (match := _VARCHAR_RE.match(db_type)):
        return f"VARCHAR({match.group(1)})"
    if prisma_type == "Decimal" and isinstance(db_type, str) and (match := _DECIMAL_RE.match(db_type)):
        return f"DECIMAL({match.group(1)},{match.group(2)})"
    if prisma_type == "DateTime" and db_type == "Date":
        return "DATE"
    if prisma_type == "DateTime" and db_type in ("Timestamp(6)", None):
        return "TIMESTAMP"
    raise MSchemaError(f"Tipo sin traducción M-Schema: {column.get('column')!r}.")


class MSchemaBuilder:
    def __init__(self, allowlist: Allowlist, metadata: Mapping[str, Any], *, db_id: str = TRAINING_DB_ID) -> None:
        self._allowlist = allowlist
        self._models = {model["table"]: model for model in metadata["models"]}
        self._db_id = db_id

    def build(
        self,
        role: str,
        tables: Sequence[str],
        *,
        include_self_references: bool = False,
        hidden_columns: frozenset[tuple[str, str]] = frozenset(),
    ) -> str:
        """``hidden_columns``: columnas autorizadas que no se muestran al modelo (p. ej., las que
        solo usa una política determinista y no formaban parte del esquema de entrenamiento)."""
        grants = self._allowlist.roles.get(role)
        if not grants:
            raise MSchemaError("Rol sin permisos en la allowlist.")
        visible = [table for table in tables if table in grants]
        if not visible:
            raise MSchemaError("El rol no tiene ninguna tabla necesaria para la consulta.")

        lines = [f"〖DB_ID〗 {self._db_id}", "〖Schema〗"]
        for table in visible:
            model = self._models.get(table)
            if model is None:
                raise MSchemaError(f"Tabla sin metadata: {table!r}.")
            allowed = {column for column in grants[table] if (table, column) not in hidden_columns}
            columns = [c for c in model["columns"] if c["column"] in allowed]
            missing = allowed - {c["column"] for c in columns}
            if missing:
                raise MSchemaError(f"Columnas autorizadas sin metadata en {table!r}.")
            entries = []
            for column in columns:
                flags = (", Primary Key" if column.get("primary_key") else "") + (
                    ", Nullable" if column.get("nullable") else ""
                )
                entries.append(f"({column['column']}:{mschema_type(column)}{flags})")
            lines += [f"# Table: {table}", "[", ",\n".join(entries), "]"]

        foreign_keys = []
        for table in visible:
            for relation in self._models[table].get("relations", []):
                target = relation["target_table"]
                if target not in visible or (target == table and not include_self_references):
                    continue
                pairs = zip(relation["columns"], relation["target_columns"], strict=True)
                for column, target_column in pairs:
                    if column in grants[table] and target_column in grants[target]:
                        foreign_keys.append(f"{table}.{column}={target}.{target_column}")
        if foreign_keys:
            lines += ["〖Foreign keys〗", *foreign_keys]
        return "\n".join(lines)
