"""Pruebas de las barreras de aislamiento de ``GuardedTestCase`` (NFR-011, SC-014).

Cada comprobación ejecuta un caso de prueba **interno** con ``unittest.TestResult`` y verifica su
resultado. Los casos internos se definen dentro de una función, así que ni pytest ni unittest los
recogen como pruebas propias. Solo se usan direcciones y valores ficticios; ninguna conexión llega
a producirse porque las barreras bloquean antes.
"""

from __future__ import annotations

import os
import socket
import unittest
from collections.abc import Callable

from guards import (
    FORBIDDEN_ENV_VARS,
    ForbiddenEnvironmentAccess,
    GuardedTestCase,
    NetworkAccessBlocked,
)

FAKE_SECRET = "SECRETO_FICTICIO_123"


def run_inner(body: Callable[[GuardedTestCase], None]) -> unittest.TestResult:
    """Ejecuta ``body`` como una prueba ``GuardedTestCase`` independiente y devuelve su resultado."""

    class InnerGuardedCase(GuardedTestCase):
        def runTest(self) -> None:  # noqa: N802 (nombre requerido por unittest)
            body(self)

    result = unittest.TestResult()
    InnerGuardedCase().run(result)
    return result


def problems(result: unittest.TestResult) -> str:
    return "\n".join(text for _, text in result.failures + result.errors)


