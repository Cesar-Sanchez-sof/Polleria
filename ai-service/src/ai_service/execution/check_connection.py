"""Comprobación manual y segura de ``DATABASE_URL_READONLY`` (no se ejecuta en pruebas).

Uso, desde ``ai-service/``::

    set PYTHONPATH=src && .venv\\Scripts\\python.exe -m ai_service.execution.check_connection

Lee solo ``DATABASE_URL_READONLY`` (del entorno o de ``ai-service/.env``; nunca ``DATABASE_URL``) y
ejecuta :func:`probe_connection`: ``SELECT 1``, modo de solo lectura, privilegios SELECT del catálogo
para la allowlist financiera estricta y ausencia de privilegios de escritura del rol. No lee filas de negocio ni ejecuta SQL generado por IA. Nunca imprime
la cadena de conexión.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from ai_service.config.settings import READONLY_DSN_VAR, read_dotenv_keys
from ai_service.execution.postgres_readonly import probe_connection, psycopg_connection_factory
from ai_service.orchestrator.ports import SqlExecutionError
from ai_service.validation.allowlist import load_allowlist

SERVICE_ROOT = Path(__file__).resolve().parents[3]


def main() -> int:
    dsn = os.environ.get(READONLY_DSN_VAR, "").strip() or read_dotenv_keys(SERVICE_ROOT / ".env").get(READONLY_DSN_VAR, "")
    if not dsn.startswith(("postgresql://", "postgres://")):
        print(f"{READONLY_DSN_VAR}: no configurada o inválida (valor no mostrado).")
        return 2
    allowlist = load_allowlist(SERVICE_ROOT / "knowledge" / "allowlist.readonly_erp.json")
    try:
        result = probe_connection(psycopg_connection_factory(dsn), allowlist)
    except SqlExecutionError as exc:
        print(f"Conexión no verificada: {exc.category}/{exc.code}")
        return 1
    finally:
        del dsn
    print(f"SELECT 1: {'OK' if result['select_1'] else 'FALLO'} | sesión de solo lectura: {'sí' if result['read_only'] else 'NO'}")
    missing = [f"{t}.{c}" for t, cols in result["privileges"].items() for c, ok in cols.items() if not ok]  # type: ignore[union-attr]
    print("Privilegios SELECT de la allowlist:", "completos" if not missing else f"faltan {missing}")
    writable = result["writable"]
    print("Privilegios de escritura del rol:", "ninguno (solo lectura)" if not writable else f"PRESENTES en {writable}")
    return 0 if result["select_1"] and result["read_only"] and not missing and not writable else 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
