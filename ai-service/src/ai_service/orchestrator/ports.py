"""Interfaces desacopladas del orquestador (T020, AR-1).

Cada interfaz tiene una implementación simulada en B3 y podrá sustituirse por una real sin tocar
el pipeline. Reglas de separación (AR-1):

- Ningún modelo accede a la base de datos: solo :class:`SqlExecutor` recibe SQL, y únicamente un
  :class:`~ai_service.validation.validator.Verdict` **aprobado**.
- Ningún modelo calcula cifras: solo :class:`FinanceEngine` produce
  :class:`~ai_service.http.schemas.Figure`.
- La interfaz del Modelo 1 es :class:`~ai_service.llm.provider.LlmProvider` (D-12), reutilizada.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import ClassVar, Literal, Protocol

from ai_service.audit.record import AuditRecord
from ai_service.http.schemas import Figure, Period, QueryRequest
from ai_service.llm.provider import Intent, LlmProvider
from ai_service.validation.validator import Verdict

__all__ = [
    "AuditSink",
    "AuthorizationContext",
    "AuthorizedSqlExecutor",
    "ClassifiedError",
    "ExecutionFailed",
    "ExecutionRefused",
    "ExecutionTimeout",
    "ExecutionUnavailable",
    "ResultTooLarge",
    "SqlExecutionError",
    "GenerationBlocked",
    "GenerationInputRejected",
    "GenerationNotAuthorized",
    "InvalidGeneratorOutput",
    "SqlGenerationError",
    "SqlGeneratorTimeout",
    "SqlGeneratorUnavailable",
    "Explainer",
    "FinanceEngine",
    "FinanceResult",
    "Fragment",
    "Interpretation",
    "Interpreter",
    "LlmProvider",
    "QueryPlan",
    "Retriever",
    "Row",
    "SqlCandidate",
    "SqlExecutor",
    "SqlGenerator",
    "SqlValidator",
]

Row = Mapping[str, object]


@dataclass(frozen=True)
class Interpretation:
    """Resultado de la interpretación (Modelo 1 o sustituto), aún **no confiable**."""

    intencion: Intent
    cuenta: str | None = None
    indicador: str | None = None
    necesita_aclaracion: bool = False


@dataclass(frozen=True)
class Fragment:
    """Fragmento recuperado por RAG: solo metadatos, reglas o ejemplos ficticios."""

    tipo: Literal["esquema", "relacion", "regla", "metrica", "ejemplo"]
    fuente: str
    version: str
    contenido: str
    # Texto breve en inglés, solo del lado de los datos, que puede entregarse al Modelo 2 (T033). No
    # forma parte de la huella del corpus: ``contenido`` sigue siendo el documento de recuperación.
    evidencia_modelo: str | None = None


@dataclass(frozen=True)
class AuthorizationContext:
    """Rol con el que se acota **una** petición, ya revalidado contra la allowlist por el backend.

    - ``ct-b-provisional``: rol enviado en CT-B por el proxy sin aserción verificable. Solo sirve para
      **restringir** el alcance y nunca habilita datos reales (``autenticado=False``).
    - ``erp-session`` (P-9): la API verificó la aserción HS256 que el proxy firma a partir de
      ``sesionActual()`` del ERP (``ai_service.auth.identity``). Solo así ``autenticado=True``.
    """

    rol: str
    origen: Literal["ct-b-provisional", "erp-session"] = "ct-b-provisional"
    autenticado: bool = False

    def __post_init__(self) -> None:
        # ``erp-session`` solo existe tras verificar la aserción firmada del proxy (P-9).
        if (self.origen == "erp-session") != self.autenticado:
            raise ValueError("Contexto de autorización incoherente.")


@dataclass(frozen=True)
class QueryPlan:
    """Consulta ya resuelta y revalidada por el backend (BR-12).

    ``autorizacion`` lo fija el pipeline en cada petición. Es opcional solo para conservar los
    simuladores; los generadores reales lo exigen y fallan de forma segura si falta.
    """

    kind: Literal["saldo_cuenta"]
    cuenta: str
    periodo: Period
    autorizacion: AuthorizationContext | None = None


@dataclass(frozen=True)
class SqlCandidate:
    sql: str
    kind: str


@dataclass(frozen=True)
class FinanceResult:
    """Cifras verificadas o ausencia de datos (BR-5)."""

    figures: tuple[Figure, ...] = ()
    no_data: bool = False
    notes: tuple[str, ...] = field(default_factory=tuple)


class Interpreter(Protocol):
    def interpret(self, request: QueryRequest) -> Interpretation: ...


class Retriever(Protocol):
    def retrieve(self, query: str, k: int) -> list[Fragment]: ...


_CODE_RE = re.compile(r"^[A-Z_]{3,40}$")


class ClassifiedError(Exception):
    """Fallo **clasificado** de un componente. ``category`` y ``code`` van a la auditoría.

    Nunca lleva el prompt, la salida del modelo, el SQL, filas, rutas ni credenciales: solo códigos
    fijos con el formato de los códigos de auditoría (uno inválido se sustituye por ``UNSPECIFIED``).

    - ``transient=True`` (servicio no disponible, *timeout*): ``503`` "intenta más tarde".
    - ``transient=False`` (salida inválida, entrada rechazada, sin autorización, bloqueado): la
      consulta queda ``no_resoluble``; reintentar no cambiaría el resultado.
    """

    category: ClassVar[str] = "COMPONENT_ERROR"
    transient: ClassVar[bool] = False

    def __init__(self, code: str) -> None:
        code = code if isinstance(code, str) and _CODE_RE.match(code) else "UNSPECIFIED"
        super().__init__(code)
        self.code = code


class SqlGenerationError(ClassifiedError):
    """Fallo clasificado de un generador de SQL."""

    category = "SQLGEN_ERROR"


class SqlGeneratorUnavailable(SqlGenerationError):
    """El servicio de generación no responde, está cargando, ocupado o mal configurado."""

    category = "SQLGEN_UNAVAILABLE"
    transient = True


class SqlGeneratorTimeout(SqlGenerationError):
    category = "SQLGEN_TIMEOUT"
    transient = True


class InvalidGeneratorOutput(SqlGenerationError):
    """La respuesta o la salida del modelo no tiene un formato utilizable (no es indisponibilidad)."""

    category = "SQLGEN_INVALID_OUTPUT"


class GenerationInputRejected(SqlGenerationError):
    """La entrada construida para el modelo fue rechazada (p. ej., excede la longitud entrenada)."""

    category = "SQLGEN_INPUT_REJECTED"


class GenerationNotAuthorized(SqlGenerationError):
    """Falta el contexto de autorización o el rol no cubre los objetos que requiere la consulta."""

    category = "SQLGEN_NOT_AUTHORIZED"


class GenerationBlocked(SqlGenerationError):
    """La modalidad está bloqueada hasta una decisión pendiente (p. ej., P-4 con datos reales)."""

    category = "SQLGEN_BLOCKED"


class SqlGenerator(Protocol):
    """Puede lanzar :class:`SqlGenerationError`; el resultado pasa siempre por el SQL Validator."""

    def generate(self, plan: QueryPlan, fragments: Sequence[Fragment]) -> SqlCandidate: ...


class SqlValidator(Protocol):
    """Implementación real: :class:`ai_service.validation.validator.SqlValidator` (B2)."""

    def validate(self, sql: str, role: str) -> Verdict: ...


class SqlExecutor(Protocol):
    """Solo acepta veredictos aprobados; nunca recibe SQL sin validar."""

    def execute(self, verdict: Verdict) -> list[Row]: ...


class AuthorizedSqlExecutor(Protocol):
    """Executor que además exige el contexto de autorización de la petición (p. ej., base real).

    Si el Executor implementa ``execute_authorized``, el pipeline lo usa en lugar de ``execute``.
    """

    def execute_authorized(self, verdict: Verdict, authorization: AuthorizationContext) -> list[Row]: ...


class SqlExecutionError(ClassifiedError):
    """Fallo clasificado de un Executor."""

    category = "SQLEXEC_ERROR"


class ExecutionRefused(SqlExecutionError):
    """El Executor se negó a ejecutar (deshabilitado, sin autorización válida o SQL no revalidado)."""

    category = "SQLEXEC_REFUSED"


class ExecutionUnavailable(SqlExecutionError):
    """Base de datos no disponible, sin controlador o sin permisos de lectura configurados."""

    category = "SQLEXEC_UNAVAILABLE"
    transient = True


class ExecutionTimeout(SqlExecutionError):
    category = "SQLEXEC_TIMEOUT"
    transient = True


class ExecutionFailed(SqlExecutionError):
    """La base de datos rechazó una consulta ya aprobada (sin detalles del error)."""

    category = "SQLEXEC_FAILED"


class ResultTooLarge(SqlExecutionError):
    """El resultado supera el límite de filas: no se trunca (un total parcial sería incorrecto)."""

    category = "SQLEXEC_RESULT_TOO_LARGE"


class FinanceEngine(Protocol):
    def compute(self, plan: QueryPlan, rows: Sequence[Row]) -> FinanceResult: ...


class Explainer(Protocol):
    """Devuelve el texto final con las cifras ya verificadas e insertadas (T023)."""

    def explain(
        self,
        *,
        trace_id: str,
        intencion: Intent,
        periodo: Period | None,
        figures: Sequence[Figure],
        cuenta_nombre: str | None = None,
    ) -> str: ...


class AuditSink(Protocol):
    def write(self, record: AuditRecord) -> None: ...
