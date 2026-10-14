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

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated

from pydantic import Field, ValidationError

from ai_service.audit.masking import AuditConfigError, AuditMaskingError, Pseudonymizer, parametrize_sql
from ai_service.audit.record import AuditRecord, build_audit_record
from ai_service.explanation.markers import MarkerValidationError
from ai_service.http.schemas import (
    Detail,
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
from ai_service.orchestrator.periods import resolve_period, resolve_period_from
from ai_service.orchestrator.ports import (
    AuditSink,
    AuthorizationContext,
    ClassifiedError,
    Explainer,
    FinanceEngine,
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

TEXTS: dict[str, str] = {
    "sin_datos": "No encontré movimientos de esa cuenta en el período que consultaste.",
    "requiere_aclaracion": (
        "Necesito un poco más de información. ¿De qué cuenta (por ejemplo, Caja o Bancos) y de qué mes "
        "quieres el resultado?"
    ),
    "solo_lectura": "Solo puedo consultar información; no puedo registrar, modificar ni anular movimientos.",
    "fuera_de_dominio": "Solo puedo ayudarte con consultas sobre las cuentas contables del ERP.",
    "no_resoluble": (
        "No pude responder esa pregunta con la información disponible. Prueba, por ejemplo, con "
        "«¿Cuál fue el saldo de caja en septiembre?»."
    ),
    "datos_sensibles": (
        "Por seguridad, no incluyas datos personales, credenciales ni importes en tu pregunta."
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


class ErrorBody(StrictModel):
    """Cuerpo de error con la convención del ERP: ``{ error, errores? }``."""

    error: str
    errores: Annotated[list[str], Field(max_length=20)] = Field(default_factory=list)


@dataclass(frozen=True)
class PipelineOutcome:
    status_code: int
    body: QueryResponse | ErrorBody
    audit: AuditRecord | None = None
    security_incident: bool = False
    """``True`` si el procesamiento se detuvo por un :class:`SecurityIncident` (para alertas)."""


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

    # ------------------------------------------------------------------ API pública
    def handle(
        self,
        payload: QueryRequest | Mapping[str, object] | str,
        *,
        authorization: AuthorizationContext | None = None,
    ) -> PipelineOutcome:
        """``authorization``: contexto ya verificado por la API (P-9). Sin él, el rol de CT-B se usa
        como contexto provisional que solo restringe el alcance y nunca habilita datos reales."""
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
        except ModelUnavailable:
            run.codes.append(MODEL_UNAVAILABLE)
            status = 503
        except ClassifiedError as exc:  # solo llegan aquí los transitorios (servicio, timeout)
            run.codes.extend([exc.category, exc.code])
            status = 503
        except Exception:  # fallo de cualquier otro componente: respuesta controlada
            run.codes.append(COMPONENT_FAILURE)
            status = 503

        audit = self._write_audit(request, run)
        if status != 200:
            return PipelineOutcome(
                status, ErrorBody(error=ERROR_UNAVAILABLE), audit, security_incident=run.security_incident
            )
        response = QueryResponse(
            id_traza=request.id_traza,
            estado=run.estado,
            texto=run.texto,
            cifras=list(run.figures),
            evidencias=run.evidences,
            versiones=self._versions,
            detalle=run.detalle,
        )
        return PipelineOutcome(200, response, audit)

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
        run.texto = TEXTS[text_key or estado]
        if code:
            run.codes.append(code)

    def _run(self, request: QueryRequest, run: _Run, authorization: AuthorizationContext) -> None:
        decision = self._prefilter(request)
        if not decision.allowed:
            text_key = "datos_sensibles" if decision.reason == "SENSITIVE_DATA" else None
            self._finish(run, decision.estado or "no_resoluble", text_key, decision.reason)
            return  # ningún modelo invocado

        interpretation = self._interpreter.interpret(request)
        run.intencion = interpretation.intencion
        if interpretation.intencion == "escritura":
            self._finish(run, "solo_lectura", code="WRITE_INTENT")
            return
        if interpretation.intencion == "fuera_de_dominio":
            self._finish(run, "fuera_de_dominio", code="OUT_OF_DOMAIN_INTENT")
            return
        if interpretation.indicador is not None:
            self._finish(run, "no_resoluble", code=INDICATOR_NOT_AVAILABLE)  # catálogo pendiente (P-6)
            return

        # Rol ya revalidado en ``handle`` contra la allowlist (verificado por P-9 o provisional).
        plan =self._resolve_plan(request, interpretation.cuenta, authorization)
        if plan is None:  # falta cuenta o período tras revisar mensaje, historial y contexto
            self._finish(run, "requiere_aclaracion", code=MISSING_ENTITIES)
            return

        fragments = self._retriever.retrieve(request.mensaje, self._k)
        try:
            candidate = self._generator.generate(plan, fragments)
        except SqlGenerationError as exc:
            if exc.transient:
                raise  # 503 en ``handle``
            run.codes.extend([exc.category, exc.code])
            self._finish(run, "no_resoluble")
            return  # sin SQL: el validador y el Executor NO se invocan
        verdict = self._validator.validate(candidate.sql, authorization.rol)
        if not verdict.approved:
            run.codes.extend([SQL_REJECTED, *verdict.reasons])
            self._finish(run, "no_resoluble")
            return  # el Executor NO se invoca

        run.normalized_sql = verdict.normalized_sql
        execute_authorized = getattr(self._executor, "execute_authorized", None)
        try:
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
            return  # sin filas: no hay cifras
        run.rows = len(rows)
        run.evidences = [self._evidence(verdict.normalized_sql, len(rows))]

        result = self._finance.compute(plan, rows)
        if result.no_data:
            self._finish(run, "sin_datos")
            return

        # La explicación muestra primero el resultado principal; el resto de cifras verificadas se
        # entrega en ``cifras`` y ``detalle`` ("Ver detalles del cálculo").
        primary = PRIMARY_MARKERS.get(plan.kind)
        explained = tuple(f for f in result.figures if primary is None or f.marcador in primary)
        account_name = self._account_names.get(plan.cuenta)
        try:
            text = self._explainer.explain(
                trace_id=request.id_traza,
                intencion=interpretation.intencion,
                periodo=plan.periodo,
                figures=explained,
                cuenta_nombre=account_name,
            )
        except MarkerValidationError as exc:
            self._finish(run, "no_resoluble", code=exc.code)  # explicación descartada (FR-020)
            run.evidences = []
            return
        run.estado = "respondida"
        run.texto = text
        run.figures = result.figures
        run.detalle = self._detail(plan, result.figures, account_name)

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
        filters = request.contexto.filtros if request.contexto else None
        account = interpreted_account or (filters.codigo if filters else None)
        if account is None or not account.isdigit():
            return None

        reference = request.fecha_referencia_lima
        period = resolve_period(request.mensaje, reference) or resolve_period_from(
            reversed(user_turns(request)), reference
        )
        if period is None and filters and filters.desde and filters.hasta:
            period = Period(desde=filters.desde, hasta=filters.hasta)
        if period is None:
            return None
        return QueryPlan(kind="saldo_cuenta", cuenta=account, periodo=period, autorizacion=authorization)

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
