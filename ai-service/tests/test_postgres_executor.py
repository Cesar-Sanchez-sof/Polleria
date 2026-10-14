"""``PostgresReadOnlyExecutor`` con conexiones SIMULADAS (sin psycopg, sin red, sin base de datos).

La conexión falsa imita la API de ``psycopg`` 3 que usa el Executor y registra cada sentencia. Las
cadenas de conexión son ficticias (dominio ``.invalid``) y nunca se leen variables reales.
"""

from __future__ import annotations

import importlib
import secrets
import sys
from contextlib import contextmanager
from decimal import Decimal
from importlib.abc import MetaPathFinder
from pathlib import Path
from types import SimpleNamespace

from guards import GuardedTestCase
from sqlgen_support import NOW, FakeInferenceServer, payload, xiyan_env

from ai_service.assembly import REAL_DB_ACCEPTED_ORIGINS, build_dev_orchestrator
from ai_service.config.settings import (
    IDENTITY_KEY_VAR,
    READONLY_DSN_VAR,
    SQL_EXECUTOR_VAR,
    SQL_GENERATOR_VAR,
    SQLGEN_TOKEN_VAR,
    ServiceConfigError,
    load_service_settings,
)
from ai_service.execution.postgres_readonly import (
    MAX_ROWS,
    READ_ONLY_CHECK,
    SESSION_STATEMENTS,
    PostgresReadOnlyExecutor,
    psycopg_connection_factory,
)
from ai_service.orchestrator.ports import (
    AuthorizationContext,
    ExecutionFailed,
    ExecutionRefused,
    ExecutionTimeout,
    ExecutionUnavailable,
    ResultTooLarge,
    SqlExecutionError,
)
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator, Verdict

ROOT = Path(__file__).resolve().parents[1]
FAKE_DSN = "postgresql://lector_ficticio:clave_ficticia@db-ficticia.invalid:5432/ficticia"
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.readonly_erp.json")
VALIDATOR = SqlValidator(ALLOWLIST)
CONTADOR = AuthorizationContext(rol="contador_demo")
VERIFIED = AuthorizationContext(rol="contador_demo", origen="erp-session", autenticado=True)
IDENTITY_KEY = secrets.token_hex(32)
SALDO_SQL = (
    "SELECT aa.code AS account_code, aa.type AS account_type, SUM(jed.debit) AS total_debit, "
    "SUM(jed.credit) AS total_credit FROM journal_entry_detail jed JOIN accounting_account aa ON aa.id = jed.account_id "
    "JOIN journal_entry je ON je.id = jed.entry_id WHERE aa.code = '101' AND je.entry_date >= DATE '2026-09-01' "
    "AND je.entry_date < DATE '2026-10-01' AND je.status = TRUE GROUP BY aa.code, aa.type"
)
REAL_ENV = {SQL_EXECUTOR_VAR: "postgres_readonly", READONLY_DSN_VAR: FAKE_DSN, IDENTITY_KEY_VAR: IDENTITY_KEY}
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


class SettingsTests(GuardedTestCase):
    def test_fixture_executor_is_default_and_dsn_is_not_read(self) -> None:
        class Recording(dict):
            def __init__(self, data):
                super().__init__(data)
                self.read = []

            def get(self, key, default=None):
                self.read.append(key)
                return super().get(key, default)

        env = Recording({**xiyan_env(), READONLY_DSN_VAR: FAKE_DSN})
        settings = load_service_settings(env)
        self.assertEqual((settings.sql_executor, settings.readonly_dsn), ("ficticio", None))
        self.assertNotIn(READONLY_DSN_VAR, env.read)  # su presencia no activa nada

    def test_explicit_activation(self) -> None:
        settings = load_service_settings({**xiyan_env(), **REAL_ENV})
        self.assertEqual(settings.sql_executor, "postgres_readonly")
        self.assertNotIn("clave_ficticia", repr(settings))
        self.assertNotIn("db-ficticia", repr(settings))

    def test_invalid_configurations(self) -> None:
        cases = {
            "valor-desconocido": {SQL_EXECUTOR_VAR: "postgres"},
            "sin-dsn": {SQL_EXECUTOR_VAR: "postgres_readonly"},
            "dsn-no-postgres": {SQL_EXECUTOR_VAR: "postgres_readonly", READONLY_DSN_VAR: "mysql://x:y@h/db"},
            "con-generador-simulado": {**REAL_ENV, SQL_GENERATOR_VAR: "simulado"},
            "sin-clave-de-identidad-p9": {SQL_EXECUTOR_VAR: "postgres_readonly", READONLY_DSN_VAR: FAKE_DSN},
            "clave-de-identidad-corta": {**REAL_ENV, IDENTITY_KEY_VAR: secrets.token_hex(8)},
        }
        for name, overrides in cases.items():
            with self.subTest(case=name), self.assertRaises(ServiceConfigError) as ctx:
                load_service_settings({**xiyan_env(), **overrides})
            self.assertNotIn("clave_ficticia", str(ctx.exception))


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
            ("SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '5s'", "SET LOCAL lock_timeout = '2s'"),
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
        saved = sys.modules.pop("ai_service.execution.postgres_readonly", None)
        try:
            importlib.import_module("ai_service.execution.postgres_readonly")
        finally:
            if saved is not None:
                sys.modules["ai_service.execution.postgres_readonly"] = saved
        self.assertEqual(self.blocker.attempts, [])
        self.assertNotIn("psycopg", sys.modules)

    def test_missing_driver_is_controlled(self) -> None:
        factory = psycopg_connection_factory(FAKE_DSN)
        with self.assertRaises(ExecutionUnavailable) as ctx:
            make_executor(factory).execute_authorized(approved(), CONTADOR)  # type: ignore[arg-type]
        self.assertEqual(ctx.exception.code, "DRIVER_MISSING")
        self.assertNotIn("clave_ficticia", repr(ctx.exception))


