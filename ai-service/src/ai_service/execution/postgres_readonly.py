"""``PostgresReadOnlyExecutor``: ejecución de SELECT aprobado contra PostgreSQL en solo lectura.

Defensa en profundidad (además de la credencial de solo lectura de la base):

1. **Deshabilitado por defecto**: solo se construye con ``AI_SQL_EXECUTOR=postgres_readonly``; la
   mera existencia de ``DATABASE_URL_READONLY`` no lo activa.
2. **Contexto de autorización obligatorio**: ``execute`` sin contexto se rechaza siempre; el origen
   debe estar en ``accepted_origins``. Mientras P-9 siga pendiente, la composición no acepta ningún
   origen, así que el chatbot no ejecuta nada sobre la base real.
3. **Revalidación**: el SQL normalizado se vuelve a validar con el validador y la allowlist para el
   rol de la petición; solo se ejecuta si el resultado es idéntico (una sola sentencia SELECT, sin
   funciones peligrosas ni objetos fuera del alcance).
4. **Sesión acotada**: transacción explícita ``READ ONLY`` (comprobada con
   ``SHOW transaction_read_only``), ``statement_timeout`` 5 s, ``lock_timeout`` 2 s e
   ``idle_in_transaction_session_timeout`` 10 s.
5. **Límite de filas**: más de :data:`MAX_ROWS` filas → :class:`ResultTooLarge` (no se trunca:
   un total parcial sería incorrecto).
6. **Errores sin detalles**: se clasifican solo por SQLSTATE; nunca se propaga el mensaje del
   controlador (podría incluir el host o el SQL) ni se registra nada.

``psycopg`` se importa de forma diferida al conectar: el resto de ``ai-service`` y sus pruebas no lo
necesitan.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from ai_service.orchestrator.ports import (
    AuthorizationContext,
    ExecutionFailed,
    ExecutionRefused,
    ExecutionTimeout,
    ExecutionUnavailable,
    ResultTooLarge,
    Row,
    SqlExecutionError,
    SqlValidator,
)
from ai_service.policies.registered_entries import has_registered_entries_filter
from ai_service.validation.allowlist import Allowlist
from ai_service.validation.validator import Verdict

MAX_ROWS = 50
CONNECT_TIMEOUT_S = 5
APPLICATION_NAME = "ai-service-readonly"
SESSION_STATEMENTS: tuple[str, ...] = (
    "SET TRANSACTION READ ONLY",
    "SET LOCAL statement_timeout = '5s'",
    "SET LOCAL lock_timeout = '2s'",
    "SET LOCAL idle_in_transaction_session_timeout = '10s'",
)
READ_ONLY_CHECK = "SHOW transaction_read_only"
WRITE_PRIVILEGE_CHECK = "SELECT has_table_privilege(%s, 'INSERT, UPDATE, DELETE, TRUNCATE')"

ConnectionFactory = Callable[[], Any]


def psycopg_connection_factory(dsn: str) -> ConnectionFactory:
    """Fábrica de conexiones ``psycopg`` 3 (importación diferida; sin autocommit implícito de escritura)."""

    def connect() -> Any:
        try:
            import psycopg
        except ImportError:
            raise ExecutionUnavailable("DRIVER_MISSING") from None
        return psycopg.connect(
            dsn,
            connect_timeout=CONNECT_TIMEOUT_S,
            autocommit=True,  # la transacción se abre explícitamente con conn.transaction()
            prepare_threshold=None,
            application_name=APPLICATION_NAME,
        )

    return connect


def classify_database_error(exc: BaseException) -> SqlExecutionError:
    """Clasificación por SQLSTATE; el mensaje original nunca se conserva."""
    state = getattr(exc, "sqlstate", None)
    if not isinstance(state, str) or len(state) != 5:
        return ExecutionUnavailable("CONNECTION_FAILED")
    if state == "57014":
        return ExecutionTimeout("STATEMENT_TIMEOUT")
    if state == "55P03":
        return ExecutionTimeout("LOCK_TIMEOUT")
    if state == "25006":
        return ExecutionRefused("WRITE_BLOCKED_BY_DATABASE")
    if state in ("42501", "42P01", "3F000"):
        return ExecutionUnavailable("READ_PERMISSION_MISSING")
    if state[:2] in ("08", "28", "53", "57"):
        return ExecutionUnavailable("DATABASE_UNAVAILABLE")
    # Errores de la consulta (no de la base): código fijo por SQLSTATE, útil para el reintento controlado
    # de la ruta ampliada. Nunca se conserva el mensaje del controlador.
    return ExecutionFailed(QUERY_ERROR_CODES.get(state, "QUERY_REJECTED_BY_DATABASE"))


QUERY_ERROR_CODES = {
    "42703": "UNDEFINED_COLUMN",
    "42803": "GROUPING_ERROR",
    "42883": "UNDEFINED_FUNCTION",
    "42804": "DATATYPE_MISMATCH",
    "42725": "AMBIGUOUS_FUNCTION",
    "42702": "AMBIGUOUS_COLUMN",
    "22P02": "INVALID_TEXT_REPRESENTATION",
    "22007": "INVALID_DATETIME_FORMAT",
    "22008": "DATETIME_OUT_OF_RANGE",
}


def probe_connection(connection_factory: ConnectionFactory, allowlist: Allowlist) -> dict[str, object]:
    """Comprobación segura de la conexión real: SIN leer filas de negocio.

    Misma sesión acotada que el Executor (READ ONLY, 5 s, 2 s) y solo: ``SELECT 1``, el modo de solo
    lectura efectivo, los privilegios SELECT del catálogo para las tablas y columnas de la
    allowlist y que el rol NO tenga privilegios de escritura sobre esas tablas (``writable`` debe
    quedar vacío). Errores clasificados sin mensajes del controlador.
    """
    try:
        with connection_factory() as connection:
            with connection.transaction():
                for statement in SESSION_STATEMENTS:
                    connection.execute(statement)
                read_only = connection.execute(READ_ONLY_CHECK).fetchone()
                select_one = connection.execute("SELECT 1").fetchone()
                tables: dict[str, dict[str, bool]] = {}
                writable: list[str] = []
                for table, columns in allowlist.tables.items():
                    qualified = f"{allowlist.schema}.{table}"
                    write = connection.execute(WRITE_PRIVILEGE_CHECK, (qualified,)).fetchone()
                    if write is None or write[0]:
                        writable.append(table)  # sin respuesta clara se trata como escribible
                    # ``has_column_privilege`` cubre el SELECT de tabla y el concedido solo por columnas
                    # (privilegios mínimos: GRANT SELECT (col, …) sin acceso a columnas sensibles).
                    tables[table] = {
                        column: bool(
                            connection.execute(
                                "SELECT has_column_privilege(%s, %s, 'SELECT')", (qualified, column)
                            ).fetchone()[0]
                        )
                        for column in columns
                    }
    except SqlExecutionError:
        raise
    except Exception as exc:
        raise classify_database_error(exc) from None
    return {
        "select_1": bool(select_one and select_one[0] == 1),
        "read_only": bool(read_only and read_only[0] == "on"),
        "privileges": tables,
        "writable": writable,
    }


class PostgresReadOnlyExecutor:
    def __init__(
        self,
        connection_factory: ConnectionFactory,
        validator: SqlValidator,
        *,
        accepted_origins: frozenset[str],
        max_rows: int = MAX_ROWS,
        pool: bool = False,
    ) -> None:
        """``pool`` (``AI_PERF_OPT``): reutiliza conexiones inactivas en lugar de abrir una por consulta. Cada
        consulta conserva su transacción READ ONLY, los SET, la comprobación y la revalidación."""
        if not 1 <= max_rows <= MAX_ROWS:
            raise ValueError("Límite de filas fuera de rango.")
        self._pool = ConnectionPool(connection_factory) if pool else None
        self._connect = connection_factory
        self._validator = validator
        self._accepted_origins = frozenset(accepted_origins)
        self._max_rows = max_rows

    def execute(self, verdict: Verdict) -> list[Row]:
        raise ExecutionRefused("AUTHORIZATION_REQUIRED")  # nunca sin contexto de la petición

    def execute_authorized(self, verdict: Verdict, authorization: AuthorizationContext) -> list[Row]:
        if not isinstance(verdict, Verdict) or not verdict.approved or not verdict.normalized_sql:
            raise ExecutionRefused("UNAPPROVED_SQL")
        if not isinstance(authorization, AuthorizationContext) or authorization.origen not in self._accepted_origins:
            raise ExecutionRefused("UNTRUSTED_AUTHORIZATION")
        recheck = self._validator.validate(verdict.normalized_sql, authorization.rol)
        if not recheck.approved or recheck.normalized_sql != verdict.normalized_sql:
            raise ExecutionRefused("REVALIDATION_FAILED")
        sql = recheck.normalized_sql
        if not has_registered_entries_filter(sql):
            raise ExecutionRefused("REGISTERED_FILTER_MISSING")  # P-4: nunca sumar asientos anulados

        if self._pool is not None:
            names, batch = self._run_pooled(sql)
        else:
            try:
                with self._connect() as connection:
                    names, batch = self._query(connection, sql)
            except SqlExecutionError:
                raise
            except Exception as exc:  # errores del controlador o de la base: sin mensaje ni encadenamiento
                raise classify_database_error(exc) from None

        if len(batch) > self._max_rows:
            raise ResultTooLarge("ROW_LIMIT_EXCEEDED")
        if not names or len(set(names)) != len(names):
            raise ExecutionFailed("AMBIGUOUS_RESULT_COLUMNS")
        return [dict(zip(names, row, strict=True)) for row in batch]

    def _query(self, connection: Any, sql: str) -> tuple[list[str], list[Any]]:
        """Una transacción de solo lectura acotada (SET, comprobación READ ONLY y la consulta), siempre completa:
        también en una conexión reutilizada."""
        with connection.transaction():
            for statement in SESSION_STATEMENTS:
                connection.execute(statement)
            read_only = connection.execute(READ_ONLY_CHECK).fetchone()
            if not read_only or read_only[0] != "on":
                raise ExecutionRefused("READ_ONLY_NOT_ENFORCED")
            cursor = connection.execute(sql)
            names = [column.name for column in (cursor.description or ())]
            batch = cursor.fetchmany(self._max_rows + 1)
        return names, batch

    def _run_pooled(self, sql: str) -> tuple[list[str], list[Any]]:
        """Como la ruta normal, pero con una conexión reutilizada (``AI_PERF_OPT``). Una conexión reutilizada que
        falla por la conexión (no por la consulta) se descarta y se reintenta UNA vez con otra nueva: es el mismo
        SELECT de solo lectura ya revalidado."""
        from ai_service.orchestrator import diagnostics

        assert self._pool is not None
        for attempt in (1, 2):
            lease = self._pool.acquire()  # errores de conexión ya clasificados
            try:
                result = self._query(lease.connection, sql)
            except SqlExecutionError:
                self._pool.discard(lease)
                raise
            except Exception as exc:
                if _is_connection_error(exc):
                    self._pool.discard(lease)
                    if lease.reused and attempt == 1:
                        diagnostics.event("POOL_STALE_RETRY", f"conexion=#{lease.number} descartada; se abre otra")
                        continue
                else:
                    self._pool.release(lease)  # error de la consulta: la conexión sigue sana si quedó inactiva
                raise classify_database_error(exc) from None
            self._pool.release(lease)
            if lease.reused:
                diagnostics.event("POOL_REUSE", f"conexion=#{lease.number} usos={lease.uses} inactiva={lease.idle_ms} ms")
            else:
                diagnostics.event("POOL_NEW", f"conexion=#{lease.number} apertura={lease.connect_ms} ms")
            return result
        raise ExecutionUnavailable("CONNECTION_FAILED")  # pragma: no cover - el bucle siempre retorna o lanza

    def warm_up(self) -> int:
        """Abre una conexión con la misma sesión acotada y solo ``SHOW``/``SELECT 1`` (ninguna fila de negocio).
        Devuelve los ms de apertura. Sin pool no hace nada (devuelve 0)."""
        if self._pool is None:
            return 0
        lease = self._pool.acquire()
        try:
            with lease.connection.transaction():
                for statement in SESSION_STATEMENTS:
                    lease.connection.execute(statement)
                read_only = lease.connection.execute(READ_ONLY_CHECK).fetchone()
                lease.connection.execute("SELECT 1").fetchone()
            if not read_only or read_only[0] != "on":
                raise ExecutionRefused("READ_ONLY_NOT_ENFORCED")
        except SqlExecutionError:
            self._pool.discard(lease)
            raise
        except Exception as exc:
            self._pool.discard(lease)
            raise classify_database_error(exc) from None
        self._pool.release(lease)
        return lease.connect_ms


def _is_connection_error(exc: BaseException) -> bool:
    """Fallo de la conexión (sin SQLSTATE, clase 08 o cierre administrativo), no de la consulta."""
    state = getattr(exc, "sqlstate", None)
    return not isinstance(state, str) or state[:2] == "08" or state in ("57P01", "57P02", "57P03")


@dataclass
class _Lease:
    connection: Any
    number: int
    reused: bool
    uses: int
    connect_ms: int = 0
    idle_ms: int = 0
    last_used: float = 0.0


class ConnectionPool:
    """Pool mínimo de conexiones de solo lectura (sin dependencias). Solo guarda conexiones inactivas y sanas;
    las que superan ``max_idle_s`` sin uso se cierran antes de reutilizarse."""

    def __init__(self, factory: ConnectionFactory, *, max_idle: int = 2, max_idle_s: float = 180.0,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self._factory = factory
        self._max_idle = max_idle
        self._max_idle_s = max_idle_s
        self._clock = clock
        self._idle: list[_Lease] = []
        self._lock = threading.Lock()
        self._opened = 0

    def acquire(self) -> _Lease:
        now = self._clock()
        with self._lock:
            while self._idle:
                lease = self._idle.pop()
                if now - lease.last_used <= self._max_idle_s and _healthy(lease.connection):
                    lease.reused, lease.uses = True, lease.uses + 1
                    lease.idle_ms = int((now - lease.last_used) * 1000)
                    return lease
                _close(lease.connection)
            self._opened += 1
            number = self._opened
        started = time.perf_counter()
        try:
            connection = self._factory()
        except SqlExecutionError:
            raise
        except Exception as exc:
            raise classify_database_error(exc) from None
        return _Lease(connection=connection, number=number, reused=False, uses=1,
                      connect_ms=int((time.perf_counter() - started) * 1000))

    def release(self, lease: _Lease) -> None:
        lease.last_used = self._clock()
        with self._lock:
            if _healthy(lease.connection) and len(self._idle) < self._max_idle:
                self._idle.append(lease)
                return
        _close(lease.connection)

    def discard(self, lease: _Lease) -> None:
        _close(lease.connection)


def _healthy(connection: Any) -> bool:
    if getattr(connection, "closed", False) or getattr(connection, "broken", False):
        return False
    status = getattr(getattr(connection, "info", None), "transaction_status", None)
    return status is None or int(status) == 0  # psycopg.pq.TransactionStatus.IDLE


def _close(connection: Any) -> None:
    try:
        connection.close()
    except Exception:
        pass