class IsolationGuardTests(GuardedTestCase):
    def test_clean_test_passes(self) -> None:
        result = run_inner(lambda case: case.assertTrue(True))
        self.assertTrue(result.wasSuccessful(), problems(result))

    def test_uncaught_network_access_fails(self) -> None:
        result = run_inner(lambda case: socket.create_connection(("ejemplo.invalid", 443)))
        self.assertFalse(result.wasSuccessful())
        self.assertIn("NetworkAccessBlocked", problems(result))

    def test_caught_network_access_still_fails(self) -> None:
        def swallow(case: GuardedTestCase) -> None:
            # Simula código bajo prueba que captura el error y devuelve un 503 controlado.
            for attempt in (
                lambda: socket.create_connection(("ejemplo.invalid", 443)),
                lambda: socket.getaddrinfo("ejemplo.invalid", 443),
            ):
                try:
                    attempt()
                except Exception:
                    pass

        result = run_inner(swallow)
        self.assertFalse(result.wasSuccessful())
        report = problems(result)
        self.assertIn("network:socket.create_connection", report)
        self.assertIn("network:socket.getaddrinfo", report)
        self.assertIn("capturado", report)

    def test_caught_socket_connect_still_fails(self) -> None:
        def swallow(case: GuardedTestCase) -> None:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.connect(("127.0.0.1", 5432))
            except Exception:
                pass
            finally:
                sock.close()

        result = run_inner(swallow)
        self.assertFalse(result.wasSuccessful())
        self.assertIn("network:socket.connect", problems(result))

    def test_caught_forbidden_environment_read_still_fails_without_values(self) -> None:
        # Valor ficticio en el entorno simulado de esta prueba (nunca en el entorno real).
        for name in ("DATABASE_URL", "DATABASE_URL_READONLY", "PGPASSWORD", "DIRECT_URL"):
            os.environ[name] = f"postgresql://ficticio:{FAKE_SECRET}@db.ejemplo.test/x"

            def swallow(case: GuardedTestCase, name: str = name) -> None:
                for read in (lambda: os.environ.get(name), lambda: os.getenv(name), lambda: name in os.environ):
                    try:
                        read()
                    except Exception:
                        pass

            with self.subTest(name=name):
                result = run_inner(swallow)
                self.assertFalse(result.wasSuccessful())
                report = problems(result)
                self.assertIn(f"environment:{name}", report)
                self.assertNotIn(FAKE_SECRET, report)  # nunca se muestran valores
            del os.environ[name]

    def test_deliberate_barrier_checks_pass(self) -> None:
        def deliberate(case: GuardedTestCase) -> None:
            with case.expect_isolation_violation("network"), case.assertRaises(NetworkAccessBlocked):
                socket.create_connection(("ejemplo.invalid", 443))
            with case.expect_isolation_violation("environment"), case.assertRaises(ForbiddenEnvironmentAccess):
                os.environ.get("DATABASE_URL")

        result = run_inner(deliberate)
        self.assertTrue(result.wasSuccessful(), problems(result))

    def test_barriers_still_block_inside_expected_block(self) -> None:
        outcome: dict[str, bool] = {}

        def deliberate(case: GuardedTestCase) -> None:
            with case.expect_isolation_violation("network"):
                try:
                    socket.create_connection(("ejemplo.invalid", 443))
                    outcome["blocked"] = False
                except NetworkAccessBlocked:
                    outcome["blocked"] = True

        result = run_inner(deliberate)
        self.assertTrue(result.wasSuccessful(), problems(result))
        self.assertTrue(outcome["blocked"])

    def test_expected_violation_must_actually_happen(self) -> None:
        def nothing_happens(case: GuardedTestCase) -> None:
            with case.expect_isolation_violation("network"):
                pass

        result = run_inner(nothing_happens)
        self.assertFalse(result.wasSuccessful())
        self.assertIn("no ocurrió", problems(result))

    def test_other_kind_inside_expected_block_still_fails(self) -> None:
        def wrong_kind(case: GuardedTestCase) -> None:
            with case.expect_isolation_violation("network"):
                try:
                    socket.create_connection(("ejemplo.invalid", 443))
                except NetworkAccessBlocked:
                    pass
                try:
                    os.environ.get("DATABASE_URL")
                except ForbiddenEnvironmentAccess:
                    pass

        result = run_inner(wrong_kind)
        self.assertFalse(result.wasSuccessful())
        self.assertIn("environment:DATABASE_URL", problems(result))

    def test_violation_outside_expected_block_still_fails(self) -> None:
        def after_block(case: GuardedTestCase) -> None:
            with case.expect_isolation_violation("network"), case.assertRaises(NetworkAccessBlocked):
                socket.create_connection(("ejemplo.invalid", 443))
            try:
                socket.create_connection(("ejemplo.invalid", 443))  # ya fuera del bloque
            except NetworkAccessBlocked:
                pass

        result = run_inner(after_block)
        self.assertFalse(result.wasSuccessful())

    def test_patches_are_restored_after_a_failing_inner_test(self) -> None:
        before = (socket.create_connection, socket.getaddrinfo, socket.socket.connect, os.environ)

        def crash(case: GuardedTestCase) -> None:
            raise RuntimeError("fallo simulado de la prueba interna")

        result = run_inner(crash)
        self.assertFalse(result.wasSuccessful())
        after = (socket.create_connection, socket.getaddrinfo, socket.socket.connect, os.environ)
        for original, restored in zip(before, after):
            self.assertIs(original, restored)

    # ------------------------------------------------- excepción acotada de socket.socketpair()

    def test_internal_socketpair_works_without_violations(self) -> None:
        observed: dict[str, object] = {}

        def use_pair(case: GuardedTestCase) -> None:
            a, b = socket.socketpair()
            try:
                a.sendall(b"ping")
                observed["data"] = b.recv(4)
            finally:
                a.close()
                b.close()
            observed["pairs"] = case.internal_socketpairs

        result = run_inner(use_pair)
        self.assertTrue(result.wasSuccessful(), problems(result))
        self.assertEqual(observed, {"data": b"ping", "pairs": 1})

    def test_asyncio_event_loop_works_under_the_guards(self) -> None:
        import asyncio

        def run_loop(case: GuardedTestCase) -> None:
            async def answer() -> int:
                await asyncio.sleep(0)
                return 42

            loop = asyncio.new_event_loop()  # en Windows crea su canal interno con socketpair()
            try:
                case.assertEqual(loop.run_until_complete(answer()), 42)
            finally:
                loop.close()

        result = run_inner(run_loop)
        self.assertTrue(result.wasSuccessful(), problems(result))

    def test_other_loopback_connections_are_still_blocked_even_if_caught(self) -> None:
        def connect_to_loopback(case: GuardedTestCase) -> None:
            listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                listener.bind(("127.0.0.1", 0))
                listener.listen(1)
                try:
                    client.connect(listener.getsockname())  # loopback fuera de socketpair()
                except NetworkAccessBlocked:
                    pass
            finally:
                client.close()
                listener.close()

        result = run_inner(connect_to_loopback)
        self.assertFalse(result.wasSuccessful())
        self.assertIn("network:socket.connect", problems(result))

    def test_unsupported_socketpair_is_blocked_even_if_caught(self) -> None:
        def datagram_pair(case: GuardedTestCase) -> None:
            try:
                socket.socketpair(socket.AF_INET, socket.SOCK_DGRAM)
            except NetworkAccessBlocked:
                pass

        result = run_inner(datagram_pair)
        self.assertFalse(result.wasSuccessful())
        self.assertIn("network:socket.socketpair", problems(result))

    def test_socketpair_patch_is_restored(self) -> None:
        def open_and_close(case: GuardedTestCase) -> None:
            for sock in socket.socketpair():
                sock.close()

        before = socket.socketpair
        result = run_inner(open_and_close)
        self.assertTrue(result.wasSuccessful(), problems(result))
        self.assertIs(socket.socketpair, before)

    def test_protected_variables_include_database_connections(self) -> None:
        self.assertTrue({"DATABASE_URL", "DATABASE_URL_READONLY", "PGPASSWORD"} <= FORBIDDEN_ENV_VARS)