class PipelineTests(GuardedTestCase):
    def build(self, connection: FakeConnection | None = None):
        env = {**xiyan_env(), **REAL_ENV}
        settings = load_service_settings(env)
        server = FakeInferenceServer(env[SQLGEN_TOKEN_VAR])
        factory = Factory(connection)
        orchestrator, _audit = build_dev_orchestrator(
            settings, clock=lambda: NOW, sqlgen_transport=server.transport(), readonly_connection_factory=factory
        )
        return orchestrator, server, factory

    def test_real_mode_requires_verified_identity(self) -> None:
        orchestrator, server, factory = self.build()
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"))  # rol provisional
        self.assertEqual((outcome.status_code, outcome.body.estado), (200, "no_resoluble"))
        self.assertEqual(outcome.audit.codigos_rechazo[:2], ["SQLGEN_NOT_AUTHORIZED", "UNTRUSTED_AUTHORIZATION"])
        self.assertEqual((server.requests, factory.calls), ([], 0))  # ni modelo ni base de datos
        self.assertEqual(outcome.body.versiones["executor"], "postgres-readonly")

    def test_real_mode_with_verified_identity_applies_p4_filter(self) -> None:
        connection = FakeConnection()
        orchestrator, server, factory = self.build(connection)
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"), authorization=VERIFIED)
        self.assertEqual(outcome.body.estado, "respondida")
        self.assertEqual((len(server.requests), factory.calls), (1, 1))
        executed = connection.statements[-1]
        self.assertIn("je.status = TRUE", executed)  # filtro de asientos registrados añadido por código
        self.assertIn("public.journal_entry AS je", executed)
        self.assertIn("LIMIT 200", executed)

    def test_verified_role_must_match_the_request(self) -> None:
        orchestrator, server, factory = self.build()
        other = AuthorizationContext(rol="lector_demo", origen="erp-session", autenticado=True)
        outcome = orchestrator.handle(payload("Saldo de caja en septiembre"), authorization=other)
        self.assertEqual(outcome.status_code, 403)
        self.assertEqual((server.requests, factory.calls), ([], 0))

    def swap_in_executor(self, connection: FakeConnection, origins=REAL_DB_ACCEPTED_ORIGINS):
        """Orquestador en modo real con el Executor sobre una conexión simulada y orígenes dados."""
        orchestrator, server, _ = self.build()
        factory = Factory(connection)
        orchestrator._executor = PostgresReadOnlyExecutor(factory, orchestrator._validator, accepted_origins=origins)
        return orchestrator, factory

    def test_pipeline_passes_authorization_and_computes_from_returned_totals(self) -> None:
        connection = FakeConnection()
        orchestrator, factory = self.swap_in_executor(connection)
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"), authorization=VERIFIED)
        self.assertEqual(outcome.body.estado, "respondida")
        self.assertEqual({f.marcador: f.valor for f in outcome.body.cifras},
                         {"c1": Decimal("1149.60"), "c2": Decimal("1800.00"), "c3": Decimal("650.40")})
        self.assertEqual(factory.calls, 1)
        self.assertIn("LIMIT 200", connection.statements[-1])  # SQL regenerado y acotado por el validador

    def test_pipeline_error_classification(self) -> None:
        cases = {
            "sin-permisos": (FakeConnection(error=DbError("42501")), 503, ["SQLEXEC_UNAVAILABLE", "READ_PERMISSION_MISSING"]),
            "timeout": (FakeConnection(error=DbError("57014")), 503, ["SQLEXEC_TIMEOUT", "STATEMENT_TIMEOUT"]),
            "demasiadas-filas": (
                FakeConnection(rows=[("101", "Activo", Decimal("1"), Decimal("1"))] * (MAX_ROWS + 1)),
                200,
                ["SQLEXEC_RESULT_TOO_LARGE", "ROW_LIMIT_EXCEEDED"],
            ),
        }
        for name, (connection, status, codes) in cases.items():
            with self.subTest(case=name):
                orchestrator, _ = self.swap_in_executor(connection)
                outcome = orchestrator.handle(payload("Saldo de caja en septiembre", trace=f"traza-pg-{name}"), authorization=VERIFIED)
                self.assertEqual(outcome.status_code, status)
                self.assertEqual(outcome.audit.codigos_rechazo[:2], codes)
                self.assertEqual(outcome.body.model_dump().get("cifras", []), [])

    def test_untrusted_origin_in_pipeline_is_no_resoluble_without_connection(self) -> None:
        orchestrator, factory = self.swap_in_executor(FakeConnection(), origins=frozenset())
        outcome = orchestrator.handle(payload("Saldo de caja en septiembre"), authorization=VERIFIED)
        self.assertEqual(outcome.body.estado, "no_resoluble")
        self.assertEqual(outcome.audit.codigos_rechazo[:2], ["SQLEXEC_REFUSED", "UNTRUSTED_AUTHORIZATION"])
        self.assertEqual(factory.calls, 0)


