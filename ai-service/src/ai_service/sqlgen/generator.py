"""``XiYanSqlGenerator``: implementación real de :class:`~ai_service.orchestrator.ports.SqlGenerator`.

Flujo por petición:

1. **Autorización** (sin llamar al modelo si falla → ``SQLGEN_NOT_AUTHORIZED``): el plan debe traer
   el :class:`~ai_service.orchestrator.ports.AuthorizationContext` que fija el pipeline, con un
   origen aceptado por esta instancia. El rol de **esa** petición debe tener las columnas mínimas
   del tipo de plan. El rol es provisional (P-9): solo restringe el alcance; el SQL Validator lo
   vuelve a aplicar siempre después de la generación.
2. **Bloqueos** (``SQLGEN_BLOCKED``): modalidades vetadas con datos reales por decisiones pendientes
   (hoy ninguna). **P-4 resuelto**: el SQL financiero recibe de forma determinista el filtro de
   asientos registrados (``journal_entry.status = TRUE``); si no puede garantizarse, se rechaza.
3. Solicitud JSON 1.0 → M-Schema **del rol de la petición** → evidencia trazable → prompt XiYan →
   control de datos sensibles (``SecurityIncident``).
4. Servicio de inferencia → ``OutputParser`` → comprobación de forma verificable del resultado →
   ``SqlCandidate``. El orquestador lo valida siempre antes del Executor.

No ejecuta SQL, no ve filas ni cifras, no decide permisos y no vuelve al generador simulado.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Literal, Protocol

from ai_service.orchestrator.ports import (
    Fragment,
    GenerationBlocked,
    GenerationInputRejected,
    GenerationNotAuthorized,
    InvalidGeneratorOutput,
    QueryPlan,
    SqlCandidate,
)
from ai_service.policies.registered_entries import RegisteredFilterError, apply_registered_entries_filter
from ai_service.orchestrator.security import ensure_no_sensitive_data
from ai_service.sqlgen.evidence import EvidenceBuilder
from ai_service.sqlgen.mschema import MSchemaBuilder
from ai_service.sqlgen.output_parser import parse_sql_output
from ai_service.sqlgen.plan_to_request import REQUIRED_OBJECTS, SCHEMA_TABLES, UnsupportedPlan, plan_to_request
from ai_service.sqlgen.prompt import PromptError, build_user_content
from ai_service.sqlgen.result_adapter import ensure_verifiable_saldo_shape
from ai_service.sqlgen.wire import GenerateResponse
from ai_service.validation.allowlist import Allowlist

DataSource = Literal["ficticio", "real"]
# Modalidades bloqueadas con datos reales hasta resolver una decisión pendiente (código de auditoría).
# P-4 quedó resuelto con el filtro determinista de asientos registrados: ``saldo_cuenta`` ya no se bloquea.
REAL_DATA_BLOCKERS: dict[str, str] = {}
SHAPE_CHECKS: dict[str, Callable[[str], None]] = {"saldo_cuenta": ensure_verifiable_saldo_shape}
# Tipos de plan financieros: su SQL recibe siempre el filtro de asientos registrados (P-4).
REGISTERED_ENTRIES_KINDS = frozenset({"saldo_cuenta"})
# Columnas que solo usa la política P-4: no se muestran al modelo (esquema de entrenamiento intacto).
MODEL_HIDDEN_COLUMNS = frozenset({("journal_entry", "status")})


class GenerationClient(Protocol):
    def generate(self, user_content: str) -> GenerateResponse: ...


class XiYanSqlGenerator:
    def __init__(
        self,
        client: GenerationClient,
        allowlist: Allowlist,
        schema_builder: MSchemaBuilder,
        evidence_builder: EvidenceBuilder,
        *,
        accepted_origins: frozenset[str],
        data_source: DataSource,
    ) -> None:
        if not accepted_origins:
            raise ValueError("Debe declararse qué origen de autorización acepta el generador.")
        self._client = client
        self._allowlist = allowlist
        self._schema = schema_builder
        self._evidence = evidence_builder
        self._accepted_origins = frozenset(accepted_origins)
        self._data_source = data_source
        self.calls = 0

    def _authorized_role(self, plan: QueryPlan) -> str:
        context = plan.autorizacion
        if context is None:
            raise GenerationNotAuthorized("MISSING_AUTHORIZATION")
        if context.origen not in self._accepted_origins:
            raise GenerationNotAuthorized("UNTRUSTED_AUTHORIZATION")
        grants = self._allowlist.roles.get(context.rol)
        required = REQUIRED_OBJECTS.get(plan.kind)
        if not grants or required is None:
            raise GenerationNotAuthorized("ROLE_SCOPE_INSUFFICIENT")
        for table, columns in required.items():
            if not columns <= set(grants.get(table, ())):
                raise GenerationNotAuthorized("ROLE_SCOPE_INSUFFICIENT")
        return context.rol

    def build_prompt(self, plan: QueryPlan, fragments: Sequence[Fragment]) -> str:
        """Mensaje de usuario XiYan para el plan y su rol (sin llamar al modelo)."""
        role = self._authorized_role(plan)
        if self._data_source != "ficticio" and plan.kind in REAL_DATA_BLOCKERS:
            raise GenerationBlocked(REAL_DATA_BLOCKERS[plan.kind])
        tables = SCHEMA_TABLES.get(plan.kind)
        if tables is None:
            raise GenerationInputRejected("UNSUPPORTED_PLAN")
        try:
            question = plan_to_request(plan)
        except UnsupportedPlan:
            raise GenerationInputRejected("UNSUPPORTED_PLAN") from None
        grants = self._allowlist.roles[role]
        # Exactamente lo que muestra el M-Schema: la evidencia no puede nombrar columnas ocultas (P-4).
        visible = {
            table: tuple(c for c in grants[table] if (table, c) not in MODEL_HIDDEN_COLUMNS)
            for table in tables
            if table in grants
        }
        schema = self._schema.build(role, tables, hidden_columns=MODEL_HIDDEN_COLUMNS)
        evidence = self._evidence.build(plan.kind, fragments, visible)
        try:
            content = build_user_content(question, schema, evidence.text)
        except PromptError:
            raise GenerationInputRejected("PROMPT_NOT_BUILDABLE") from None
        # El Modelo 2 es local, pero la entrada se revisa igual (defensa en profundidad, BR-13).
        ensure_no_sensitive_data(content)
        return content

    def generate(self, plan: QueryPlan, fragments: Sequence[Fragment]) -> SqlCandidate:
        content = self.build_prompt(plan, fragments)
        self.calls += 1
        response = self._client.generate(content)
        sql = parse_sql_output(response.text, response.finish_reason)
        SHAPE_CHECKS[plan.kind](sql)
        if plan.kind in REGISTERED_ENTRIES_KINDS:
            try:
                sql = apply_registered_entries_filter(sql)  # P-4, determinista; el validador revisa el resultado
            except RegisteredFilterError:
                raise InvalidGeneratorOutput("REGISTERED_FILTER_UNGUARANTEED") from None
        return SqlCandidate(sql=sql, kind=plan.kind)
