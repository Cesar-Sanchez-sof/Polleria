"""``PostgresReadOnlyExecutor`` con conexiones SIMULADAS (sin psycopg, sin red, sin base de datos).

La conexión falsa imita la API de ``psycopg`` 3 que usa el Executor y registra cada sentencia. Las
cadenas de conexión son ficticias (dominio ``.invalid``) y nunca se leen variables reales.
"""

from __future__ import annotations

import importlib
import sys
from contextlib import contextmanager
from decimal import Decimal
from importlib.abc import MetaPathFinder
from pathlib import Path
from types import SimpleNamespace

from guards import GuardedTestCase

from agents_service.execution.postgres_readonly import (
    MAX_ROWS,
    READ_ONLY_CHECK,
    SESSION_STATEMENTS,
    PostgresReadOnlyExecutor,
    psycopg_connection_factory,
)
from agents_service.gemini_sql.agent import ACCEPTED_ORIGIN
from agents_service.orchestrator.ports import (
    AuthorizationContext,
    ExecutionFailed,
    ExecutionRefused,
    ExecutionTimeout,
    ExecutionUnavailable,
    ResultTooLarge,
    SqlExecutionError,
)
from agents_service.validation.allowlist import load_allowlist
from agents_service.validation.validator import SqlValidator, Verdict

ROOT = Path(__file__).resolve().parents[1]
FAKE_DSN = "postgresql://lector_ficticio:clave_ficticia@db-ficticia.invalid:5432/ficticia"
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.readonly_erp.json")
VALIDATOR = SqlValidator(ALLOWLIST)
CONTADOR = AuthorizationContext(rol="contador_demo")
VERIFIED = AuthorizationContext(rol="contador_demo", origen="erp-session", autenticado=True)
REAL_DB_ACCEPTED_ORIGINS = frozenset({ACCEPTED_ORIGIN})  # P-9: solo identidad verificada
SALDO_SQL = (
    "SELECT aa.code AS account_code, aa.type AS account_type, SUM(jed.debit) AS total_debit, "
    "SUM(jed.credit) AS total_credit FROM journal_entry_detail jed JOIN accounting_account aa ON aa.id = jed.account_id "
    "JOIN journal_entry je ON je.id = jed.entry_id WHERE aa.code = '101' AND je.entry_date >= DATE '2026-09-01' "
    "AND je.entry_date < DATE '2026-10-01' AND je.status = TRUE GROUP BY aa.code, aa.type"
)
NAMES = ("account_code", "account_type", "total_debit", "total_credit")


def approved(sql: str = SALDO_SQL, role: str = "contador_demo") -> Verdict:
    verdict = VALIDATOR.validate(sql, role)
    assert verdict.approved, verdict.reasons
    return verdict


class DbError(Exception):
    """Error simulado del controlador; su mensaje incluye datos que nunca deben propagarse."""

    def __init__(self, sqlstate: str | None) -> None:
        super().__init__(f"fallo en db-ficticia.invalid con {FAKE_DSN} ejecutando SELECT secreto")
        self.sqlstate = sqlstate


class FakeConnection:
    def __init__(self, rows=(("101", "Activo", Decimal("1800.00"), Decimal("650.40")),), names=NAMES,
                 read_only: str = "on", error: Exception | None = None) -> None:
        self.rows, self.names, self.read_only, self.error = list(rows), names, read_only, error
        self.statements: list[str] = []
        self.in_transaction = False
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True
        return False

    @contextmanager
    def transaction(self):
        self.in_transaction = True
        try:
            yield
        finally:
            self.in_transaction = False

    def execute(self, sql, params=None):
        assert self.in_transaction, "toda sentencia debe ejecutarse dentro de la transacción"
        assert params is None
        self.statements.append(sql)
        if sql == READ_ONLY_CHECK:
            return SimpleNamespace(fetchone=lambda: (self.read_only,))
        if sql.startswith("SET "):
            return SimpleNamespace()
        if self.error is not None:
            raise self.error
        return SimpleNamespace(
            description=[SimpleNamespace(name=n) for n in self.names],
            fetchmany=lambda size: self.rows[:size],
        )


class Factory:
    def __init__(self, connection: FakeConnection | None = None) -> None:
        self.connection = connection or FakeConnection()
        self.calls = 0

    def __call__(self):
        self.calls += 1
        return self.connection


def make_executor(factory: Factory, origins=frozenset({"ct-b-provisional"})) -> PostgresReadOnlyExecutor:
    return PostgresReadOnlyExecutor(factory, VALIDATOR, accepted_origins=origins)


class RefusalTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = Factory()

    def assert_refused(self, call, code: str) -> None:
        with self.assertRaises(ExecutionRefused) as ctx:
            call()
        self.assertEqual(ctx.exception.code, code)
        self.assertEqual(self.factory.calls, 0)  # nunca se abre una conexión

    def test_execute_without_authorization_context_is_always_refused(self) -> None:
        self.assert_refused(lambda: make_executor(self.factory).execute(approved()), "AUTHORIZATION_REQUIRED")

    def test_unapproved_or_forged_verdicts(self) -> None:
        executor = make_executor(self.factory)
        self.assert_refused(lambda: executor.execute_authorized(Verdict(False, ("X",)), CONTADOR), "UNAPPROVED_SQL")
        self.assert_refused(lambda: executor.execute_authorized(SALDO_SQL, CONTADOR), "UNAPPROVED_SQL")  # type: ignore[arg-type]
        forged = {
            "escritura": "DELETE FROM journal_entry",
            "varias-sentencias": "SELECT 1; DROP TABLE journal_entry",
            "funcion-peligrosa": "SELECT pg_sleep(5)",
            "set-config": "SELECT set_config('statement_timeout', '0', false)",
            "columna-p4": "SELECT je.status FROM journal_entry je",
            "tabla-fuera-de-alcance": "SELECT u.email FROM app_user u",
            "catalogo": "SELECT usename FROM pg_catalog.pg_user",
            "sin-normalizar": SALDO_SQL,  # aprobado pero no normalizado por el validador
        }
        for name, sql in forged.items():
            with self.subTest(case=name):
                self.assert_refused(
                    lambda s=sql: executor.execute_authorized(Verdict(True, (), s, frozenset()), CONTADOR),
                    "REVALIDATION_FAILED",
                )

    def test_scope_of_the_request_role_is_enforced(self) -> None:
        lector = AuthorizationContext(rol="lector_demo")
        self.assert_refused(lambda: make_executor(self.factory).execute_authorized(approved(), lector), "REVALIDATION_FAILED")
        unknown = AuthorizationContext(rol="admin")
        self.assert_refused(lambda: make_executor(self.factory).execute_authorized(approved(), unknown), "REVALIDATION_FAILED")

    def test_untrusted_origin_and_production_default(self) -> None:
        self.assertEqual(REAL_DB_ACCEPTED_ORIGINS, frozenset({"erp-session"}))  # P-9: solo identidad verificada
        self.assert_refused(
            lambda: make_executor(self.factory, REAL_DB_ACCEPTED_ORIGINS).execute_authorized(approved(), CONTADOR),
            "UNTRUSTED_AUTHORIZATION",
        )
        with self.assertRaises(ValueError):  # no se puede fabricar un contexto "verificado" incoherente
            AuthorizationContext(rol="contador_demo", origen="erp-session", autenticado=False)
        with self.assertRaises(ValueError):
            AuthorizationContext(rol="contador_demo", origen="ct-b-provisional", autenticado=True)

    def test_sql_without_registered_entries_filter_is_refused(self) -> None:
        unfiltered = approved(SALDO_SQL.replace(" AND je.status = TRUE", ""))
        self.assert_refused(
            lambda: make_executor(self.factory, REAL_DB_ACCEPTED_ORIGINS).execute_authorized(unfiltered, VERIFIED),
            "REGISTERED_FILTER_MISSING",
        )
        voided = approved(SALDO_SQL.replace("je.status = TRUE", "je.status = FALSE"))
        self.assert_refused(
            lambda: make_executor(self.factory, REAL_DB_ACCEPTED_ORIGINS).execute_authorized(voided, VERIFIED),
            "REGISTERED_FILTER_MISSING",
        )

    def test_row_limit_is_bounded(self) -> None:
        with self.assertRaises(ValueError):
            PostgresReadOnlyExecutor(self.factory, VALIDATOR, accepted_origins=frozenset({"x"}), max_rows=MAX_ROWS + 1)


