"""Pipeline de orquestación (T022, CT-A, CT-B, AR-1).

Flujo: petición CT-B → validación del contrato → rol revalidado → prefiltro (sin modelos) →
interpretación → resolución de cuenta y período en el backend → recuperación → SQL candidato →
**SQL Validator real** → Executor (solo SQL aprobado) → **motor financiero real** → explicación
verificada → auditoría minimizada.

Garantías:

- El Executor solo recibe un ``Verdict`` aprobado; si el validador rechaza, **no se invoca**.
- Las cifras solo provienen del motor financiero o del Executor y se insertan con marcadores
  verificados (T023). Sin datos → ``sin_datos`` y ninguna cifra (BR-5).
- Presupuesto agotado o no verificable → ``503`` sin detalles económicos (D-14).
- Un :class:`SecurityIncident` (p. ej. datos sensibles hacia un proveedor externo) **detiene** el
  procesamiento: ``503`` genérico, ``security_incident=True`` y código ``SECURITY_INCIDENT`` en la
  auditoría. Nunca se convierte en una respuesta aparentemente exitosa.
- El generador de SQL recibe en el plan el contexto de autorización de **cada** petición (rol
  revalidado, provisional hasta P-9) y el validador usa ese mismo rol. Sus fallos se clasifican:
  servicio no disponible o *timeout* → ``503``; salida inválida, entrada rechazada, falta de
  autorización o modalidad bloqueada → ``no_resoluble`` sin invocar validador ni Executor; SQL
  rechazado por el validador → ``no_resoluble`` con ``SQL_REJECTED``. La auditoría guarda la
  categoría y el código, nunca el prompt ni la salida.
- Un Executor con ``execute_authorized`` (base real) recibe también ese contexto y revalida. Sus
  fallos se clasifican igual: base no disponible o *timeout* → ``503``; rechazo, consulta
  rechazada por la base o resultado demasiado grande → ``no_resoluble`` sin cifras.
- Cualquier fallo de un componente → respuesta controlada, sin trazas internas ni SQL.
- Toda petición con traza válida deja un registro de auditoría minimizado.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import Field, ValidationError

from ai_service.audit.masking import AuditConfigError, AuditMaskingError, Pseudonymizer, parametrize_sql
from ai_service.audit.record import AuditRecord, build_audit_record
from ai_service.explanation.markers import MarkerValidationError
from ai_service.finance.engine import FinanceEngineError
from ai_service.orchestrator import diagnostics as tracing
from ai_service.http.schemas import (
    Detail,
    Diagnostic,
    Evidence,
    FigureLabel,
    Figure,
    Period,
    QueryRequest,
    QueryResponse,
    ResponseState,
    StrictModel,
)
from ai_service.llm.budget import BudgetDenied
from ai_service.llm.provider import Intent
from ai_service.orchestrator.model_calls import ModelUnavailable
from ai_service.finance.money import round2
from ai_service.orchestrator.periods import (
    default_period_text,
    full_history,
    month_to_date,
    period_text,
    resolve_months,
    resolve_period,
    resolve_period_from,
)
from ai_service.orchestrator.ports import (
    AuditSink,
    AuthorizationContext,
    ClassifiedError,
    Explainer,
    FinanceEngine,
    FinanceResult,
    Interpretation,
    Interpreter,
    QueryPlan,
    Retriever,
    SqlExecutionError,
    SqlExecutor,
    SqlGenerationError,
    SqlGenerator,
    SqlValidator,
)
from ai_service.orchestrator.prefilter import PrefilterDecision, prefilter, user_turns
from ai_service.orchestrator.security import SECURITY_INCIDENT, SecurityIncident
from ai_service.sqlgen.families import FamilyCatalog, QueryFamily
from ai_service.sqlgen.modules import MODULE_DOMAIN, ErpModules
from ai_service.llm.provider import FreeFilter, FreeQuery
import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError
from dataclasses import replace

TEXTS: dict[str, str] = {
    "sin_datos": "No encontré movimientos de esa cuenta en el período que consultaste.",
    "requiere_aclaracion": (
        "Necesito un poco más de información. ¿De qué cuenta (por ejemplo, Caja o Bancos) y de qué mes "
        "quieres el resultado?"
    ),
    "solo_lectura": "Solo puedo consultar información; no puedo registrar, modificar ni anular movimientos.",
    "fuera_de_dominio": "Solo puedo ayudarte con consultas sobre la información del ERP (ventas, productos, inventario, compras, caja y contabilidad).",
    "no_resoluble": "No pude responder esa pregunta con la información disponible.",
    "datos_sensibles": (
        "Por seguridad, no incluyas datos personales, credenciales ni importes en tu pregunta."
    ),
}
# Textos por motivo (códigos fijos de auditoría): dicen QUÉ etapa impidió responder en lugar de un
# mensaje único. Nunca incluyen SQL, filas, cifras ni detalles internos.
REASON_TEXTS: dict[str, str] = {
    "MISSING_ACCOUNT": (
        "Entendí que es una consulta financiera, pero no identifiqué a qué cuenta o concepto te refieres. "
        "Menciónalo con otras palabras (por ejemplo, ventas, caja, bancos o proveedores)."
    ),
    "MISSING_PERIOD": (
        "No reconocí el período de la consulta. Indícalo, por ejemplo: «septiembre», «el mes pasado», "
        "«este año» o «del 01/09/2026 al 15/09/2026»."
    ),
    "INDICATOR_NOT_AVAILABLE": "Todavía no puedo calcular ese indicador financiero; solo consulto movimientos de cuentas.",
    "SQLGEN_INVALID_OUTPUT": (
        "El modelo de SQL generó una consulta, pero su forma no permite verificar el resultado con "
        "seguridad, así que no la ejecuté."
    ),
    "SQLGEN_INPUT_REJECTED": "No pude preparar la solicitud para el modelo de SQL con esta pregunta.",
    "SQLGEN_NOT_AUTHORIZED": "Tu rol no tiene acceso a la información que necesita esta consulta.",
    "SQLGEN_BLOCKED": "Este tipo de consulta está deshabilitado por ahora con datos reales.",
    "SQL_REJECTED": (
        "El modelo de SQL generó una consulta, pero el validador de seguridad la rechazó; no se ejecutó "
        "nada en la base de datos."
    ),
    "SQLEXEC_FAILED": "La base de datos rechazó la consulta generada; no muestro cifras.",
    "SQLEXEC_REFUSED": "El ejecutor de consultas se negó a ejecutar la consulta generada.",
    "SQLEXEC_RESULT_TOO_LARGE": "La consulta devolvió demasiadas filas para resumirlas con exactitud. Acota la pregunta.",
    "RESULT_NOT_INTERPRETABLE": (
        "La consulta se ejecutó, pero el resultado no tiene la forma esperada para calcular las cifras, "
        "así que no muestro ninguna."
    ),
    "RESTRICTED_DATA": (
        "Esa información está restringida para el asistente: no consulta usuarios, contraseñas, roles, "
        "auditoría, empleados, sueldos ni datos personales de clientes o proveedores."
    ),
    "MODULE_NOT_PERMITTED": "Tu usuario no tiene permiso para consultar ese módulo del ERP.",
    "NO_AUTHORIZED_TABLES": (
        "No encontré tablas del ERP autorizadas para el asistente que contengan esa información."
    ),
    "UNKNOWN_STATUS_VALUE": (
        "El modelo de SQL usó un estado o tipo que no existe en el ERP, así que no ejecuté la consulta."
    ),
    "INTENT_SQL_MISMATCH": (
        "El modelo de SQL generó una consulta que no corresponde a lo que preguntaste, así que no la ejecuté."
    ),
    "FILTER_NOT_APPLIED": (
        "El modelo de SQL no aplicó el filtro que pediste (por ejemplo, el medio de pago o el tipo de comprobante), "
        "así que no ejecuté la consulta."
    ),
    "FILTER_NOOP": (
        "El modelo de SQL generó un filtro que incluye todos los valores posibles y no distingue lo que pediste, "
        "así que no ejecuté la consulta."
    ),
    "VOIDED_ENTRIES_NOT_AVAILABLE": (
        "Solo consulto asientos contables registrados; los asientos anulados no están disponibles para el asistente."
    ),
    "UNREQUESTED_FILTER": (
        "El modelo de SQL agregó un filtro que no pediste (por ejemplo, solo activos), así que no ejecuté la consulta."
    ),
    "LEFT_JOIN_NULLIFIED": (
        "El modelo de SQL generó una consulta que nunca podría encontrar registros sin movimientos, "
        "así que no la ejecuté."
    ),
    "OPERATING_EXPENSES_NOT_AVAILABLE": (
        "Todavía no puedo consultar gastos operativos (alquiler, servicios, sueldos): el modelo de SQL no fue "
        "entrenado para ellos. Puedo darte las compras facturadas, los pagos a proveedores o el movimiento de "
        "una cuenta de gastos si me indicas su código."
    ),
    "NO_ROWS": (
        "La consulta se generó y se ejecutó correctamente en la base de datos, pero no devolvió registros "
        "para el período consultado."
    ),
    "EXPLANATION_REJECTED": (
        "Obtuve el resultado, pero la redacción generada no pasó la verificación de cifras, así que no la muestro."
    ),
}
ERROR_INVALID_REQUEST = "La solicitud no es válida."
ERROR_FORBIDDEN = "No tienes permisos para usar el asistente financiero."
ERROR_UNAVAILABLE = "El asistente no está disponible en este momento. Intenta más tarde."

# Códigos internos de auditoría (formato ``^[A-Z_]{3,40}$``).
ROLE_FORBIDDEN = "ROLE_FORBIDDEN"
MISSING_ENTITIES = "MISSING_ENTITIES"
INDICATOR_NOT_AVAILABLE = "INDICATOR_NOT_AVAILABLE"
SQL_REJECTED = "SQL_REJECTED"
COMPONENT_FAILURE = "COMPONENT_FAILURE"
MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
MISSING_ACCOUNT = "MISSING_ACCOUNT"
MISSING_PERIOD = "MISSING_PERIOD"
RESULT_NOT_INTERPRETABLE = "RESULT_NOT_INTERPRETABLE"
EXPLANATION_REJECTED = "EXPLANATION_REJECTED"
NO_ROWS = "NO_ROWS"
OPERATING_EXPENSES = "gastos_operativos"
SALDO_CUENTA = "saldo_cuenta"
OPERATING_EXPENSES_NOT_AVAILABLE = "OPERATING_EXPENSES_NOT_AVAILABLE"
RESTRICTED_DATA = "RESTRICTED_DATA"
MODULE_NOT_PERMITTED = "MODULE_NOT_PERMITTED"
NO_AUTHORIZED_TABLES = "NO_AUTHORIZED_TABLES"
INTENT_SQL_MISMATCH = "INTENT_SQL_MISMATCH"
FILTER_NOT_APPLIED = "FILTER_NOT_APPLIED"
FILTER_NOOP = "FILTER_NOOP"
LEFT_JOIN_NULLIFIED = "LEFT_JOIN_NULLIFIED"
UNREQUESTED_FILTER = "UNREQUESTED_FILTER"
VOIDED_ENTRIES_NOT_AVAILABLE = "VOIDED_ENTRIES_NOT_AVAILABLE"
_VOIDED_RE = re.compile(r"\b(?:anulad[oa]s?|annul\w*|void\w*)\b", re.IGNORECASE)
UNKNOWN_STATUS_VALUE = "UNKNOWN_STATUS_VALUE"

# Cifra principal que se explica en la respuesta breve, por tipo de plan.
PRIMARY_MARKERS: dict[str, frozenset[str]] = {"saldo_cuenta": frozenset({"c1"})}
# Etiquetas en lenguaje sencillo de las cifras del motor (no cambian sus fórmulas). ``c1`` es el
# saldo neto de los movimientos del período: NO incluye saldos de períodos anteriores.
FIGURE_LABELS: dict[str, dict[str, str]] = {
    "saldo_cuenta": {
        "c1": "Saldo neto de los movimientos del período",
        "c2": "Total del debe (cargos)",
        "c3": "Total del haber (abonos)",
    }
}
DETAIL_NOTES: dict[str, str] = {
    "saldo_cuenta": (
        "Solo considera movimientos de asientos registrados del período; no incluye asientos anulados "
        "ni saldos de períodos anteriores."
    ),
}


USAGE_LIMIT = "USAGE_LIMIT"


_EXPLICIT_ACCOUNT_RE = re.compile(r"\bcuenta\s+(?:n[°ºo.]\s*)?(\d{2,10})\b", re.IGNORECASE)


def _explicit_account(message: str) -> str | None:
    """Código de cuenta escrito literalmente por el usuario ("cuenta 40111"), o ``None``."""
    match = _EXPLICIT_ACCOUNT_RE.search(message)
    return match.group(1) if match else None


MODULE_RAG_K = 4
MAX_FREE_TABLES = 3
# Tablas operativas de un concepto contable en la ruta ampliada (si el intérprete eligió otras): los gastos
# operativos se registran como compras informales de tipo OperatingExpense, no en asientos. Una sola tabla: con
# cash_movement (sin relación con informal_purchase) el modelo generó un producto cruzado (batería 2026-10-25).
CONCEPT_TABLES: dict[str, tuple[str, ...]] = {"gastos_operativos": ("informal_purchase",)}
FREE_RETRY_BUDGET_MS = 22_000  # tras esto no se reintenta: interpretar + 2 generaciones + explicar caben en 55 s
FREE_ROUTE_NOTE = "Consulta fuera del catálogo entrenado: el SQL lo generó el modelo; revisa que responda tu pregunta."
# Pistas seguras para el único reintento (inglés, como la evidencia del entrenamiento); sin datos ni SQL.
RETRY_HINTS: tuple[tuple[str, str], ...] = (
    ("INTENT_SQL_MISMATCH", "The answer must read table {table} and use aggregate functions when a total, count or average is asked."),
    ("UNRESOLVED_REFERENCE", "A previous attempt used a table or column that is not in the schema above. Use only the listed tables and columns."),
    ("FILTER_NOOP", "A previous attempt filtered by every possible value. Filter only the value the question asks for."),
    ("LEFT_JOIN_NULLIFIED", "To find rows without related records use NOT EXISTS (SELECT 1 FROM ... WHERE ...); do not put conditions on a LEFT JOINed table in WHERE."),
    ("SET_OPERATION", "Write one SELECT from {table} only; do not use UNION."),
    ("STAR_NOT_ALLOWED", "SELECT * is not allowed: list the few columns needed to answer."),
    ("FORBIDDEN_FUNCTION", "A previous attempt used a function that is not allowed. Use only COUNT, SUM, AVG, MIN, MAX, COALESCE, ROUND, DATE_TRUNC, EXTRACT and CAST; for the highest or lowest value use ORDER BY ... LIMIT 1, not ROW_NUMBER or RANK."),
    ("UNDEFINED_COLUMN", "A previous attempt referenced a column that does not exist. Use only the listed columns."),
    ("UNDEFINED_TABLE", "A previous attempt referenced a table that does not exist. Use only the listed tables."),
    ("GROUPING_ERROR", "A previous attempt failed: every selected column that is not aggregated must appear in GROUP BY."),
    ("DATATYPE_MISMATCH", "A previous attempt compared values of different types. Compare dates with dates and numbers with numbers."),
    ("SQL_REJECTED", "A previous attempt was rejected by the SQL validator. Write one simple SELECT using only the listed tables and columns."),
    ("TRUNCATED_OUTPUT", "Write a short query: select only the few columns needed to answer, and use LIMIT 1 for the latest record."),
    ("INVALID_TEXT_REPRESENTATION", "A previous attempt compared a status or type with a value that does not exist. Use exactly the listed values."),
    ("REGISTERED_FILTER_UNGUARANTEED", "Accounting lines must be joined to journal_entry on journal_entry_detail.entry_id = journal_entry.id; only registered entries count (journal_entry.status = TRUE). Use INNER JOIN."),
    ("UNPARSEABLE_SQL", "A previous attempt was not valid PostgreSQL. Write one simple SELECT with only the listed tables and columns; do not build JSON."),
    ("SQLGEN_INVALID_OUTPUT", "Return exactly one PostgreSQL SELECT statement."),
    ("SQLEXEC_FAILED", "A previous attempt failed in the database. Write one simple SELECT using only the listed tables and columns."),
)
_AGGREGATE_WORDS = re.compile(r"(count|total|sum|average|avg|mean|promedio|cantidad|number)")


def _free_request(free: FreeQuery, module: str, period: Period | None, time_concept: str | None = None) -> dict[str, object]:
    """Solicitud con las 12 claves del contrato 1.0 a partir de la interpretación (vocabulario abierto).

    ``time_concept``: columna de fecha ya verificada contra las tablas elegidas (``ErpModules.time_concept``)."""
    from datetime import timedelta

    time = None
    if period is not None:
        concept = time_concept or free.concepto_tiempo or "date"
        time = {"concept": concept, "end_exclusive": (period.hasta + timedelta(days=1)).isoformat(),
                "grain": "day" if free.intent == "timeseries" else None, "start": period.desde.isoformat()}
    return {
        "comparison": None,
        "conditions": list(free.conditions),
        "dimensions": list(free.dimensions),
        "domain": MODULE_DOMAIN.get(module, "cross_domain"),
        "filters": [f.model_dump() for f in free.filters],
        "group_by": list(free.group_by),
        "intent": free.intent,
        "limit": free.limit,
        "metrics": list(free.metrics),
        "order_by": [o.model_dump() for o in free.order_by],
        "subject": free.subject,
        "time": time,
    }


def _requested_text(free: FreeQuery, message: str) -> str:
    """Todo lo que la pregunta y su interpretación nombran (para distinguir filtros pedidos de filtros añadidos)."""
    parts = [message, free.pregunta_en, free.busqueda, *free.metrics, *free.conditions, *free.dimensions,
             *(f"{f.field} {f.value}" for f in free.filters)]
    return " ".join(parts).replace("_", " ")


def _intent_mismatch(free: FreeQuery, tables: list[str], sql: str, modules: ErpModules, message: str = "") -> str | None:
    """Contradicción evidente entre la intención y el SQL validado (Caso B): la entidad principal no se lee,
    o se pide un total/conteo/promedio y el SQL no agrega nada."""
    try:
        tree = sqlglot.parse_one(sql, read="postgres")
    except SqlglotError:
        return None
    read = {t.name for t in tree.find_all(exp.Table)}
    keys = {c.name for c in tree.find_all(exp.Column)}
    # La entidad principal se lee directamente o por su clave ("proveedores distintos" = COUNT(DISTINCT supplier_id)).
    if free.subject in modules.tables and free.subject in tables and free.subject not in read and f"{free.subject}_id" not in keys:
        return INTENT_SQL_MISMATCH
    if modules.unknown_values(sql):  # p. ej. status = 'pending' cuando los estados son Received… Cancelled
        return UNKNOWN_STATUS_VALUE
    # El filtro pedido (Yape, Factura, EXPENSE…) debe estar en el SQL y no puede enumerar todos los valores.
    problem = modules.filter_problem(sql, [(f.operator, f.value) for f in free.filters], tables)
    if problem:
        return problem
    if modules.left_join_nullified(sql):
        return LEFT_JOIN_NULLIFIED
    requested = _requested_text(free, message)
    # Los textos buscados (un producto, un proveedor) los escribe el usuario: no valen las palabras del objetivo en
    # inglés, que nombran tablas ("supplier") y llevaron a ILIKE '%supplier%'.
    typed = " ".join([message, *(f.value for f in free.filters)])
    if modules.unrequested_flags(sql, requested, tables) or modules.invented_patterns(sql, typed):
        return UNREQUESTED_FILTER
    wants_aggregate = free.intent == "aggregate" and any(_AGGREGATE_WORDS.search(m) for m in free.metrics)
    if wants_aggregate and tree.find(exp.AggFunc) is None:
        return INTENT_SQL_MISMATCH
    return None


# Filtros de "higiene" que las familias entrenadas ya aplican a su modo (registrados, emitidos, activos).
HYGIENE_FIELDS = frozenset({"status", "active", "annulled"})
# Medidas que una familia solo responde si alguna de sus métricas las calcula (promedio, conteo, IGV…).
_AGGREGATIONS = ("average", "avg", "mean", "minimum", "min_", "maximum", "max_", "count", "igv", "tax", "subtotal")


def _span(plans: list[QueryPlan]) -> Period:
    """Período que abarcan los planes (uno, o los dos que se comparan)."""
    return Period(desde=min(p.periodo.desde for p in plans), hasta=max(p.periodo.hasta for p in plans))


def _public_codes(codes: list[str]) -> list[str]:
    """Códigos para el cliente: los de presupuesto se resumen (sin detalles económicos, D-14)."""
    public: list[str] = []
    for code in codes:
        code = USAGE_LIMIT if code.startswith("BUDGET_") or code == "REQUEST_LIMIT" else code
        if code not in public:
            public.append(code)
    return public[:20]


class ErrorBody(StrictModel):
    """Cuerpo de error con la convención del ERP: ``{ error, errores? }``."""

    error: str
    errores: Annotated[list[str], Field(max_length=20)] = Field(default_factory=list)
    # Solo en modo diagnóstico autorizado; si es ``None`` la API lo omite del JSON.
    diagnostico: Diagnostic | None = None


@dataclass(frozen=True)
class PipelineOutcome:
    status_code: int
    body: QueryResponse | ErrorBody
    audit: AuditRecord | None = None
    security_incident: bool = False
    """``True`` si el procesamiento se detuvo por un :class:`SecurityIncident` (para alertas)."""
    trace: Diagnostic | None = None
    """Traza técnica de la consulta, siempre calculada (para el log); el cuerpo solo la lleva si se pidió."""


@dataclass
class _Run:
    """Estado interno de una ejecución (nunca sale del pipeline)."""

    estado: ResponseState = "no_resoluble"
    texto: str = TEXTS["no_resoluble"]
    codes: list[str] = field(default_factory=list)
    intencion: Intent | None = None
    normalized_sql: str | None = None
    rows: int | None = None
    figures: tuple[Figure, ...] = ()
    evidences: list[Evidence] = field(default_factory=list)
    security_incident: bool = False
    detalle: Detail | None = None


class Orchestrator:
    def __init__(
        self,
        *,
        interpreter: Interpreter,
        retriever: Retriever,
        generator: SqlGenerator,
        validator: SqlValidator,
        executor: SqlExecutor,
        finance: FinanceEngine,
        explainer: Explainer,
        audit_sink: AuditSink,
        pseudonymizer: Pseudonymizer | None,
        allowed_roles: frozenset[str],
        clock: Callable[[], datetime],
        versions: Mapping[str, str] | None = None,
        retrieval_k: int = 3,
        prefilter_fn: Callable[[QueryRequest], PrefilterDecision] = prefilter,
        account_names: Mapping[str, str] | None = None,
        families: FamilyCatalog | None = None,
        modules: ErpModules | None = None,
        module_retriever: Retriever | None = None,
    ) -> None:
        if pseudonymizer is None:
            raise AuditConfigError("Falta la clave de auditoría; el orquestador no puede operar.")
        self._interpreter = interpreter
        self._retriever = retriever
        self._generator = generator
        self._validator = validator
        self._executor = executor
        self._finance = finance
        self._explainer = explainer
        self._audit = audit_sink
        self._pseudonymizer = pseudonymizer
        self._roles = frozenset(allowed_roles)
        self._clock = clock
        self._versions = dict(versions or {})
        self._k = retrieval_k
        # Inyectable solo para probar el escenario "el prefiltro falla"; por defecto, el real.
        self._prefilter = prefilter_fn
        # Nombres visibles de las cuentas (catálogo del servidor); nunca proceden del usuario.
        self._account_names = dict(account_names or {})
        # Familias de consulta entrenadas (P1); sin catálogo, solo el saldo de una cuenta.
        self._families = families
        # Ruta ampliada: módulos del ERP y su RAG local (fragmentos por tabla).
        self._modules = modules
        self._module_retriever = module_retriever

    # ------------------------------------------------------------------ API pública
    def handle(
        self,
        payload: QueryRequest | Mapping[str, object] | str,
        *,
        authorization: AuthorizationContext | None = None,
        diagnostics: bool = False,
    ) -> PipelineOutcome:
        """``authorization``: contexto ya verificado por la API (P-9). Sin él, el rol de CT-B se usa
        como contexto provisional que solo restringe el alcance y nunca habilita datos reales.

        ``diagnostics``: adjuntar la traza técnica al cuerpo. Lo decide la API (modo diagnóstico
        autorizado); la traza se calcula siempre y queda en ``PipelineOutcome.trace`` para el log."""
        try:
            request = self._parse(payload)
        except ValidationError as exc:
            fields = sorted({".".join(str(p) for p in err["loc"]) for err in exc.errors()})[:20]
            return PipelineOutcome(400, ErrorBody(error=ERROR_INVALID_REQUEST, errores=fields))

        if request.usuario.rol not in self._roles or (
            authorization is not None and authorization.rol != request.usuario.rol
        ):
            run = _Run(codes=[ROLE_FORBIDDEN])
            return PipelineOutcome(403, ErrorBody(error=ERROR_FORBIDDEN), self._write_audit(request, run))

        with tracing.recording() as recorder:
            return self._handle_recorded(request, authorization, recorder, diagnostics)

    def _handle_recorded(
        self,
        request: QueryRequest,
        authorization: AuthorizationContext | None,
        recorder: tracing.TraceRecorder,
        attach: bool,
    ) -> PipelineOutcome:
        run = _Run()
        status = 200
        try:
            self._run(request, run, authorization or AuthorizationContext(rol=request.usuario.rol))
        except BudgetDenied as exc:
            run.codes.append(exc.reason.upper())
            status = 503
        except SecurityIncident as exc:
            # Se detiene el procesamiento: ningún componente posterior se invoca. Error genérico al
            # cliente (sin datos) y marca explícita en el resultado y la auditoría.
            run.codes.extend([SECURITY_INCIDENT, exc.code])
            run.security_incident = True
            status = 503
        except ModelUnavailable as exc:
            run.codes.extend([MODEL_UNAVAILABLE, exc.code])  # p. ej. INCOMPLETE_RESPONSE, TIMEOUT
            status = 503
        except ClassifiedError as exc:  # solo llegan aquí los transitorios (servicio, timeout)
            run.codes.extend([exc.category, exc.code])
            status = 503
        except Exception:  # fallo de cualquier otro componente: respuesta controlada
            run.codes.append(COMPONENT_FAILURE)
            status = 503

        audit = self._write_audit(request, run)
        recorder.intencion = run.intencion
        recorder.rows = run.rows
        trace = recorder.build()
        attached = trace if attach else None
        if status != 200:
            # Códigos fijos de auditoría (sin SQL, rutas ni credenciales): el proxy los traduce a un
            # mensaje que dice qué componente falló, en lugar de un "no disponible" indistinguible.
            body = ErrorBody(error=ERROR_UNAVAILABLE, errores=_public_codes(run.codes), diagnostico=attached)
            return PipelineOutcome(status, body, audit, security_incident=run.security_incident, trace=trace)
        response = QueryResponse(
            id_traza=request.id_traza,
            estado=run.estado,
            texto=run.texto,
            cifras=list(run.figures),
            evidencias=run.evidences,
            versiones=self._versions,
            detalle=run.detalle,
            diagnostico=attached,
        )
        return PipelineOutcome(200, response, audit, trace=trace)

    # ------------------------------------------------------------------ flujo
    @staticmethod
    def _parse(payload: QueryRequest | Mapping[str, object] | str) -> QueryRequest:
        if isinstance(payload, QueryRequest):
            return payload
        if isinstance(payload, str):
            return QueryRequest.model_validate_json(payload)
        return QueryRequest.model_validate(payload, strict=False)

    def _finish(self, run: _Run, estado: ResponseState, text_key: str | None = None, code: str | None = None) -> None:
        run.estado = estado
        if code:
            run.codes.append(code)
        # Primero el texto del motivo concreto (el último código con texto propio); si no hay, el del estado.
        reason = next((c for c in reversed(run.codes) if c in REASON_TEXTS), None) if text_key is None else None
        run.texto = REASON_TEXTS[reason] if reason else TEXTS[text_key or estado]

    def _run(self, request: QueryRequest, run: _Run, authorization: AuthorizationContext) -> None:
        trace = tracing.current() or tracing.TraceRecorder()
        with trace.stage("prefiltro"):
            decision = self._prefilter(request)
        if not decision.allowed:
            trace.fail("prefiltro", decision.reason or "BLOCKED")
            text_key = "datos_sensibles" if decision.reason == "SENSITIVE_DATA" else None
            self._finish(run, decision.estado or "no_resoluble", text_key, decision.reason)
            return  # ningún modelo invocado

        with trace.stage("interpretacion"):
            interpretation = self._interpreter.interpret(request)
        run.intencion = interpretation.intencion
        trace.intencion = interpretation.intencion
        if interpretation.cuenta and interpretation.cuenta.isdigit() and len(interpretation.cuenta) <= 10:
            trace.cuenta = interpretation.cuenta
        if interpretation.intencion == "escritura":
            self._finish(run, "solo_lectura", code="WRITE_INTENT")
            return
        if interpretation.restringido:
            # Usuarios, contraseñas, roles, auditoría, empleados, sueldos o datos personales: nunca se consultan
            # (tiene prioridad sobre "fuera de dominio": el motivo se dice).
            trace.add("plan", "fallo", RESTRICTED_DATA)
            self._finish(run, "no_resoluble", code=RESTRICTED_DATA)
            return
        if interpretation.intencion == "fuera_de_dominio":
            self._finish(run, "fuera_de_dominio", code="OUT_OF_DOMAIN_INTENT")
            return
        free = interpretation.consulta_libre if self._modules is not None else None
        # P1: una familia de consulta entrenada elegida de la lista cerrada tiene prioridad (también
        # sobre un "indicador": p. ej. "¿ganancias o pérdidas?" → ventas frente a compras).
        # Un código de cuenta escrito por el usuario ("cuenta 40111") es un dato literal: manda el saldo
        # de esa cuenta aunque el intérprete haya elegido una familia.
        explicit_account = _explicit_account(request.mensaje)
        concepto = interpretation.concepto
        if self._families is None or concepto not in self._families.concepts:
            concepto = None  # fuera de la lista cerrada: se ignora
        trace.concepto = concepto
        if concepto == OPERATING_EXPENSES and not explicit_account and free is None:
            # Ninguna familia entrenada mide gastos operativos: se dice, sin sustituirlos por compras.
            trace.add("plan", "fallo", OPERATING_EXPENSES_NOT_AVAILABLE)
            self._finish(run, "no_resoluble", code=OPERATING_EXPENSES_NOT_AVAILABLE)
            return
        focus = None
        if explicit_account or concepto == SALDO_CUENTA or (free is not None and interpretation.consulta is None):
            family = None  # saldo de cuenta, o ruta ampliada (sin familia entrenada)
        else:
            family, adjustment = self._family_for(interpretation, concepto)
            if family is not None:
                decision, focus, free = self._family_filters(family, free, request.mensaje)
                if decision == "libre":
                    family, adjustment = None, "FAMILY_FILTER_NOT_SUPPORTED"  # p. ej. "ventas pagadas con Yape"
                elif decision == "foco":
                    adjustment = adjustment or "FAMILY_GROUP_FOCUS"  # p. ej. "¿cuánto se pagó con tarjeta?"
            if adjustment:
                run.codes.append(adjustment)  # auditoría: la familia se ajustó al concepto contable
                trace.ajuste = adjustment
        if family is None and not explicit_account and concepto != SALDO_CUENTA and free is not None:
            self._run_free(request, interpretation, free, run, trace, authorization)  # ruta ampliada
            return
        if family is None and interpretation.indicador is not None:
            trace.add("plan", "fallo", INDICATOR_NOT_AVAILABLE)
            self._finish(run, "no_resoluble", code=INDICATOR_NOT_AVAILABLE)  # catálogo pendiente (P-6)
            return

        # Rol ya revalidado en ``handle`` contra la allowlist (verificado por P-9 o provisional).
        trace.ruta = "entrenada" if family is not None else "saldo"
        defaulted = False
        with trace.stage("plan"):
            if family is not None:
                plans, defaulted = self._family_plans(request, family, authorization, interpretation.historico)
                metric = self._family_metric(family, free)
                plans = [replace(p, foco=focus, metrica=metric) for p in plans]
                missing = ""
            else:
                account = explicit_account or interpretation.cuenta
                plan, missing = self._resolve_plan_or_missing(request, account, authorization)
                plans = [plan] if plan is not None else []
        if not plans:  # falta cuenta o período tras revisar mensaje, historial y contexto
            trace.fail("plan", missing)
            run.codes.append(MISSING_ENTITIES)
            self._finish(run, "requiere_aclaracion", code=missing)
            return
        plan = plans[0]
        trace.cuenta = plan.cuenta or None
        trace.periodo = plan.periodo
        trace.consulta = plan.familia

        with trace.stage("recuperacion"):
            fragments = self._retriever.retrieve(request.mensaje, self._k)
        trace.fragments = len(fragments)
        # Con Milvus, un fallo cae al léxico sin error: la traza dice qué recuperador respondió.
        trace.rag_source = getattr(self._retriever, "last_source", "lexico")
        trace.rag_index = "milvus" if "milvus" in self._versions.get("rag", "") else "local"

        results = []
        for current in plans:  # dos planes solo al comparar dos períodos de una familia escalar
            rows = self._sql_rows(current, fragments, authorization, run, trace)
            if rows is None:
                return
            try:
                with trace.stage("calculo"):
                    results.append(self._finance.compute(current, rows))
            except FinanceEngineError:
                # El SQL se ejecutó, pero las filas no permiten calcular cifras verificables: se dice así,
                # sin cifras, en lugar de un 503 que lo confunda con un servicio caído.
                self._finish(run, "no_resoluble", code=RESULT_NOT_INTERPRETABLE)
                run.evidences = []
                return
        # Al comparar dos períodos, uno sin filas vale 0 (suma vacía); solo si ambos están vacíos no hay datos.
        if all(r.no_data for r in results) or (len(results) == 1 and results[0].no_data):
            self._finish(run, "sin_datos", code=NO_ROWS if family is not None else None)
            return
        result = self._compare_periods(plans, results) if len(results) == 2 else results[0]

        # La explicación muestra primero el resultado principal; el resto de cifras verificadas se
        # entrega en ``cifras`` y ``detalle`` ("Ver detalles del cálculo").
        if family is not None:
            explained = tuple(f for f in result.figures if f.marcador in result.primary)
            meanings = {m: s for m, s in result.meanings.items() if m in result.primary or m.startswith("e")}
            extra: dict[str, object] = {"consulta": family.titulo, "meanings": meanings, "text_labels": result.text_labels}
            account_name = None
        else:
            primary = PRIMARY_MARKERS.get(plan.kind)
            explained = tuple(f for f in result.figures if primary is None or f.marcador in primary)
            extra = {}
            account_name = self._account_names.get(plan.cuenta)
        try:
            with trace.stage("explicacion"):
                text = self._explainer.explain(
                    trace_id=request.id_traza,
                    intencion=interpretation.intencion,
                    periodo=_span(plans),
                    figures=explained,
                    cuenta_nombre=account_name,
                    **extra,
                )
        except MarkerValidationError as exc:
            run.codes.append(exc.code)
            self._finish(run, "no_resoluble", code=EXPLANATION_REJECTED)  # explicación descartada (FR-020)
            run.evidences = []
            return
        run.estado = "respondida"
        run.texto = text
        run.figures = result.figures
        if family is not None:
            run.detalle = self._family_detail(family, plans, result, defaulted)
        else:
            run.detalle = self._detail(plan, result.figures, account_name)

    def _sql_rows(
        self,
        plan: QueryPlan,
        fragments: list,
        authorization: AuthorizationContext,
        run: _Run,
        trace: tracing.TraceRecorder,
        check: Callable[[str], str | None] | None = None,
    ) -> list | None:
        """Generación (XiYanSQL) → SQL Validator → Executor para un plan. ``None`` si la consulta
        terminó en un estado controlado (ya fijado en ``run``); los fallos transitorios se propagan.

        ``check`` (ruta ampliada): coherencia entre la intención y el SQL ya validado; si devuelve un
        código, el SQL no se ejecuta (se puede reintentar una vez)."""
        try:
            with trace.stage("generacion_sql"):
                candidate = self._generator.generate(plan, fragments)
        except SqlGenerationError as exc:
            if exc.transient:
                raise  # 503 en ``handle``
            run.codes.extend([exc.category, exc.code])
            self._finish(run, "no_resoluble")
            return None  # sin SQL: el validador y el Executor NO se invocan
        if trace.generated_sql is None:  # XiYanSQL ya registró su salida cruda (antes del filtro P-4)
            trace.generated_sql = candidate.sql
        with trace.stage("validacion_sql"):
            verdict = self._validator.validate(candidate.sql, authorization.rol)
        if not verdict.approved:
            trace.fail("validacion_sql", SQL_REJECTED)
            trace.rejection_reasons = list(verdict.reasons)
            run.codes.extend([SQL_REJECTED, *verdict.reasons])
            self._finish(run, "no_resoluble")
            run.evidences = []
            return None  # el Executor NO se invoca

        run.normalized_sql = verdict.normalized_sql
        trace.validated_sql = verdict.normalized_sql
        # Permisos por módulo (claim firmada ``mod``): el SQL solo puede leer tablas de esos módulos.
        outside = self._tables_outside_modules(verdict.normalized_sql or "", authorization)
        if outside:
            trace.fail("validacion_sql", MODULE_NOT_PERMITTED)
            run.codes.append(MODULE_NOT_PERMITTED)
            self._finish(run, "no_resoluble")
            run.evidences = []
            return None
        mismatch = check(verdict.normalized_sql or "") if check else None
        if mismatch:
            trace.fail("validacion_sql", mismatch)
            run.codes.append(mismatch)
            self._finish(run, "no_resoluble")
            run.evidences = []
            return None
        execute_authorized = getattr(self._executor, "execute_authorized", None)
        try:
            with trace.stage("ejecucion_sql"):
                rows = (
                    execute_authorized(verdict, authorization)
                    if callable(execute_authorized)
                    else self._executor.execute(verdict)
                )
        except SqlExecutionError as exc:
            if exc.transient:
                raise  # 503 en ``handle``
            run.codes.extend([exc.category, exc.code])
            self._finish(run, "no_resoluble")
            run.evidences = []
            return None  # sin filas: no hay cifras
        run.rows = (run.rows or 0) + len(rows)
        trace.rows = run.rows
        run.evidences.append(self._evidence(verdict.normalized_sql, len(rows)))
        return list(rows)

    # ------------------------------------------------------------------ ruta ampliada
    def _run_free(
        self,
        request: QueryRequest,
        interpretation: Interpretation,
        free: FreeQuery,
        run: _Run,
        trace: tracing.TraceRecorder,
        authorization: AuthorizationContext,
    ) -> None:
        """Pregunta legítima del ERP sin familia entrenada: RAG local de módulos → solicitud con la forma
        del contrato 1.0 → XiYanSQL → validador → Neon. Un solo reintento con una pista segura si el SQL
        falla de forma recuperable y queda presupuesto de tiempo. Nada se inventa: sin SQL ejecutado no
        hay cifras."""
        assert self._modules is not None
        trace.ruta = "ampliada"
        modules = self._modules
        permitted = modules.tables_for(authorization.modulos)
        defaulted = False
        with trace.stage("plan"):
            period = None
            if free.usa_periodo:
                reference = request.fecha_referencia_lima
                period = resolve_period(request.mensaje, reference) or resolve_period_from(
                    reversed(user_turns(request)), reference
                )
                defaulted = period is None
                period = period or (full_history(reference) if interpretation.historico else month_to_date(reference))
        trace.periodo = period
        with trace.stage("recuperacion"):
            query = f"{request.mensaje} {free.busqueda}".strip()
            hits = self._module_retriever.retrieve(query, MODULE_RAG_K) if self._module_retriever else []
        rag_tables = [f.fuente.split(":", 1)[1] for f in hits if f.fuente.startswith("modulo:")]
        trace.fragments, trace.rag_source = len(hits), getattr(self._module_retriever, "last_source", "lexico")
        trace.rag_index = "local"  # catálogo de módulos en memoria (no Milvus)
        trace.tablas_rag = tuple(rag_tables)
        chosen = self._free_tables(free, interpretation, rag_tables, permitted)
        if not chosen:
            code = MODULE_NOT_PERMITTED if any(t in modules.tables for t in free.tablas) else NO_AUTHORIZED_TABLES
            trace.add("plan", "fallo", code)
            self._finish(run, "no_resoluble", code=code)
            return
        if {"journal_entry", "journal_entry_detail"} & set(chosen) and _VOIDED_RE.search(_requested_text(free, request.mensaje)):
            # P-4: el asistente solo lee asientos registrados. Pedir anulados no se "resuelve" contando registrados
            # (respuesta real de la batería: "81 anulados" que eran los 81 registrados): se dice el límite.
            trace.add("plan", "fallo", VOIDED_ENTRIES_NOT_AVAILABLE)
            self._finish(run, "no_resoluble", code=VOIDED_ENTRIES_NOT_AVAILABLE)
            return
        module = free.modulo if free.modulo in modules.modules else modules.tables[chosen[0]].module
        if module not in modules.modules or not set(chosen) & modules.tables_for([module]):
            module = modules.tables[chosen[0]].module  # el módulo de la solicitud es el de las tablas elegidas
        time_concept = None
        if period is not None:
            time_concept, adjusted = modules.time_concept(free.concepto_tiempo, chosen, free.subject)
            if adjusted and trace.ajuste is None:
                trace.ajuste = "TIME_CONCEPT_ADJUSTED"  # p. ej. created_at en una tabla sin esa columna
        plan = QueryPlan(
            kind="libre", cuenta="", periodo=period, autorizacion=authorization,  # type: ignore[arg-type]
            solicitud=_free_request(free, module, period, time_concept), tablas=tuple(chosen), modulo=module,
            objetivo=free.pregunta_en or None,
        )

        def check(sql: str) -> str | None:
            return _intent_mismatch(free, chosen, sql, modules, request.mensaje)

        rows = self._sql_rows(plan, [], authorization, run, trace, check=check)
        if rows is None:
            retry = self._free_retry(plan, run, trace)
            if retry is None:
                return
            trace.reintento, trace.sql_previo = retry[0], trace.generated_sql
            trace.generated_sql = None
            rows = self._sql_rows(retry[1], [], authorization, run, trace, check=check)
            if rows is None:
                return
            plan = retry[1]
        try:
            with trace.stage("calculo"):
                result = self._finance.compute(plan, rows)
        except FinanceEngineError:
            self._finish(run, "no_resoluble", code=RESULT_NOT_INTERPRETABLE)
            run.evidences = []
            return
        if result.no_data:
            self._finish(run, "sin_datos", code=NO_ROWS)  # consulta válida sin registros
            return
        name = modules.module_name(module)
        explained = tuple(f for f in result.figures if f.marcador in result.primary)
        meanings = {m: s for m, s in result.meanings.items() if m in result.primary or m.startswith("e")}
        try:
            with trace.stage("explicacion"):
                text = self._explainer.explain(
                    trace_id=request.id_traza, intencion=interpretation.intencion, periodo=period, figures=explained,
                    cuenta_nombre=None, consulta=f"Consulta sobre {name}"[:90], meanings=meanings,
                    text_labels=result.text_labels,
                )
        except MarkerValidationError as exc:
            run.codes.append(exc.code)
            self._finish(run, "no_resoluble", code=EXPLANATION_REJECTED)
            run.evidences = []
            return
        run.estado, run.texto, run.figures = "respondida", text, result.figures
        notes = list(result.notes)
        if defaulted:
            notes.insert(0, f"No indicaste un período: se consultó {default_period_text(period)}.")
        notes.append(FREE_ROUTE_NOTE)
        run.detalle = Detail(
            tipo="consulta", titulo=f"Consulta ampliada · {name}"[:80], periodo=period,
            etiquetas=[FigureLabel(marcador=f.marcador, etiqueta=result.labels[f.marcador][:80]) for f in result.figures],
            nota=" ".join(notes)[:200],
        )

    def _free_tables(
        self, free: FreeQuery, interpretation: Interpretation, rag_tables: list[str], permitted: set[str]
    ) -> list[str]:
        """Tablas del prompt, en orden de prioridad. Las del intérprete mandan (entendió la pregunta); el RAG
        solo completa cuando el intérprete no dio ninguna válida: añadir tablas "por si acaso" llevaba al
        modelo a contar o sumar la tabla equivocada (p. ej. order_table en lugar de dining_table)."""
        assert self._modules is not None
        known = self._modules.tables
        concept_tables = CONCEPT_TABLES.get(interpretation.concepto or "", ())
        own = [t for t in free.tablas if t in known]
        if concept_tables and not set(own) & set(concept_tables):
            own = list(concept_tables)  # el concepto contable fija dónde se registra la magnitud
        elif free.subject in known and free.subject not in own:
            own.insert(0, free.subject)
        chosen = [t for t in dict.fromkeys(own) if t in permitted]
        if not chosen:
            chosen = [t for t in dict.fromkeys(rag_tables) if t in permitted]
        return chosen[:MAX_FREE_TABLES]

    def _free_retry(self, plan: QueryPlan, run: _Run, trace: tracing.TraceRecorder) -> tuple[str, QueryPlan] | None:
        """Un único reintento si el fallo es recuperable y queda presupuesto de tiempo (evaluación en Vercel)."""
        if trace.total_ms() > FREE_RETRY_BUDGET_MS:
            run.codes.append("RETRY_SKIPPED_TIME_BUDGET")
            return None
        codes = set(run.codes)
        if "PROMPT_TOO_LONG" in codes and len(plan.tablas) > 1:
            return "PROMPT_TOO_LONG", replace(plan, tablas=plan.tablas[:-1])
        assert self._modules is not None
        if UNKNOWN_STATUS_VALUE in codes or "INVALID_TEXT_REPRESENTATION" in codes:
            notes = " ".join(n for t in plan.tablas if t in self._modules.tables for n in self._modules.tables[t].notes.values()
                             if "status" in n or "type" in n)
            return UNKNOWN_STATUS_VALUE, replace(plan, pista=f"Use exactly these values. {self._modules.values_hint(plan.tablas)} {notes}".strip())
        subject = (plan.solicitud or {}).get("subject")
        if UNREQUESTED_FILTER in codes and trace.generated_sql:
            asked = f"{plan.objetivo or ''} {json.dumps(plan.solicitud or {})}".replace("_", " ")
            flags = self._modules.unrequested_flags(trace.generated_sql, asked, plan.tablas)
            hint = f"Do not filter by {', '.join(flags)}: the question does not ask for it." if flags else                 "Do not filter by names or texts that the question does not mention."
            return UNREQUESTED_FILTER, replace(plan, pista=hint)
        if codes & {"UNRESOLVED_REFERENCE", "UNDEFINED_COLUMN"} and trace.generated_sql:
            missing, dates = self._modules.unknown_columns(trace.generated_sql, plan.tablas)
            if missing:
                hint = f"Columns {', '.join(missing)} do not exist. Use only the listed columns"
                hint += f"; date columns are {', '.join(dates)}." if dates else "."
                return "UNRESOLVED_REFERENCE", replace(plan, pista=hint)
        if FILTER_NOT_APPLIED in codes:
            wanted = [self._modules.find_value(str(f.get("value", "")), plan.tablas) for f in (plan.solicitud or {}).get("filters") or []]
            exact = " ".join(f"Filter {t}.{c} = '{v}'." for t, c, v in filter(None, wanted))
            return FILTER_NOT_APPLIED, replace(plan, pista=f"The question asks for a specific value. {exact}".strip())
        if "SET_OPERATION" in codes and len(plan.tablas) > 1:
            main = str(subject) if subject in plan.tablas else plan.tablas[0]
            return "SET_OPERATION", replace(plan, tablas=(main,), pista=dict(RETRY_HINTS)["SET_OPERATION"].format(table=main))
        if INTENT_SQL_MISMATCH in codes and subject in plan.tablas and len(plan.tablas) > 1:
            # La entidad principal no se leyó: se reintenta mostrando solo su tabla.
            hint = dict(RETRY_HINTS)[INTENT_SQL_MISMATCH].format(table=subject)
            return INTENT_SQL_MISMATCH, replace(plan, tablas=(str(subject),), pista=hint)
        if "REGISTERED_FILTER_UNGUARANTEED" in codes and "journal_entry" not in plan.tablas:
            # P-4 exige leer journal_entry: se incluye en el esquema del reintento.
            tables = (*plan.tablas[: MAX_FREE_TABLES - 1], "journal_entry")
            hint = dict(RETRY_HINTS)["REGISTERED_FILTER_UNGUARANTEED"]
            return "REGISTERED_FILTER_UNGUARANTEED", replace(plan, tablas=tables, pista=hint)
        for code, hint in RETRY_HINTS:
            if code in codes:
                target = plan.tablas[0]
                return code, replace(plan, pista=hint.format(table=target))
        return None

    def _tables_outside_modules(self, sql: str, authorization: AuthorizationContext) -> list[str]:
        if self._modules is None or authorization.modulos is None:
            return []
        permitted = self._modules.tables_for(authorization.modulos)
        known = set(self._modules.tables)
        try:
            tree = sqlglot.parse_one(sql, read="postgres")
        except SqlglotError:
            return ["?"]
        ctes = {cte.alias_or_name for cte in tree.find_all(exp.CTE)}
        return [t.name for t in tree.find_all(exp.Table) if t.name not in ctes and (t.name in known and t.name not in permitted)]

    # ------------------------------------------------------------------ familias (P1)
    def _family_filters(
        self, family: QueryFamily, free: FreeQuery | None, message: str
    ) -> tuple[str | None, str | None, FreeQuery | None]:
        """Filtros concretos de la pregunta frente a una familia entrenada (que no admite filtros propios):

        - ``("foco", valor, …)``: un único valor de la columna por la que la familia agrupa ("con tarjeta" en
          cobros por medio de pago) → se ejecuta la familia y la respuesta es ese grupo;
        - ``("libre", None, consulta)``: otro filtro (un medio de pago en el total de cobros, "facturas" en el
          conteo de comprobantes, un producto…) → ruta ampliada con el filtro en la solicitud;
        - ``(None, None, consulta)``: la familia responde la pregunta tal cual.

        Los valores salen del catálogo (``ErpModules``), del intérprete o de la propia pregunta; nunca de una lista
        de preguntas."""
        if self._modules is None:
            return None, None, free
        modules, tables = self._modules, family.real_tables
        wanted: dict[tuple[str, str], str] = {}
        unknown = False
        for item in (free.filters if free is not None else []):
            if item.operator not in ("eq", "contains") or item.field.rsplit("_", 1)[-1] in HYGIENE_FIELDS                     or item.field.endswith(("_at", "date")):
                continue
            hit = modules.find_value(item.value, tables)
            if hit:
                wanted[hit[:2]] = hit[2]
            elif item.operator == "contains" or "name" in item.field:
                unknown = True  # texto libre (un producto, un proveedor): la familia no puede filtrarlo
        for table, column, value in modules.mentioned_values(message, tables):
            wanted.setdefault((table, column), value)
        # Una agregación que la familia no calcula (promedio, mínimo, máximo) tampoco la responde la familia.
        asked = {a for m in (free.metrics if free is not None else []) for a in _AGGREGATIONS if a in m}
        if asked - {a for m in family.metrics for a in _AGGREGATIONS if a in m}:
            unknown = True
        if not wanted and not unknown:
            return None, None, free
        groups = {f"{t}_{c}" for t, c in wanted} | {c for _, c in wanted} | {t for t, _ in wanted}
        if not unknown and len(wanted) == 1 and family.shape in ("agrupada", "ranking") and groups & set(family.labels):
            return "foco", next(iter(wanted.values())), free
        if free is None:
            return None, None, free  # sin forma de la consulta no hay ruta ampliada: responde la familia
        present = {(f.field, f.value.lower()) for f in free.filters}
        extra = [FreeFilter(field=c, operator="eq", value=v) for (t, c), v in wanted.items()
                 if not any(v.lower() in value or value in v.lower() for _, value in present)]
        if extra:
            free = free.model_copy(update={"filters": [*free.filters, *extra][:6]})
        return "libre", None, free

    @staticmethod
    def _family_metric(family: QueryFamily, free: FreeQuery | None) -> str | None:
        """Métrica de la familia que más se parece a la pedida ("unidades vendidas" → dish_units_sold, no el importe);
        ``None`` si la pregunta no la distingue (se usa la principal de la familia)."""
        if free is None or len(family.metrics) < 2:
            return None
        asked = {w for m in free.metrics for w in m.split("_")} | {w.rstrip("s") for m in free.metrics for w in m.split("_")}
        scores = {m: len(({w for w in m.split("_")} | {w.rstrip("s") for w in m.split("_")}) & asked) for m in family.metrics}
        best = max(scores.values())
        winners = [m for m, score in scores.items() if score == best]
        return winners[0] if best and len(winners) == 1 else None

    def _family_for(self, interpretation: Interpretation, concepto: str | None) -> tuple[QueryFamily | None, str | None]:
        """Familia elegida por el intérprete, coherente con su concepto contable (ver ``FamilyCatalog.resolve``)."""
        if self._families is None:
            return None, None
        consulta = interpretation.consulta if interpretation.consulta in self._families else None
        return self._families.resolve(consulta, concepto)  # una familia fuera del catálogo nunca se usa

    def _family_plans(
        self, request: QueryRequest, family: QueryFamily, authorization: AuthorizationContext, historico: bool = False
    ) -> tuple[list[QueryPlan], bool]:
        """Período(s) de la familia, siempre resueltos en el backend desde la fecha de Lima.

        - Dos meses en una familia escalar ("compara agosto y septiembre") → dos planes.
        - Sin período en el mensaje ni en el historial → del 1 del mes a hoy, o todo el historial si la
          pregunta lo abarca (``historico``); se informa en el detalle.
        """
        reference = request.fecha_referencia_lima
        # Escalares y agrupadas tienen un total comparable (en las agrupadas, el total del período: c1).
        months = resolve_months(request.mensaje, reference) if family.shape in ("escalar", "agrupada") else []
        if len(months) == 2:
            return [self._family_plan(family, period, authorization) for period in months], False
        period = resolve_period(request.mensaje, reference) or resolve_period_from(
            reversed(user_turns(request)), reference
        )
        defaulted = period is None
        default = full_history(reference) if historico else month_to_date(reference)
        return [self._family_plan(family, period or default, authorization)], defaulted

    @staticmethod
    def _family_plan(family: QueryFamily, period: Period, authorization: AuthorizationContext) -> QueryPlan:
        return QueryPlan(kind="familia", cuenta="", periodo=period, autorizacion=authorization, familia=family.id)

    @staticmethod
    def _compare_periods(plans: list[QueryPlan], results: list[FinanceResult]) -> FinanceResult:
        """Dos períodos de una familia escalar o agrupada: el total de cada uno y su diferencia (motor).

        Un período sin filas vale 0: la consulta se ejecutó y no hubo movimientos (suma vacía)."""
        present = next(r for r in results if not r.no_data)
        template = present.figures[0]

        def total(result: FinanceResult) -> Figure:
            if result.no_data:
                return Figure(marcador="c1", valor=Decimal("0"), unidad=template.unidad, origen="motor")
            return result.figures[0]

        first, second = total(results[0]), total(results[1])
        if first.unidad != second.unidad:
            raise FinanceEngineError("Unidades distintas entre períodos.")
        metric = present.labels.get(template.marcador, "Resultado")
        name_a, name_b = period_text(plans[0].periodo), period_text(plans[1].periodo)
        delta = round2(second.valor - first.valor) if first.unidad == "PEN" else second.valor - first.valor
        figures = (
            Figure(marcador="c1", valor=first.valor, unidad=first.unidad, origen=first.origen),
            Figure(marcador="c2", valor=second.valor, unidad=second.unidad, origen=second.origen),
            Figure(marcador="c3", valor=delta, unidad=first.unidad, origen="motor"),
        )
        return FinanceResult(
            figures=figures,
            labels={"c1": f"{metric} · {name_a}", "c2": f"{metric} · {name_b}",
                    "c3": f"Diferencia ({name_b} menos {name_a})"},
            primary=("c1", "c2", "c3"),
            meanings={"c1": "valor del primer período", "c2": "valor del segundo período",
                      "c3": "diferencia del segundo período respecto del primero",
                      "e1": "nombre del primer período", "e2": "nombre del segundo período"},
            text_labels={"e1": name_a, "e2": name_b},
        )

    @staticmethod
    def _family_detail(family: QueryFamily, plans: list[QueryPlan], result: FinanceResult, defaulted: bool) -> Detail | None:
        if not result.figures or any(f.marcador not in result.labels for f in result.figures):
            return None  # sin etiqueta verificada para alguna cifra: no se inventa detalle
        notes = list(result.notes)
        if defaulted:
            notes.insert(0, f"No indicaste un período: se consultó {default_period_text(plans[0].periodo)}.")
        return Detail(
            tipo="consulta",
            titulo=family.titulo,
            periodo=_span(plans),
            etiquetas=[FigureLabel(marcador=f.marcador, etiqueta=result.labels[f.marcador][:80]) for f in result.figures],
            nota=" ".join(notes)[:200] or None,
        )

    @staticmethod
    def _detail(plan: QueryPlan, figures: tuple[Figure, ...], account_name: str | None) -> Detail | None:
        labels = FIGURE_LABELS.get(plan.kind, {})
        if not figures or any(f.marcador not in labels for f in figures):
            return None  # sin etiqueta verificada para alguna cifra: no se inventa detalle
        return Detail(
            tipo=plan.kind,
            cuenta=plan.cuenta,
            cuenta_nombre=account_name,
            periodo=plan.periodo,
            etiquetas=[FigureLabel(marcador=f.marcador, etiqueta=labels[f.marcador]) for f in figures],
            nota=DETAIL_NOTES.get(plan.kind),
        )

    def _resolve_plan(
        self, request: QueryRequest, interpreted_account: str | None, authorization: AuthorizationContext
    ) -> QueryPlan | None:
        """Cuenta y período revalidados en el backend (BR-10, BR-12); el contexto solo es pista."""
        return self._resolve_plan_or_missing(request, interpreted_account, authorization)[0]

    def _resolve_plan_or_missing(
        self, request: QueryRequest, interpreted_account: str | None, authorization: AuthorizationContext
    ) -> tuple[QueryPlan | None, str]:
        """Como :meth:`_resolve_plan`, pero dice qué falta (``MISSING_ACCOUNT`` o ``MISSING_PERIOD``)."""
        filters = request.contexto.filtros if request.contexto else None
        account = interpreted_account or (filters.codigo if filters else None)
        if account is None or not account.isdigit():
            return None, MISSING_ACCOUNT

        reference = request.fecha_referencia_lima
        period = resolve_period(request.mensaje, reference) or resolve_period_from(
            reversed(user_turns(request)), reference
        )
        if period is None and filters and filters.desde and filters.hasta:
            period = Period(desde=filters.desde, hasta=filters.hasta)
        if period is None:
            return None, MISSING_PERIOD
        return QueryPlan(kind="saldo_cuenta", cuenta=account, periodo=period, autorizacion=authorization), ""

    @staticmethod
    def _evidence(normalized_sql: str | None, rows: int) -> Evidence:
        try:
            parametrized = parametrize_sql(normalized_sql or "")
            return Evidence(
                plantilla_sql=parametrized.template,
                parametros=len(parametrized.parameters),
                filas=rows,
                duracion_ms=0,
            )
        except AuditMaskingError:
            return Evidence(plantilla_sql="(no disponible)", parametros=0, filas=rows, duracion_ms=0)

    def _write_audit(self, request: QueryRequest, run: _Run) -> AuditRecord:
        record = build_audit_record(
            id_traza=request.id_traza,
            user_id=request.usuario.id,
            estado=run.estado,
            registrado_en=self._clock(),
            pseudonymizer=self._pseudonymizer,
            intencion=run.intencion,
            codigos_rechazo=tuple(run.codes),
            normalized_sql=run.normalized_sql,
            versiones=self._versions,
            filas=run.rows,
        )
        self._audit.write(record)
        return record
