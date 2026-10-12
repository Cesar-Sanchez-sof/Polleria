"""Lista de objetos permitidos por rol (T010, BR-8).

La allowlist enumera **explícitamente** tablas y columnas por rol; no existen comodines ni acceso a
"todas las tablas". En B2 solo se usan **metadatos ficticios** (``knowledge/allowlist.example.json``);
los objetos reales del ERP están pendientes de P-14.

El cargador es defensivo: rechaza la allowlist completa si contiene objetos que la spec excluye
siempre (usuarios, sesiones, roles, permisos, auditoría, catálogos del sistema) o columnas con
aspecto de credencial, aunque alguien los añada por error.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType

IDENTIFIER_RE = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")

FORBIDDEN_SCHEMAS: frozenset[str] = frozenset({"pg_catalog", "information_schema", "pg_toast"})
FORBIDDEN_TABLE_WORDS: frozenset[str] = frozenset(
    {
        "user", "users", "usuario", "usuarios",
        "session", "sessions", "sesion", "sesiones",
        "role", "roles", "rol",
        "permission", "permissions", "permiso", "permisos",
        "audit", "auditoria",
        "password", "passwords", "token", "tokens", "credential", "credentials",
    }
)
FORBIDDEN_COLUMN_WORDS: frozenset[str] = frozenset(
    {
        "password", "contrasena", "token", "secret", "secreto",
        "hash", "clave", "credential", "credencial", "salt",
    }
)
ALLOWED_TYPES: frozenset[str] = frozenset(
    {"INT", "BIGINT", "SMALLINT", "DECIMAL(12,2)", "NUMERIC", "TEXT", "VARCHAR", "DATE", "TIMESTAMP", "BOOLEAN"}
)


class AllowlistError(ValueError):
    """La allowlist es inválida o incluye objetos prohibidos."""


def _words(name: str) -> set[str]:
    return set(name.split("_"))


def _check_identifier(kind: str, name: str) -> None:
    if not isinstance(name, str) or not IDENTIFIER_RE.match(name):
        raise AllowlistError(f"{kind} inválido o con comodines: {name!r}.")


def _check_table(name: str) -> None:
    _check_identifier("Nombre de tabla", name)
    if name.startswith("pg_") or _words(name) & FORBIDDEN_TABLE_WORDS:
        raise AllowlistError(f"La tabla {name!r} está siempre excluida del asistente (BR-8).")


def _check_column(table: str, name: str) -> None:
    _check_identifier("Nombre de columna", name)
    if _words(name) & FORBIDDEN_COLUMN_WORDS:
        raise AllowlistError(f"La columna {table}.{name} parece una credencial y se excluye.")


@dataclass(frozen=True)
class Allowlist:
    """Allowlist validada e inmutable."""

    version: str
    schema: str
    tables: Mapping[str, Mapping[str, str]]
    roles: Mapping[str, Mapping[str, tuple[str, ...]]]

    def has_role(self, role: str) -> bool:
        return role in self.roles

    def allowed_tables(self, role: str) -> frozenset[str]:
        """Tablas permitidas para el rol (vacío si el rol no existe)."""
        return frozenset(self.roles.get(role, {}))

    def schema_for_role(self, role: str) -> dict[str, dict[str, dict[str, str]]]:
        """Esquema ``{schema: {tabla: {columna: tipo}}}`` con **solo** lo permitido al rol."""
        grants = self.roles.get(role, {})
        return {
            self.schema: {
                table: {column: self.tables[table][column] for column in columns}
                for table, columns in grants.items()
            }
        }

    def column_type(self, table: str, column: str) -> str | None:
        return self.tables.get(table, {}).get(column)


def parse_allowlist(data: Mapping[str, object]) -> Allowlist:
    """Valida un diccionario con la estructura de ``allowlist.example.json``."""
    if not isinstance(data, Mapping):
        raise AllowlistError("La allowlist debe ser un objeto JSON.")
    unknown = set(data) - {"version", "schema", "note", "tables", "roles"}
    if unknown:
        raise AllowlistError(f"Claves no reconocidas en la allowlist: {sorted(unknown)}.")

    version = data.get("version")
    schema = data.get("schema")
    if not isinstance(version, str) or not version:
        raise AllowlistError("Falta la versión de la allowlist.")
    _check_identifier("Esquema", schema)  # type: ignore[arg-type]
    if schema in FORBIDDEN_SCHEMAS or str(schema).startswith("pg_"):
        raise AllowlistError(f"El esquema {schema!r} es un catálogo del sistema.")

    raw_tables = data.get("tables")
    if not isinstance(raw_tables, Mapping) or not raw_tables:
        raise AllowlistError("La allowlist debe declarar al menos una tabla.")
    tables: dict[str, Mapping[str, str]] = {}
    for table, columns in raw_tables.items():
        _check_table(table)
        if not isinstance(columns, Mapping) or not columns:
            raise AllowlistError(f"La tabla {table!r} debe declarar sus columnas y tipos.")
        checked: dict[str, str] = {}
        for column, column_type in columns.items():
            _check_column(table, column)
            if column_type not in ALLOWED_TYPES:
                raise AllowlistError(f"Tipo no admitido para {table}.{column}: {column_type!r}.")
            checked[column] = column_type
        tables[table] = MappingProxyType(checked)

    raw_roles = data.get("roles")
    if not isinstance(raw_roles, Mapping) or not raw_roles:
        raise AllowlistError("La allowlist debe declarar al menos un rol.")
    roles: dict[str, Mapping[str, tuple[str, ...]]] = {}
    for role, grants in raw_roles.items():
        _check_identifier("Rol", role)
        if not isinstance(grants, Mapping) or not grants:
            raise AllowlistError(f"El rol {role!r} debe tener permisos explícitos.")
        role_grants: dict[str, tuple[str, ...]] = {}
        for table, columns in grants.items():
            if table not in tables:
                raise AllowlistError(f"El rol {role!r} referencia una tabla no declarada: {table!r}.")
            if not isinstance(columns, list) or not columns:
                raise AllowlistError(f"Columnas explícitas requeridas para {role}.{table}.")
            for column in columns:
                if column not in tables[table]:
                    raise AllowlistError(f"Columna no declarada en {role}: {table}.{column}.")
            role_grants[table] = tuple(dict.fromkeys(columns))
        roles[role] = MappingProxyType(role_grants)

    return Allowlist(
        version=version,
        schema=schema,  # type: ignore[arg-type]
        tables=MappingProxyType(tables),
        roles=MappingProxyType(roles),
    )


def load_allowlist(path: Path) -> Allowlist:
    """Carga y valida una allowlist desde un archivo JSON local."""
    return parse_allowlist(json.loads(path.read_text(encoding="utf-8")))
