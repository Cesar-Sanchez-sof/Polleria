"""Comprobación de seguridad sin red: las optimizaciones no abren el acceso a escritura ni a datos restringidos.

Uso (desde ``ai-service/``, con ``PYTHONPATH=src``)::

    python -m ai_service.perf.security_check

Usa el validador AST real con ``knowledge/allowlist.readonly_erp.json`` (la de la base real) y el
``PostgresReadOnlyExecutor`` **con el pool activado** (``AI_PERF_OPT``). Su fábrica de conexiones lanza un
error si alguien la llama: un caso solo pasa si se rechaza ANTES de tocar la base. No hay conexión a Neon,
OpenAI, Milvus ni XiYanSQL. Termina con código ≠ 0 si algún caso no se rechaza.
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

from ai_service.orchestrator.ports import AuthorizationContext, SqlExecutionError
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator, Verdict

SERVICE_ROOT = Path(__file__).resolve().parents[3]
ROLE = "contador_demo"
AUTH = AuthorizationContext(rol=ROLE, origen="erp-session", autenticado=True, modulos=None)

SQL_CASES: tuple[tuple[str, str], ...] = (
    ("INSERT (escritura)", "INSERT INTO sales_order (code, status) VALUES ('X', 'Open')"),
    ("UPDATE (escritura)", "UPDATE product SET price = 0"),
    ("DELETE (escritura)", "DELETE FROM journal_entry"),
    ("DROP (DDL)", "DROP TABLE product"),
    ("TRUNCATE (escritura)", "TRUNCATE cash_movement"),
    ("dos sentencias", "SELECT id FROM product; DELETE FROM product"),
    ("tabla de usuarios", 'SELECT username, password FROM "user"'),
    ("tabla de roles", "SELECT name FROM role"),
    ("auditoría", "SELECT id, action FROM audit_log"),
    ("RUC de proveedores (columna personal)", "SELECT business_name, ruc FROM supplier"),
    ("función peligrosa", "SELECT pg_sleep(10)"),
    ("lectura de archivos", "SELECT pg_read_file('/etc/passwd')"),
)


class _ForbiddenFactory:
    """Fábrica de conexiones que falla si se invoca: demuestra que el rechazo ocurre antes de la base."""

    def __init__(self) -> None:
        self.calls = 0

    def __call__(self):
        self.calls += 1
        raise AssertionError("la base no debía contactarse")


class _NotReadOnlyConnection:
    """Conexión simulada cuya sesión NO es de solo lectura (para el caso de la comprobación READ ONLY)."""

    def __init__(self) -> None:
        self.queries: list[str] = []

    @contextmanager
    def transaction(self):
        yield

    def execute(self, sql, params=None):
        self.queries.append(sql)
        if sql == "SHOW transaction_read_only":
            return SimpleNamespace(fetchone=lambda: ("off",))
        return SimpleNamespace()

    def close(self) -> None:
        pass


def _say(ok: bool, case: str, detail: str) -> bool:
    print(f"[SECURITY] {'RECHAZADO' if ok else 'FALLO    '} {case:<40} {detail}")
    return ok


def main() -> int:
    from ai_service.execution.postgres_readonly import PostgresReadOnlyExecutor

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    allowlist = load_allowlist(SERVICE_ROOT / "knowledge" / "allowlist.readonly_erp.json")
    validator = SqlValidator(allowlist)
    factory = _ForbiddenFactory()
    executor = PostgresReadOnlyExecutor(factory, validator, accepted_origins=frozenset({"erp-session"}), pool=True)
    print(f"[SECURITY] Validador AST real · allowlist {allowlist.version} · rol {ROLE} · executor con pool (AI_PERF_OPT)")
    results: list[bool] = []

    for case, sql in SQL_CASES:
        verdict = validator.validate(sql, ROLE)
        if verdict.approved:
            results.append(_say(False, case, "el validador lo APROBÓ"))
            continue
        try:
            executor.execute_authorized(verdict, AUTH)
        except SqlExecutionError as exc:
            refused = exc.code
        else:  # pragma: no cover - el executor nunca ejecuta un veredicto rechazado
            refused = "EJECUTADO"
        ok = refused != "EJECUTADO" and factory.calls == 0
        results.append(_say(ok, case, f"motivos={','.join(verdict.reasons[:3])} executor={refused} base=no contactada"))

    # Un veredicto aprobado falsificado (sin pasar por el validador) se revalida y se rechaza.
    forged = Verdict(approved=True, reasons=(), normalized_sql="DELETE FROM product")
    try:
        executor.execute_authorized(forged, AUTH)
        refused = "EJECUTADO"
    except SqlExecutionError as exc:
        refused = exc.code
    results.append(_say(refused != "EJECUTADO" and factory.calls == 0, "veredicto falsificado", f"executor={refused} base=no contactada"))

    # SQL contable sin el filtro de asientos registrados (P-4): rechazado aunque sea un SELECT válido.
    p4 = validator.validate(
        "SELECT SUM(jed.debit) AS total FROM journal_entry_detail jed JOIN journal_entry je ON je.id = jed.entry_id", ROLE
    )
    try:
        executor.execute_authorized(p4, AUTH) if p4.approved else None
        refused = "EJECUTADO" if p4.approved else "VALIDADOR"
    except SqlExecutionError as exc:
        refused = exc.code
    results.append(_say(refused != "EJECUTADO" and factory.calls == 0, "asientos sin filtro P-4", f"executor={refused} base=no contactada"))

    # Conexión reutilizada del pool cuya sesión no es READ ONLY: se rechaza antes de la consulta.
    connection = _NotReadOnlyConnection()
    pooled = PostgresReadOnlyExecutor(lambda: connection, validator, accepted_origins=frozenset({"erp-session"}), pool=True)
    select = validator.validate("SELECT name FROM product", ROLE)
    try:
        pooled.execute_authorized(select, AUTH)
        refused = "EJECUTADO"
    except SqlExecutionError as exc:
        refused = exc.code
    ran_query = "SELECT name FROM product" in " ".join(connection.queries)
    results.append(_say(refused == "READ_ONLY_NOT_ENFORCED" and not ran_query, "sesión sin READ ONLY (pool)",
                        f"executor={refused} consulta_enviada={'sí' if ran_query else 'no'}"))

    passed = sum(results)
    print(f"[SECURITY] Resultado: {passed}/{len(results)} casos rechazados correctamente"
          + ("" if passed == len(results) else " — HAY FALLOS"))
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
