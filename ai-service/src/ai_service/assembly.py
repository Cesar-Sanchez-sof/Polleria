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
"""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from ai_service.audit.masking import Pseudonymizer
from ai_service.config.settings import ServiceSettings
from ai_service.finance.engine import DeterministicFinanceEngine
from ai_service.knowledge.corpus import build_corpus, load_json
from ai_service.llm.budget import BudgetGuard, BudgetPolicy, ModelPrice, UsageLog
from ai_service.orchestrator.model_calls import LlmBackedExplainer, LlmBackedInterpreter, ModelGateway
from ai_service.orchestrator.pipeline import Orchestrator
from ai_service.retrieval.embedder import HashingEmbedder
from ai_service.retrieval.memory_index import VectorRetriever
from ai_service.simulation.components import InMemoryAuditSink, TemplateSqlGenerator, build_fixture_executor
from ai_service.simulation.llm import MockLlmProvider
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator

SERVICE_ROOT = Path(__file__).resolve().parents[2]  # ai-service/

# Valores SIMULADOS (no corresponden a ningún proveedor ni presupuesto real; ver P-22).
SIM_PRICING = {MockLlmProvider.model: ModelPrice(input_per_1k=Decimal("0.010"), output_per_1k=Decimal("0.030"))}
DEV_MAX_INPUT = {"interpretar": 2000, "explicar": 1000}
DEV_MAX_OUTPUT = {"interpretar": 300, "explicar": 400}
DEV_MONTHLY_LIMIT = Decimal("1.00")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_dev_orchestrator(
    settings: ServiceSettings,
    *,
    root: Path = SERVICE_ROOT,
    clock: Callable[[], datetime] = _utc_now,
    budget_policy: BudgetPolicy | None = None,
) -> tuple[Orchestrator, InMemoryAuditSink]:
    """Devuelve el orquestador de desarrollo y su almacén de trazas en memoria."""
    dev = json.loads((root / "fixtures" / "dev_dataset.json").read_text(encoding="utf-8"))
    allowlist = load_allowlist(root / "knowledge" / "allowlist.example.json")
    validator = SqlValidator(allowlist)

    corpus = build_corpus(
        load_json(root / "knowledge" / "erp_schema_metadata.json"),
        load_json(root / "knowledge" / "glossary_v1.json"),
        load_json(root / "knowledge" / "rules_v1.json"),
    )

    provider = MockLlmProvider(dev["account_keywords"])
    guard = BudgetGuard(
        budget_policy
        or BudgetPolicy(
            monthly_limit=DEV_MONTHLY_LIMIT,
            max_input_tokens=DEV_MAX_INPUT,
            max_output_tokens=DEV_MAX_OUTPUT,
            require_external_verification=False,  # simulación: no hay proveedor real que verificar
        ),
        SIM_PRICING,
        UsageLog(),
        clock,
    )
    gateway = ModelGateway(
        provider, guard, model=MockLlmProvider.model, max_input_tokens=DEV_MAX_INPUT, max_output_tokens=DEV_MAX_OUTPUT
    )
    audit_sink = InMemoryAuditSink()
    orchestrator = Orchestrator(
        interpreter=LlmBackedInterpreter(gateway),
        retriever=VectorRetriever.from_fragments(corpus, HashingEmbedder()),
        generator=TemplateSqlGenerator(),
        validator=validator,
        executor=build_fixture_executor(dev["dataset"], validator, dev["role"]),
        finance=DeterministicFinanceEngine(),
        explainer=LlmBackedExplainer(gateway),
        audit_sink=audit_sink,
        pseudonymizer=Pseudonymizer(settings.audit_hmac_key),
        allowed_roles=frozenset(allowlist.roles),
        clock=clock,
        versions={"pipeline": "b3-sim", "api": "t028-dev", "allowlist": allowlist.version, "dataset": dev["version"]},
    )
    return orchestrator, audit_sink