class ExecutionTests(GuardedTestCase):
    def test_read_only_session_and_exact_statements(self) -> None:
        connection = FakeConnection()
        verdict = approved()
        rows = make_executor(Factory(connection)).execute_authorized(verdict, CONTADOR)
        self.assertEqual(rows, [dict(zip(NAMES, ("101", "Activo", Decimal("1800.00"), Decimal("650.40"))))])
        self.assertEqual(connection.statements, [*SESSION_STATEMENTS, READ_ONLY_CHECK, verdict.normalized_sql])
        self.assertEqual(
            SESSION_STATEMENTS,
            (
                "SET TRANSACTION READ ONLY",
                "SET LOCAL statement_timeout = '5s'",
                "SET LOCAL lock_timeout = '2s'",
                "SET LOCAL idle_in_transaction_session_timeout = '10s'",
            ),
        )
        self.assertTrue(verdict.normalized_sql.startswith("SELECT "))
        self.assertIn("public.journal_entry_detail", verdict.normalized_sql)
        self.assertTrue(connection.closed)

    def test_session_not_read_only_is_refused_before_the_query(self) -> None:
        connection = FakeConnection(read_only="off")
        with self.assertRaises(ExecutionRefused) as ctx:
            make_executor(Factory(connection)).execute_authorized(approved(), CONTADOR)
        self.assertEqual(ctx.exception.code, "READ_ONLY_NOT_ENFORCED")
        self.assertEqual(connection.statements[-1], READ_ONLY_CHECK)  # la consulta nunca se envió

    def test_row_limit_is_not_truncated(self) -> None:
        row = ("101", "Activo", Decimal("1"), Decimal("1"))
        self.assertEqual(len(make_executor(Factory(FakeConnection(rows=[row] * MAX_ROWS))).execute_authorized(approved(), CONTADOR)), MAX_ROWS)
        with self.assertRaises(ResultTooLarge):
            make_executor(Factory(FakeConnection(rows=[row] * (MAX_ROWS + 5)))).execute_authorized(approved(), CONTADOR)

    def test_ambiguous_columns_are_rejected(self) -> None:
        connection = FakeConnection(names=("code", "code", "total_debit", "total_credit"))
        with self.assertRaises(ExecutionFailed):
            make_executor(Factory(connection)).execute_authorized(approved(), CONTADOR)

    def test_database_errors_are_classified_without_details(self) -> None:
        cases = {
            "57014": (ExecutionTimeout, "STATEMENT_TIMEOUT"),
            "55P03": (ExecutionTimeout, "LOCK_TIMEOUT"),
            "25006": (ExecutionRefused, "WRITE_BLOCKED_BY_DATABASE"),
            "42501": (ExecutionUnavailable, "READ_PERMISSION_MISSING"),
            "42P01": (ExecutionUnavailable, "READ_PERMISSION_MISSING"),
            "3F000": (ExecutionUnavailable, "READ_PERMISSION_MISSING"),
            "08006": (ExecutionUnavailable, "DATABASE_UNAVAILABLE"),
            "28P01": (ExecutionUnavailable, "DATABASE_UNAVAILABLE"),
            "42601": (ExecutionFailed, "QUERY_REJECTED_BY_DATABASE"),
            "22012": (ExecutionFailed, "QUERY_REJECTED_BY_DATABASE"),
            None: (ExecutionUnavailable, "CONNECTION_FAILED"),
        }
        for state, (kind, code) in cases.items():
            with self.subTest(sqlstate=state):
                connection = FakeConnection(error=DbError(state))
                with self.assertRaises(SqlExecutionError) as ctx:
                    make_executor(Factory(connection)).execute_authorized(approved(), CONTADOR)
                self.assertIs(type(ctx.exception), kind)
                self.assertEqual(ctx.exception.code, code)
                self.assertIsNone(ctx.exception.__cause__)
                self.assertTrue(ctx.exception.__suppress_context__)
                for leak in ("db-ficticia", "clave_ficticia", "secreto", "SELECT"):
                    self.assertNotIn(leak, str(ctx.exception))
                    self.assertNotIn(leak, repr(ctx.exception))

    def test_connection_failure_is_classified(self) -> None:
        def failing():
            raise DbError("08001")

        with self.assertRaises(ExecutionUnavailable) as ctx:
            make_executor(failing).execute_authorized(approved(), CONTADOR)  # type: ignore[arg-type]
        self.assertEqual(ctx.exception.code, "DATABASE_UNAVAILABLE")


class _BlockPsycopg(MetaPathFinder):
    def __init__(self) -> None:
        self.attempts: list[str] = []

    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".")[0] == "psycopg":
            self.attempts.append(fullname)
            raise ImportError("psycopg bloqueado en pruebas")
        return None


class LazyDriverTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.blocker = _BlockPsycopg()
        sys.meta_path.insert(0, self.blocker)
        self.addCleanup(sys.meta_path.remove, self.blocker)

    def test_importing_never_loads_psycopg(self) -> None:
        saved = sys.modules.pop("agents_service.execution.postgres_readonly", None)
        try:
            importlib.import_module("agents_service.execution.postgres_readonly")
        finally:
            if saved is not None:
                sys.modules["agents_service.execution.postgres_readonly"] = saved
        self.assertEqual(self.blocker.attempts, [])
        self.assertNotIn("psycopg", sys.modules)

    def test_missing_driver_is_controlled(self) -> None:
        factory = psycopg_connection_factory(FAKE_DSN)
        with self.assertRaises(ExecutionUnavailable) as ctx:
            make_executor(factory).execute_authorized(approved(), CONTADOR)  # type: ignore[arg-type]
        self.assertEqual(ctx.exception.code, "DRIVER_MISSING")
        self.assertNotIn("clave_ficticia", repr(ctx.exception))


