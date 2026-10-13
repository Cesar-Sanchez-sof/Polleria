"""Barreras comunes de las pruebas de ai-service (T002, NFR-011, SC-014).

Toda clase de prueba debe heredar de :class:`GuardedTestCase`. Durante cada prueba:

- Cualquier intento de abrir una conexión de red o de resolver un nombre lanza
  :class:`NetworkAccessBlocked`.
- Cualquier lectura de una variable de conexión protegida (:data:`FORBIDDEN_ENV_VARS`, p. ej.
  ``DATABASE_URL`` o ``DATABASE_URL_READONLY``) a través de ``os.environ`` u ``os.getenv`` lanza
  :class:`ForbiddenEnvironmentAccess`.

Además, **cada violación queda registrada** y, al terminar la prueba, cualquier violación no
esperada **hace fallar la prueba aunque el código bajo prueba haya capturado la excepción** (por
ejemplo, convirtiéndola en un ``503`` controlado). El registro solo guarda el tipo de violación y
el nombre de la operación o de la variable, **nunca valores**.

Única excepción, acotada y verificable: ``socket.socketpair()`` se sustituye por
:func:`_internal_socketpair`, que permite **solo** el par de sockets loopback que ``asyncio``
necesita en Windows (p. ej. para el ``TestClient`` de FastAPI). No relaja el ``connect`` vigilado.

Las pruebas que comprueban a propósito las barreras deben usar
:meth:`GuardedTestCase.expect_isolation_violation`, que es explícito, acotado a un bloque y exige
que la violación ocurra. Las barreras siguen bloqueando dentro de ese bloque.

Importar este módulo además añade ``ai-service/src`` a ``sys.path`` para que las pruebas se
ejecuten con la biblioteca estándar, sin instalar el paquete.
"""

from __future__ import annotations

import os
import socket
import sys
import unittest
from collections.abc import Callable, Iterator, MutableMapping
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from unittest import mock

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

FORBIDDEN_ENV_VARS: frozenset[str] = frozenset(
    {
        "DATABASE_URL",
        "DATABASE_URL_READONLY",
        "DIRECT_URL",
        "SHADOW_DATABASE_URL",
        "POSTGRES_URL",
        "PGHOST",
        "PGUSER",
        "PGPASSWORD",
        "PGDATABASE",
        "PGPASSFILE",
        "PGSERVICEFILE",
    }
)

ViolationKind = Literal["network", "environment"]


class NetworkAccessBlocked(AssertionError):
    """Se intentó usar la red durante una prueba."""


class ForbiddenEnvironmentAccess(AssertionError):
    """Se intentó leer una variable de conexión protegida durante una prueba."""


@dataclass(frozen=True)
class IsolationViolation:
    """Violación registrada: solo el tipo y un nombre (operación o variable), nunca valores."""

    kind: ViolationKind
    name: str
    expected: bool


class GuardedEnviron(MutableMapping[str, str]):
    """Entorno que falla al leer variables protegidas, sin exponer nunca su valor."""

    def __init__(
        self,
        data: dict[str, str],
        on_violation: Callable[[str], None] | None = None,
    ) -> None:
        self._data = data
        self._on_violation = on_violation

    def _check(self, key: str) -> None:
        if key in FORBIDDEN_ENV_VARS:
            if self._on_violation is not None:
                self._on_violation(key)
            raise ForbiddenEnvironmentAccess(f"Las pruebas no pueden leer la variable {key}.")

    def __getitem__(self, key: str) -> str:
        self._check(key)
        return self._data[key]

    def __setitem__(self, key: str, value: str) -> None:
        self._data[key] = value

    def __delitem__(self, key: str) -> None:
        del self._data[key]

    def __contains__(self, key: object) -> bool:
        if isinstance(key, str):
            self._check(key)
        return key in self._data

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def copy(self) -> dict[str, str]:
        """Copia sin las variables protegidas (sin leer su valor)."""
        return {k: self._data[k] for k in self._data if k not in FORBIDDEN_ENV_VARS}


def _safe_environment_copy() -> dict[str, str]:
    """Copia el entorno del proceso sin leer nunca el valor de las variables protegidas."""
    return {key: os.environ[key] for key in os.environ if key not in FORBIDDEN_ENV_VARS}


_ORIGINAL_CONNECT = socket.socket.connect
_LOOPBACK_BY_FAMILY = {socket.AF_INET: "127.0.0.1", socket.AF_INET6: "::1"}


