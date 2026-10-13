"""Pruebas de las barreras de prueba (T002) y de la configuración segura (T006)."""

from __future__ import annotations

import os
import socket

from guards import (
    ForbiddenEnvironmentAccess,
    GuardedTestCase,
    NetworkAccessBlocked,
)

from ai_service.config import safety
from ai_service.config.safety import (
    TEST_DATABASE_ENV_VAR,
    UnsafeDatabaseConfig,
    load_disposable_database_config,
    load_from_process_environment,
)

SECRET = "s3cr3t-no-debe-aparecer"


def _env(url: str) -> dict[str, str]:
    return {TEST_DATABASE_ENV_VAR: url}


class GuardTests(GuardedTestCase):
    """T002: las propias barreras funcionan."""

    # Pruebas deliberadas de las barreras: usan el mecanismo explícito y acotado
    # ``expect_isolation_violation``, que además exige que la violación ocurra.

    def test_network_connection_is_blocked(self) -> None:
        with self.expect_isolation_violation("network"), self.assertRaises(NetworkAccessBlocked):
            socket.create_connection(("example.com", 443))

    def test_socket_connect_is_blocked(self) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.addCleanup(sock.close)
        with self.expect_isolation_violation("network"), self.assertRaises(NetworkAccessBlocked):
            sock.connect(("127.0.0.1", 5432))

    def test_name_resolution_is_blocked(self) -> None:
        with self.expect_isolation_violation("network"), self.assertRaises(NetworkAccessBlocked):
            socket.getaddrinfo("localhost", 5432)

    def test_reading_forbidden_variables_fails(self) -> None:
        for name in ("DATABASE_URL", "DATABASE_URL_READONLY"):
            with self.subTest(name=name):
                with self.expect_isolation_violation("environment"):
                    with self.assertRaises(ForbiddenEnvironmentAccess):
                        os.environ.get(name)
                    with self.assertRaises(ForbiddenEnvironmentAccess):
                        os.getenv(name)
                    with self.assertRaises(ForbiddenEnvironmentAccess):
                        _ = name in os.environ

    def test_other_variables_remain_readable(self) -> None:
        os.environ["AI_ASSISTANT_GUARD_PROBE"] = "ok"
        self.assertEqual(os.getenv("AI_ASSISTANT_GUARD_PROBE"), "ok")


class DisposableConfigTests(GuardedTestCase):
    """T006: configuración de base de pruebas con fallo seguro."""

    def test_valid_local_disposable_database(self) -> None:
        config = load_disposable_database_config(
            _env(f"postgresql://tester:{SECRET}@localhost:5433/ai_test_finanzas")
        )
        self.assertEqual(config.host, "localhost")
        self.assertEqual(config.port, 5433)
        self.assertEqual(config.database, "ai_test_finanzas")
        self.assertNotIn(SECRET, repr(config))
        self.assertNotIn(SECRET, str(config))

    def test_missing_configuration_is_incomplete(self) -> None:
        for env in ({}, _env(""), _env("   ")):
            with self.subTest(env=env), self.assertRaises(UnsafeDatabaseConfig):
                load_disposable_database_config(env)

    def test_forbidden_variables_cannot_be_the_source(self) -> None:
        for name in ("DATABASE_URL", "DATABASE_URL_READONLY"):
            with self.subTest(name=name), self.assertRaises(UnsafeDatabaseConfig):
                load_disposable_database_config(
                    {name: "postgresql://u:p@localhost/ai_test_x"}, var_name=name
                )

    def test_rejected_urls(self) -> None:
        rejected = {
            "neon": f"postgresql://u:{SECRET}@ep-demo-123.us-east-2.aws.neon.tech/ai_test_x",
            "remote": f"postgresql://u:{SECRET}@db.example.com/ai_test_x",
            "scheme": f"mysql://u:{SECRET}@localhost/ai_test_x",
            "no-host": "postgresql:///ai_test_x",
            "no-prefix": f"postgresql://u:{SECRET}@localhost/polleria",
            "bad-port": f"postgresql://u:{SECRET}@localhost:notaport/ai_test_x",
        }
        for case, url in rejected.items():
            with self.subTest(case=case):
                with self.assertRaises(UnsafeDatabaseConfig) as ctx:
                    load_disposable_database_config(_env(url))
                self.assertNotIn(SECRET, str(ctx.exception))

    def test_explicit_allowed_hosts(self) -> None:
        config = load_disposable_database_config(
            _env("postgresql://u:p@ci-db/ai_test_ci"), allowed_hosts=frozenset({"ci-db"})
        )
        self.assertEqual(config.host, "ci-db")

    def test_process_environment_reads_only_the_test_variable(self) -> None:
        os.environ[TEST_DATABASE_ENV_VAR] = "postgresql://u:p@127.0.0.1/ai_test_env"
        config = load_from_process_environment()  # no lanza ForbiddenEnvironmentAccess
        self.assertEqual(config.database, "ai_test_env")

    def test_process_environment_missing_variable_fails_safely(self) -> None:
        os.environ.pop(TEST_DATABASE_ENV_VAR, None)
        with self.assertRaises(UnsafeDatabaseConfig):
            load_from_process_environment()

    def test_module_does_not_import_database_drivers(self) -> None:
        for name in ("psycopg", "psycopg2", "asyncpg", "socket"):
            self.assertFalse(hasattr(safety, name), name)
