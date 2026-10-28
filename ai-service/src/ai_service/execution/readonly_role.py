"""Genera el SQL del rol PostgreSQL de solo lectura del asistente (mínimo privilegio, SEC-2, DE-3).

Es la última barrera: aunque el validador y el Executor fallaran, la base rechazaría cualquier
escritura o lectura fuera de la allowlist, porque el rol **no tiene** esos privilegios.

El script solo **imprime** SQL; no se conecta ni lo ejecuta. Lo revisa y lo aplica el dueño de la
base (``psql``); la contraseña nunca va en el archivo (se pasa como variable de ``psql``).

Uso, desde ``ai-service/``::

    set PYTHONPATH=src && .venv\\Scripts\\python.exe -m ai_service.execution.readonly_role > ai_readonly.sql
    psql "<conexión de administrador>" -v ai_password="<contraseña nueva>" -f ai_readonly.sql

Después, ``DATABASE_URL_READONLY`` apunta a ese rol y ``check_connection`` confirma que no tiene
privilegios de escritura.
"""

from __future__ import annotations

import sys
from pathlib import Path

from ai_service.validation.allowlist import Allowlist, load_allowlist

ROLE_NAME = "ai_readonly"
SERVICE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ALLOWLIST = SERVICE_ROOT / "knowledge" / "allowlist.readonly_erp.json"
ROLE_SETTINGS: tuple[tuple[str, str], ...] = (
    ("default_transaction_read_only", "on"),
    ("statement_timeout", "'5s'"),
    ("lock_timeout", "'2s'"),
    ("idle_in_transaction_session_timeout", "'10s'"),
    ("row_security", "on"),
)


def granted_columns(allowlist: Allowlist) -> dict[str, tuple[str, ...]]:
    """Unión, por tabla, de las columnas que algún rol de la allowlist puede leer (orden estable)."""
    union: dict[str, set[str]] = {}
    for grants in allowlist.roles.values():
        for table, columns in grants.items():
            union.setdefault(table, set()).update(columns)
    return {table: tuple(sorted(columns)) for table, columns in sorted(union.items())}


def build_role_sql(allowlist: Allowlist, role: str = ROLE_NAME) -> str:
    """SQL que crea el rol sin privilegios y concede ``SELECT`` solo por columna."""
    schema = allowlist.schema
    lines = [
        f"-- Rol de solo lectura del asistente. Generado desde la allowlist {allowlist.version}.",
        "-- REVISAR antes de aplicar. Contrasena: variable de psql (-v ai_password=...), nunca en este archivo.",
        "BEGIN;",
        "",
        f"CREATE ROLE {role} LOGIN PASSWORD :'ai_password'",
        "  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 5;",
        "",
        f"REVOKE ALL ON SCHEMA {schema} FROM {role};",
        f"REVOKE ALL ON ALL TABLES IN SCHEMA {schema} FROM {role};",
        f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA {schema} FROM {role};",
        f"REVOKE ALL ON ALL FUNCTIONS IN SCHEMA {schema} FROM {role};",
        f"GRANT USAGE ON SCHEMA {schema} TO {role};",
        "",
        "-- Solo SELECT y solo sobre las columnas de la allowlist (nada de INSERT/UPDATE/DELETE/TRUNCATE).",
    ]
    for table, columns in granted_columns(allowlist).items():
        lines.append(f"GRANT SELECT ({', '.join(columns)}) ON {schema}.{table} TO {role};")
    lines.append("")
    lines.append("-- Valores por defecto de toda sesion del rol (el Executor los vuelve a fijar por transaccion).")
    for name, value in ROLE_SETTINGS:
        lines.append(f"ALTER ROLE {role} SET {name} = {value};")
    lines.append(f"ALTER ROLE {role} SET search_path = {schema}, pg_catalog;")
    lines += ["", "COMMIT;", ""]
    return "\n".join(lines)


def main() -> int:
    sys.stdout.write(build_role_sql(load_allowlist(DEFAULT_ALLOWLIST)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
