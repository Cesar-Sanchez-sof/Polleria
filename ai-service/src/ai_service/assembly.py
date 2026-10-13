"""Composición del orquestador de **desarrollo** (T027).

Une los componentes reales de B1–B4 con las simulaciones de B3:

- **Reales**: SQL Validator con la allowlist **ficticia** (B2), motor financiero (B1),
  ``BudgetGuard``/``UsageLog`` con precios **simulados** (B1), auditoría con la clave HMAC de la
  configuración (B2) y recuperador léxico en memoria sobre el corpus de ``knowledge/`` (B4).
- **Simulados**: proveedor del Modelo 1, generador de SQL por plantillas y Executor con el dataset
  ficticio ``fixtures/dev_dataset.json``.

No hay bases de datos, modelos, proveedores comerciales ni red. Las cifras son ficticias y no
representan información financiera real. Las trazas quedan en memoria (no es auditoría de
producción, P-10).

Con ``AI_SQL_GENERATOR=xiyansql`` (Fase 1 del Modelo 2) cambian solo tres piezas:

- generador: :class:`~ai_service.sqlgen.generator.XiYanSqlGenerator` contra el servicio de
  inferencia de WSL (sin *fallback* al simulado: si no está disponible, ``503``);
- datos ficticios con los nombres del patrón entrenado (``allowlist.dev_erp.json`` y
  ``dev_dataset_erp.json``) y Executor ficticio estricto;
- cifras de saldo desde los totales devueltos con las primitivas de B1, sin datos inventados.

El SQL Validator, el prefiltro, el presupuesto y la auditoría no cambian.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING

from ai_service.audit.masking import Pseudonymizer
from ai_service.config.settings import (
    LLM_MAX_INPUT_TOKENS,
    LLM_MAX_OUTPUT_TOKENS,
    OPENAI_LLM,
    POSTGRES_EXECUTOR,
    XIYAN_GENERATOR,
    ServiceSettings,
)
from ai_service.llm.provider import LlmProvider
from ai_service.finance.engine import DeterministicFinanceEngine
from ai_service.knowledge.corpus import build_corpus, load_json
from ai_service.llm.budget import BudgetGuard, BudgetPolicy, ModelPrice, UsageLog
from ai_service.orchestrator.model_calls import LlmBackedExplainer, LlmBackedInterpreter, ModelGateway
from ai_service.orchestrator.pipeline import Orchestrator
from ai_service.orchestrator.ports import FinanceEngine, SqlExecutor, SqlGenerator
from ai_service.retrieval.embedder import HashingEmbedder
from ai_service.retrieval.memory_index import VectorRetriever
from ai_service.simulation.components import InMemoryAuditSink, TemplateSqlGenerator, build_fixture_executor
from ai_service.simulation.llm import MockLlmProvider
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator

if TYPE_CHECKING:
    import httpx

SERVICE_ROOT = Path(__file__).resolve().parents[2]  # ai-service/

# Valores SIMULADOS (no corresponden a ningún proveedor ni presupuesto real; ver P-22).
SIM_PRICING = {MockLlmProvider.model: ModelPrice(input_per_1k=Decimal("0.010"), output_per_1k=Decimal("0.030"))}
DEV_MAX_INPUT = {"interpretar": 2000, "explicar": 1000}
DEV_MAX_OUTPUT = {"interpretar": 300, "explicar": 400}
DEV_MONTHLY_LIMIT = Decimal("1.00")
# Orígenes de autorización con los que la base REAL acepta ejecutar. Vacío hasta resolver P-9 (sesión
# autenticada del ERP): el chatbot no ejecuta SQL sobre PostgreSQL aunque el Executor esté activado.
REAL_DB_ACCEPTED_ORIGINS: frozenset[str] = frozenset()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_dev_orchestrator(
    settings: ServiceSettings,
    *,
    root: Path = SERVICE_ROOT,
    clock: Callable[[], datetime] = _utc_now,
    budget_policy: BudgetPolicy | None = None,
    sqlgen_transport: httpx.BaseTransport | None = None,
    readonly_connection_factory: Callable[[], object] | None = None,
    llm_transport: httpx.BaseTransport | None = None,
) -> tuple[Orchestrator, InMemoryAuditSink]:
    """Devuelve el orquestador de desarrollo y su almacén de trazas en memoria.

    ``sqlgen_transport`` y ``readonly_connection_factory`` solo se usan en pruebas (transporte y
    conexión simulados, sin red).
    """
    xiyan = settings.sql_generator == XIYAN_GENERATOR
    real_db = settings.sql_executor == POSTGRES_EXECUTOR
    dataset_file, allowlist_file = (
        ("dev_dataset_erp.json", "allowlist.dev_erp.json") if xiyan else ("dev_dataset.json", "allowlist.example.json")
    )
    if real_db:
        allowlist_file = "allowlist.readonly_erp.json"  # esquema real public (provisional, P-14)
    dev = json.loads((root / "fixtures" / dataset_file).read_text(encoding="utf-8"))
    allowlist = load_allowlist(root / "knowledge" / allowlist_file)
    validator = SqlValidator(allowlist)

    metadata = load_json(root / "knowledge" / "erp_schema_metadata.json")
    corpus = build_corpus(
        metadata,
        load_json(root / "knowledge" / "glossary_v1.json"),
        load_json(root / "knowledge" / "rules_v1.json"),
    )
    versions = {"pipeline": "b3-sim", "api": "t028-dev", "allowlist": allowlist.version, "dataset": dev["version"]}

    if xiyan:
        from ai_service.sqlgen.client import XiYanHttpClient
        from ai_service.sqlgen.dev_fixtures import SaldoFixtureExecutor
        from ai_service.sqlgen.evidence import EVIDENCE_VERSION, EvidenceBuilder
        from ai_service.sqlgen.generator import XiYanSqlGenerator
        from ai_service.sqlgen.mschema import MSchemaBuilder
        from ai_service.sqlgen.profile import PROFILE_ID
        from ai_service.sqlgen.result_adapter import XiYanSaldoFinanceAdapter

        if settings.sqlgen is None:
            raise ValueError("Falta la configuración del generador XiYanSQL.")
        generator: SqlGenerator = XiYanSqlGenerator(
            XiYanHttpClient(settings.sqlgen, transport=sqlgen_transport),
            allowlist,
            MSchemaBuilder(allowlist, metadata),
            EvidenceBuilder(model["table"] for model in metadata["models"]),
            # Rol de CT-B provisional (P-9). Con la base real, data_source="real" bloquea saldo_cuenta (P-4).
            accepted_origins=frozenset({"ct-b-provisional"}),
            data_source="real" if real_db else "ficticio",
        )
        executor: SqlExecutor
        if real_db:
            from ai_service.execution.postgres_readonly import PostgresReadOnlyExecutor, psycopg_connection_factory

            if not settings.readonly_dsn:
                raise ValueError("Falta la conexión de solo lectura.")
            executor = PostgresReadOnlyExecutor(
                readonly_connection_factory or psycopg_connection_factory(settings.readonly_dsn),
                validator,
                accepted_origins=REAL_DB_ACCEPTED_ORIGINS,
            )
            versions["executor"] = "postgres-readonly"
        else:
            executor = SaldoFixtureExecutor(dev["dataset"])
        finance: FinanceEngine = XiYanSaldoFinanceAdapter()
        versions.update(
            {"sqlgen": f"xiyansql:{settings.sqlgen.adapter}", "prompt": PROFILE_ID, "evidence": EVIDENCE_VERSION}
        )
    else:
        generator = TemplateSqlGenerator()
        executor = build_fixture_executor(dev["dataset"], validator, dev["role"])
        finance = DeterministicFinanceEngine()

    if settings.llm_provider == OPENAI_LLM:
        from ai_service.llm.openai_provider import OpenAiResponsesProvider

        if settings.llm is None:
            raise ValueError("Falta la configuración del Modelo 1.")
        llm = settings.llm
        price = ModelPrice(input_per_1k=llm.price_input_per_1k, output_per_1k=llm.price_output_per_1k)
        provider: LlmProvider = OpenAiResponsesProvider(
            api_key=llm.api_key,
            model=llm.model,
            price=price,
            account_catalog=dev["account_keywords"],  # metadatos del catálogo, nunca cifras
            reasoning_effort=llm.reasoning_effort,
            transport=llm_transport,
        )
        model_name, pricing = llm.model, {llm.model: price}
        max_in, max_out, timeout_ms = LLM_MAX_INPUT_TOKENS, LLM_MAX_OUTPUT_TOKENS, llm.timeout_s * 1000
        # Contador en memoria (R-06): el crédito prepago sin recarga automática es el tope externo.
        default_policy = BudgetPolicy(
            monthly_limit=llm.monthly_limit, max_input_tokens=max_in, max_output_tokens=max_out,
            require_external_verification=False,
        )
        versions["llm"] = f"openai:{llm.model}"
    else:
        provider = MockLlmProvider(dev["account_keywords"])
        model_name, pricing = MockLlmProvider.model, SIM_PRICING
        max_in, max_out, timeout_ms = DEV_MAX_INPUT, DEV_MAX_OUTPUT, 8000
        default_policy = BudgetPolicy(
            monthly_limit=DEV_MONTHLY_LIMIT, max_input_tokens=max_in, max_output_tokens=max_out,
            require_external_verification=False,  # simulación: no hay proveedor real que verificar
        )
    guard = BudgetGuard(budget_policy or default_policy, pricing, UsageLog(), clock)
    gateway = ModelGateway(
        provider, guard, model=model_name, max_input_tokens=max_in, max_output_tokens=max_out, timeout_ms=timeout_ms
    )
    audit_sink = InMemoryAuditSink()
    orchestrator = Orchestrator(
        interpreter=LlmBackedInterpreter(gateway),
        retriever=VectorRetriever.from_fragments(corpus, HashingEmbedder()),
        generator=generator,
        validator=validator,
        executor=executor,
        finance=finance,
        explainer=LlmBackedExplainer(gateway),
        audit_sink=audit_sink,
        pseudonymizer=Pseudonymizer(settings.audit_hmac_key),
        allowed_roles=frozenset(allowlist.roles),
        clock=clock,
        versions=versions,
    )
    return orchestrator, audit_sink
