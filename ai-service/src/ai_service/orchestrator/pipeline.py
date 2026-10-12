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
    Evidence,
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
    Explainer,
    FinanceEngine,
    Interpreter,
    QueryPlan,
    Retriever,
    SqlExecutor,
    SqlGenerator,
    SqlValidator,
)
from ai_service.orchestrator.prefilter import PrefilterDecision, prefilter, user_turns
from ai_service.orchestrator.security import SECURITY_INCIDENT, SecurityIncident

TEXTS: dict[str, str] = {
    "sin_datos": "No encontré registros contables para el período o la cuenta consultados.",
    "requiere_aclaracion": "¿Puedes indicar la cuenta, el período o el indicador que necesitas?",
    "solo_lectura": "Solo puedo consultar información; no puedo registrar, modificar ni anular movimientos.",
    "fuera_de_dominio": "Solo puedo responder preguntas financieras y contables del ERP.",
    "no_resoluble": "No pude resolver esta consulta con la información disponible.",
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

    # ------------------------------------------------------------------ API pública
    def handle(self, payload: QueryRequest | Mapping[str, object] | str) -> PipelineOutcome:
        try:
            request = self._parse(payload)
        except ValidationError as exc:
            fields = sorted({".".join(str(p) for p in err["loc"]) for err in exc.errors()})[:20]
            return PipelineOutcome(400, ErrorBody(error=ERROR_INVALID_REQUEST, errores=fields))

        if request.usuario.rol not in self._roles:
            run = _Run(codes=[ROLE_FORBIDDEN])
            return PipelineOutcome(403, ErrorBody(error=ERROR_FORBIDDEN), self._write_audit(request, run))

        run = _Run()
        status = 200
        try:
            self._run(request, run)
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

    def _run(self, request: QueryRequest, run: _Run) -> None:
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

        plan = self._resolve_plan(request, interpretation.cuenta)
        if plan is None:  # falta cuenta o período tras revisar mensaje, historial y contexto
            self._finish(run, "requiere_aclaracion", code=MISSING_ENTITIES)
            return

        fragments = self._retriever.retrieve(request.mensaje, self._k)
        candidate = self._generator.generate(plan, fragments)
        verdict = self._validator.validate(candidate.sql, request.usuario.rol)
        if not verdict.approved:
            run.codes.extend([SQL_REJECTED, *verdict.reasons])
            self._finish(run, "no_resoluble")
            return  # el Executor NO se invoca

        run.normalized_sql = verdict.normalized_sql
        rows = self._executor.execute(verdict)
        run.rows = len(rows)
        run.evidences = [self._evidence(verdict.normalized_sql, len(rows))]

        result = self._finance.compute(plan, rows)
        if result.no_data:
            self._finish(run, "sin_datos")
            return

        try:
            text = self._explainer.explain(
                trace_id=request.id_traza,
                intencion=interpretation.intencion,
                periodo=plan.periodo,
                figures=result.figures,
            )
        except MarkerValidationError as exc:
            self._finish(run, "no_resoluble", code=exc.code)  # explicación descartada (FR-020)
            run.evidences = []
            return
        run.estado = "respondida"
        run.texto = text
        run.figures = result.figures

    def _resolve_plan(self, request: QueryRequest, interpreted_account: str | None) -> QueryPlan | None:
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
        return QueryPlan(kind="saldo_cuenta", cuenta=account, periodo=period)

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
