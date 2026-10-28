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

from collections.abc import Callable
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
    return ExecutionFailed("QUERY_REJECTED_BY_DATABASE")


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
                    table_ok = connection.execute("SELECT has_table_privilege(%s, 'SELECT')", (qualified,)).fetchone()
                    tables[table] = {
                        column: bool(
                            table_ok and table_ok[0]
                            and connection.execute(
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
    ) -> None:
        if not 1 <= max_rows <= MAX_ROWS:
            raise ValueError("Límite de filas fuera de rango.")
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

        try:
            with self._connect() as connection:
                with connection.transaction():
                    for statement in SESSION_STATEMENTS:
                        connection.execute(statement)
                    read_only = connection.execute(READ_ONLY_CHECK).fetchone()
                    if not read_only or read_only[0] != "on":
                        raise ExecutionRefused("READ_ONLY_NOT_ENFORCED")
                    cursor = connection.execute(sql)
                    names = [column.name for column in (cursor.description or ())]
                    batch = cursor.fetchmany(self._max_rows + 1)
        except SqlExecutionError:
            raise
        except Exception as exc:  # errores del controlador o de la base: sin mensaje ni encadenamiento
            raise classify_database_error(exc) from None

        if len(batch) > self._max_rows:
            raise ResultTooLarge("ROW_LIMIT_EXCEEDED")
        if not names or len(set(names)) != len(names):
            raise ExecutionFailed("AMBIGUOUS_RESULT_COLUMNS")
        return [dict(zip(names, row, strict=True)) for row in batch]