class ProbeTests(GuardedTestCase):
    """Comprobación segura de la conexión real con una conexión simulada (sin filas de negocio)."""

    class CatalogConnection(FakeConnection):
        def __init__(self, denied: frozenset[str] = frozenset(), writable: frozenset[str] = frozenset(), **kwargs) -> None:
            super().__init__(**kwargs)
            self.denied = denied
            self.writable = writable
            self.params: list = []

        def execute(self, sql, params=None):
            assert self.in_transaction
            self.statements.append(sql)
            self.params.append(params)
            if sql == READ_ONLY_CHECK:
                return SimpleNamespace(fetchone=lambda: (self.read_only,))
            if sql.startswith("SET "):
                return SimpleNamespace()
            if self.error is not None:
                raise self.error
            if sql == "SELECT 1":
                return SimpleNamespace(fetchone=lambda: (1,))
            if "INSERT" in sql:
                return SimpleNamespace(fetchone=lambda: (any(params[0].endswith(w) for w in self.writable),))
            target = ".".join(params[:2]) if "column" in sql else params[0]
            return SimpleNamespace(fetchone=lambda: (not any(target.endswith(d) for d in self.denied),))

    def test_probe_runs_only_safe_catalog_queries(self) -> None:
        from ai_service.execution.postgres_readonly import probe_connection

        connection = self.CatalogConnection()
        result = probe_connection(Factory(connection), ALLOWLIST)
        self.assertEqual((result["select_1"], result["read_only"]), (True, True))
        self.assertTrue(all(all(cols.values()) for cols in result["privileges"].values()))
        self.assertEqual(result["writable"], [])
        self.assertEqual(connection.statements[:4], [*SESSION_STATEMENTS, READ_ONLY_CHECK])
        allowed = ("SET ", READ_ONLY_CHECK, "SELECT 1", "SELECT has_table_privilege(", "SELECT has_column_privilege(")
        self.assertTrue(all(statement.startswith(allowed) for statement in connection.statements))
        self.assertNotIn("FROM", " ".join(connection.statements))  # nunca lee tablas de negocio

    def test_probe_reports_missing_privileges_and_classifies_errors(self) -> None:
        from ai_service.execution.postgres_readonly import probe_connection

        result = probe_connection(Factory(self.CatalogConnection(denied=frozenset({"journal_entry.status"}))), ALLOWLIST)
        self.assertFalse(result["privileges"]["journal_entry"]["status"])
        writable = probe_connection(Factory(self.CatalogConnection(writable=frozenset({"journal_entry"}))), ALLOWLIST)
        self.assertEqual(writable["writable"], ["journal_entry"])  # un rol con escritura se detecta
        with self.assertRaises(ExecutionUnavailable) as ctx:
            probe_connection(Factory(self.CatalogConnection(error=DbError("42501"))), ALLOWLIST)
        self.assertEqual(ctx.exception.code, "READ_PERMISSION_MISSING")
        self.assertNotIn("clave_ficticia", repr(ctx.exception))