def _internal_socketpair(
    family: int = socket.AF_INET, type: int = socket.SOCK_STREAM, proto: int = 0
) -> tuple[socket.socket, socket.socket]:
    """``socket.socketpair`` controlado para el bucle de ``asyncio`` en Windows.

    En Windows, ``asyncio`` crea su canal interno con ``socket.socketpair()``, que se implementa
    conectando un socket a un servidor efímero en loopback. Esta versión reproduce ese algoritmo de
    CPython, pero de forma **acotada**: solo TCP sobre loopback, conecta **únicamente** al socket que
    acaba de crear (usando el ``connect`` original de forma interna) y comprueba que el extremo
    aceptado es exactamente ese socket. El ``connect`` vigilado no se relaja: cualquier otra conexión,
    también a ``127.0.0.1``, sigue bloqueada y registrada.
    """
    if family not in _LOOPBACK_BY_FAMILY or type != socket.SOCK_STREAM:
        raise NetworkAccessBlocked("Solo se permite socketpair TCP sobre loopback en las pruebas.")
    listener = socket.socket(family, type, proto)
    try:
        listener.bind((_LOOPBACK_BY_FAMILY[family], 0))
        listener.listen(1)
        address = listener.getsockname()[:2]
        client = socket.socket(family, type, proto)
        try:
            client.setblocking(False)
            try:
                _ORIGINAL_CONNECT(client, address)  # solo hacia el listener recién creado
            except (BlockingIOError, InterruptedError):
                pass
            client.setblocking(True)
            server, _ = listener.accept()
            if server.getpeername()[:2] != client.getsockname()[:2]:
                server.close()
                raise NetworkAccessBlocked("El extremo del socketpair no corresponde al socket esperado.")
        except BaseException:
            client.close()
            raise
    finally:
        listener.close()
    return server, client


class GuardedTestCase(unittest.TestCase):
    """Caso de prueba con red bloqueada, variables protegidas y registro de violaciones."""

    def setUp(self) -> None:
        super().setUp()
        self._isolation_violations: list[IsolationViolation] = []
        self._allowed_kinds: list[ViolationKind] = []
        self.internal_socketpairs = 0
        # Se registra primero para que se ejecute al final, después de restaurar los parches.
        self.addCleanup(self._fail_on_unexpected_violations)

        def blocked(operation: str) -> Callable[..., None]:
            def _raise(*_args: object, **_kwargs: object) -> None:
                self._record("network", operation)
                raise NetworkAccessBlocked("Las pruebas de ai-service no pueden usar la red.")

            return _raise

        def counted_socketpair(*args: object, **kwargs: object) -> tuple[socket.socket, socket.socket]:
            try:
                pair = _internal_socketpair(*args, **kwargs)  # type: ignore[arg-type]
            except NetworkAccessBlocked:
                self._record("network", "socket.socketpair")
                raise
            self.internal_socketpairs += 1
            return pair

        patchers = [
            mock.patch.object(socket, "socketpair", counted_socketpair),
            mock.patch.object(socket.socket, "connect", blocked("socket.connect")),
            mock.patch.object(socket.socket, "connect_ex", blocked("socket.connect_ex")),
            mock.patch.object(socket, "create_connection", blocked("socket.create_connection")),
            mock.patch.object(socket, "getaddrinfo", blocked("socket.getaddrinfo")),
            mock.patch.object(
                os,
                "environ",
                GuardedEnviron(_safe_environment_copy(), on_violation=lambda key: self._record("environment", key)),
            ),
        ]
        for patcher in patchers:
            patcher.start()
            self.addCleanup(patcher.stop)  # se restaura aunque la prueba falle

    # ------------------------------------------------------------------ registro

    def _record(self, kind: ViolationKind, name: str) -> None:
        expected = bool(self._allowed_kinds) and self._allowed_kinds[-1] == kind
        self._isolation_violations.append(IsolationViolation(kind=kind, name=name, expected=expected))

    @property
    def isolation_violations(self) -> tuple[IsolationViolation, ...]:
        return tuple(self._isolation_violations)

    def _fail_on_unexpected_violations(self) -> None:
        unexpected = [v for v in self._isolation_violations if not v.expected]
        if unexpected:
            summary = ", ".join(sorted({f"{v.kind}:{v.name}" for v in unexpected}))
            raise AssertionError(
                f"Violación de aislamiento no esperada durante la prueba ({summary}). "
                "Se detectó aunque el código bajo prueba haya capturado la excepción."
            )

    @contextmanager
    def expect_isolation_violation(self, kind: ViolationKind) -> Iterator[None]:
        """Permite **solo dentro del bloque** violaciones del tipo ``kind`` y exige que ocurra al
        menos una. Las barreras siguen bloqueando; otros tipos de violación siguen siendo un fallo."""
        start = len(self._isolation_violations)
        self._allowed_kinds.append(kind)
        try:
            yield
        finally:
            self._allowed_kinds.pop()
        produced = self._isolation_violations[start:]
        if not any(v.kind == kind and v.expected for v in produced):
            raise AssertionError(f"Se esperaba una violación de aislamiento de tipo {kind!r} y no ocurrió.")
