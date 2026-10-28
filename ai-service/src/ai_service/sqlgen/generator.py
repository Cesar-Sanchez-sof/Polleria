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

P1 (``kind="familia"``): solicitud, M-Schema y evidencia del ejemplo de entrenamiento de la familia
(``sqlgen.families``), filtrados al rol; el SQL generado se traduce al esquema desplegado
(``dish`` → ``product``) y recibe el filtro P-4 si la familia es contable.

No ejecuta SQL, no ve filas ni cifras, no decide permisos y no vuelve al generador simulado.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Literal, Protocol

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

from ai_service.orchestrator import diagnostics
from ai_service.orchestrator.ports import (
    Fragment,
    GenerationBlocked,
    GenerationInputRejected,
    GenerationNotAuthorized,
    InvalidGeneratorOutput,
    QueryPlan,
    SqlCandidate,
)
from ai_service.policies.registered_entries import (
    RegisteredFilterError,
    apply_registered_entries_filter,
    has_registered_entries_filter,
)
from ai_service.sqlgen.modules import ErpModules
from ai_service.orchestrator.security import ensure_no_sensitive_data
from ai_service.sqlgen.evidence import EvidenceBuilder
from ai_service.sqlgen.mschema import MSchemaBuilder
from ai_service.sqlgen.output_parser import parse_sql_output
from ai_service.sqlgen.families import FamilyCatalog, FamilyError, QueryFamily
from ai_service.sqlgen.plan_to_request import (
    REQUIRED_OBJECTS,
    SCHEMA_TABLES,
    UnsupportedPlan,
    plan_to_request,
    serialize_request,
)
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
# Columnas del M-Schema de la variante de entrenamiento de cada plan (verificadas contra los ejemplos
# de v1.7; ``tests/test_sqlgen_prompt.py``). Las demás columnas autorizadas no se muestran en ese plan.
TRAINED_COLUMNS: dict[str, dict[str, frozenset[str]]] = {
    "saldo_cuenta": {
        "accounting_account": frozenset({"id", "parent_id", "code", "name", "type", "active"}),
        "journal_entry": frozenset({"id", "entry_date", "description", "book", "code", "status"}),
        "journal_entry_detail": frozenset({"id", "entry_id", "account_id", "description", "debit", "credit"}),
    },
}


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
        families: FamilyCatalog | None = None,
        modules: ErpModules | None = None,
    ) -> None:
        if not accepted_origins:
            raise ValueError("Debe declararse qué origen de autorización acepta el generador.")
        self._client = client
        self._allowlist = allowlist
        self._schema = schema_builder
        self._evidence = evidence_builder
        self._accepted_origins = frozenset(accepted_origins)
        self._data_source = data_source
        self._families = families
        self._modules = modules
        self.calls = 0

    def _authorized_role(self, plan: QueryPlan) -> str:
        context = plan.autorizacion
        if context is None:
            raise GenerationNotAuthorized("MISSING_AUTHORIZATION")
        if context.origen not in self._accepted_origins:
            raise GenerationNotAuthorized("UNTRUSTED_AUTHORIZATION")
        grants = self._allowlist.roles.get(context.rol)
        if plan.kind == "familia":
            family = self._family(plan)
            if not grants or any(table not in grants for table in family.real_tables):
                raise GenerationNotAuthorized("ROLE_SCOPE_INSUFFICIENT")
            return context.rol
        if plan.kind == "libre":
            if self._modules is None or plan.solicitud is None:
                raise GenerationInputRejected("UNSUPPORTED_PLAN")
            allowed = self._modules.tables_for(context.modulos)
            if not grants or not plan.tablas or any(t not in grants or t not in allowed for t in plan.tablas):
                raise GenerationNotAuthorized("ROLE_SCOPE_INSUFFICIENT")
            return context.rol
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
        if plan.kind == "familia":
            return self._family_prompt(plan, role)
        if plan.kind == "libre":
            return self._free_prompt(plan, role)
        tables = SCHEMA_TABLES.get(plan.kind)
        if tables is None:
            raise GenerationInputRejected("UNSUPPORTED_PLAN")
        try:
            question = plan_to_request(plan)
        except UnsupportedPlan:
            raise GenerationInputRejected("UNSUPPORTED_PLAN") from None
        grants = self._allowlist.roles[role]
        # El M-Schema del saldo muestra SOLO las columnas de su variante de entrenamiento, aunque la
        # allowlist autorice más (otras rutas las usan): ampliar permisos no cambia este prompt.
        hidden = MODEL_HIDDEN_COLUMNS | {
            (table, column)
            for table in tables
            for column in grants.get(table, ())
            if column not in TRAINED_COLUMNS.get(plan.kind, {}).get(table, frozenset(grants.get(table, ())))
        }
        # Exactamente lo que muestra el M-Schema: la evidencia no puede nombrar columnas ocultas (P-4).
        visible = {
            table: tuple(c for c in grants[table] if (table, c) not in hidden)
            for table in tables
            if table in grants
        }
        schema = self._schema.build(role, tables, hidden_columns=hidden)
        evidence = self._evidence.build(plan.kind, fragments, visible)
        try:
            content = build_user_content(question, schema, evidence.text)
        except PromptError:
            raise GenerationInputRejected("PROMPT_NOT_BUILDABLE") from None
        # El Modelo 2 es local, pero la entrada se revisa igual (defensa en profundidad, BR-13).
        ensure_no_sensitive_data(content)
        return content

    def _family(self, plan: QueryPlan) -> QueryFamily:
        if self._families is None or plan.familia is None or plan.familia not in self._families:
            raise GenerationInputRejected("UNSUPPORTED_PLAN")
        return self._families.get(plan.familia)

    def _family_prompt(self, plan: QueryPlan, role: str) -> str:
        """Familia entrenada (P1): solicitud, M-Schema y evidencia del ejemplo de entrenamiento,
        con el período del plan y solo lo que el rol ve. Los fragmentos RAG no se usan: la evidencia
        ya es la que el adaptador aprendió para esa familia."""
        family = self._family(plan)
        grants = self._allowlist.roles[role]
        try:
            question = serialize_request(family.request(plan.periodo))
            schema = family.schema_for(grants)
            evidence = family.evidence_for(grants)
        except UnsupportedPlan:
            raise GenerationInputRejected("UNSUPPORTED_PLAN") from None
        except FamilyError as exc:
            raise GenerationNotAuthorized(str(exc)) from None
        try:
            content = build_user_content(question, schema, evidence)
        except PromptError:
            raise GenerationInputRejected("PROMPT_NOT_BUILDABLE") from None
        ensure_no_sensitive_data(content)
        return content

    def _free_prompt(self, plan: QueryPlan, role: str) -> str:
        """Ruta ampliada: solicitud con la forma del contrato 1.0 (vocabulario nuevo, FUERA de la
        distribución del entrenamiento), M-Schema y evidencia de las tablas elegidas. Si el prompt excede
        la longitud del entrenamiento, se quitan las últimas tablas (las de menor prioridad)."""
        assert self._modules is not None and plan.solicitud is not None
        grants = self._allowlist.roles[role]
        try:
            question = serialize_request(dict(plan.solicitud))
        except UnsupportedPlan:
            raise GenerationInputRejected("UNSUPPORTED_PLAN") from None
        tables = list(plan.tablas)
        while tables:
            schema = self._modules.mschema(tables, grants)
            hint = " ".join(p for p in (plan.pista, plan.objetivo) if p) or None  # corrección primero, luego el objetivo
            evidence = self._modules.evidence(tables, grants, hint) or "Use only the tables and columns listed."
            try:
                content = build_user_content(question, schema, evidence)
                break
            except PromptError:
                tables.pop()
        else:
            raise GenerationInputRejected("PROMPT_NOT_BUILDABLE")
        trace = diagnostics.current()
        if trace is not None:
            trace.tablas_prompt = tuple(tables)
        ensure_no_sensitive_data(content)
        return content

    def generate(self, plan: QueryPlan, fragments: Sequence[Fragment]) -> SqlCandidate:
        content = self.build_prompt(plan, fragments)
        self.calls += 1
        response = self._client.generate(content)
        trace = diagnostics.current()
        if trace is not None:  # evidencia de la invocación real: lo que informa el servicio de inferencia
            trace.record_generation(
                adapter=response.adapter, latency_ms=response.latency_ms, prompt_tokens=response.prompt_tokens,
                output_tokens=response.output_tokens, finish_reason=response.finish_reason,
            )
        sql = parse_sql_output(response.text, response.finish_reason)
        if trace is not None:
            trace.generated_sql = sql  # también si después se descarta por su forma
        if plan.kind in SHAPE_CHECKS:
            SHAPE_CHECKS[plan.kind](sql)
        if plan.kind == "familia":
            try:
                sql = self._family(plan).to_real_schema(sql)  # esquema del entrenamiento → base desplegada
            except FamilyError as exc:
                raise InvalidGeneratorOutput(str(exc)) from None
        if plan.kind == "libre":
            try:
                parsed = sqlglot.parse_one(sql, read="postgres")
            except SqlglotError:
                parsed = None
            if not isinstance(parsed, exp.Query):
                # No es una consulta analizable (paréntesis sueltos, JSON anidado…): no es un problema de P-4 y el
                # reintento no debe añadir tablas contables al esquema.
                raise InvalidGeneratorOutput("UNPARSEABLE_SQL")
        if plan.kind == "libre" and not has_registered_entries_filter(sql):
            # Lee asientos sin el filtro P-4: se añade de forma determinista (o se rechaza si no es posible).
            try:
                sql = apply_registered_entries_filter(sql)
            except RegisteredFilterError:
                raise InvalidGeneratorOutput("REGISTERED_FILTER_UNGUARANTEED") from None
        if plan.kind == "libre" and self._modules is not None:
            # Estados y tipos con las mayúsculas reales ('open' → 'OPEN'); el validador revisa el resultado.
            sql, normalized = self._modules.normalize_literals(sql)
            if normalized and trace is not None and trace.ajuste is None:
                trace.ajuste = "STATUS_CASE_NORMALIZED"
            sql, ordered = self._modules.nulls_last(sql)
            if ordered and trace is not None and trace.ajuste is None:
                trace.ajuste = "NULLS_LAST"
            sql, tied = self._modules.latest_tiebreak(sql)
            if tied and trace is not None and trace.ajuste is None:
                trace.ajuste = "LATEST_TIEBREAK"
        if plan.kind in REGISTERED_ENTRIES_KINDS or (plan.kind == "familia" and self._family(plan).contable):
            try:
                sql = apply_registered_entries_filter(sql)  # P-4, determinista; el validador revisa el resultado
            except RegisteredFilterError:
                raise InvalidGeneratorOutput("REGISTERED_FILTER_UNGUARANTEED") from None
        return SqlCandidate(sql=sql, kind=plan.kind)
