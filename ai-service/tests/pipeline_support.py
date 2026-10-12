"""Construcción del orquestador simulado para las pruebas de B3.

Combina componentes **reales** de B1/B2 (SQL Validator, motor financiero, BudgetGuard, UsageLog,
auditoría) con simulaciones (proveedor LLM, recuperación, generador de SQL y Executor con fixtures).
Sin red, sin bases de datos y sin modelos reales. La clave HMAC es aleatoria por ejecución.
"""

from __future__ import annotations

import json
import re
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

import guards  # noqa: F401  (añade src/ a sys.path)

from ai_service.audit.masking import Pseudonymizer
from ai_service.finance.engine import DeterministicFinanceEngine
from ai_service.llm.budget import BudgetGuard, BudgetPolicy, ModelPrice, UsageLog
from ai_service.orchestrator.model_calls import LlmBackedExplainer, LlmBackedInterpreter, ModelGateway
from ai_service.orchestrator.pipeline import Orchestrator
from ai_service.orchestrator.ports import Fragment
from ai_service.simulation.components import (
    FixtureExecutor,
    InMemoryAuditSink,
    KeywordRetriever,
    TemplateSqlGenerator,
    build_fixture_executor,
)
from ai_service.simulation.llm import MockLlmProvider
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator

TESTS_DIR = Path(__file__).resolve().parent
ROOT = TESTS_DIR.parent
GOLD = json.loads((TESTS_DIR / "fixtures" / "gold_mini.json").read_text(encoding="utf-8"))
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.example.json")
ROLE = GOLD["role"]
REFERENCE_DATE = date.fromisoformat(GOLD["reference_date"])
NOW = datetime(2026, 10, 12, 17, 0, tzinfo=timezone.utc)

# Precios SIMULADOS (no corresponden a ningún proveedor real).
SIM_PRICING = {MockLlmProvider.model: ModelPrice(input_per_1k=Decimal("0.010"), output_per_1k=Decimal("0.030"))}
MAX_IN = {"interpretar": 2000, "explicar": 1000}
MAX_OUT = {"interpretar": 300, "explicar": 400}


@dataclass
class Harness:
    orchestrator: Orchestrator
    provider: MockLlmProvider
    generator: TemplateSqlGenerator
    executor: FixtureExecutor
    audit: InMemoryAuditSink
    usage: UsageLog
    guard: BudgetGuard
    pseudonymizer: Pseudonymizer  # clave aleatoria de prueba, para verificar los HMAC


HMAC_RE = re.compile(r"^hmac-sha256:[0-9a-f]{64}$")


def audit_clear_text(record) -> str:
    """Traza serializada **sin los campos HMAC** (seudónimo y parámetros enmascarados).

    Las búsquedas de cifras o datos sensibles se hacen sobre este texto: un digest hexadecimal
    puede contener por azar una secuencia como ``5200`` sin que exista ninguna fuga. Los HMAC se
    validan aparte con :func:`assert_audit_hmacs`.
    """
    data = record.model_dump(mode="json")
    data.pop("usuario_seudonimo")
    data["parametros"] = [{"tipo": p["tipo"]} for p in data["parametros"]]
    return json.dumps(data, ensure_ascii=False)


def assert_audit_hmacs(case, record, pseudonymizer: Pseudonymizer, user_id: int = 7) -> None:
    """Valida los campos HMAC por separado: formato, claves exactas y seudónimo recalculable."""
    case.assertRegex(record.usuario_seudonimo, HMAC_RE)
    case.assertEqual(record.usuario_seudonimo, pseudonymizer.digest(str(user_id), context="usuario"))
    for parameter in record.model_dump(mode="json")["parametros"]:
        case.assertEqual(set(parameter), {"tipo", "hmac"})  # nunca el valor original
        case.assertRegex(parameter["hmac"], HMAC_RE)


def make_policy(monthly_limit: str = "1.00", require_external_verification: bool = False) -> BudgetPolicy:
    return BudgetPolicy(
        monthly_limit=Decimal(monthly_limit),
        max_input_tokens=MAX_IN,
        max_output_tokens=MAX_OUT,
        require_external_verification=require_external_verification,
    )


def build_harness(
    *,
    provider: MockLlmProvider | None = None,
    generator: TemplateSqlGenerator | None = None,
    policy: BudgetPolicy | None = None,
    verifier: Any = None,
    retriever: Any = None,
    prefilter_fn: Any = None,
) -> Harness:
    validator = SqlValidator(ALLOWLIST)
    provider = provider or MockLlmProvider(GOLD["account_keywords"])
    generator = generator or TemplateSqlGenerator()
    executor = build_fixture_executor(GOLD["dataset"], validator, ROLE)
    usage = UsageLog()
    guard = BudgetGuard(policy or make_policy(), SIM_PRICING, usage, lambda: NOW, verifier)
    gateway = ModelGateway(
        provider, guard, model=MockLlmProvider.model, max_input_tokens=MAX_IN, max_output_tokens=MAX_OUT
    )
    audit = InMemoryAuditSink()
    pseudonymizer = Pseudonymizer(bytes.fromhex(secrets.token_hex(32)))
    orchestrator = Orchestrator(
        interpreter=LlmBackedInterpreter(gateway),
        retriever=retriever or KeywordRetriever(Fragment(**f) for f in GOLD["fragments"]),
        generator=generator,
        validator=validator,
        executor=executor,
        finance=DeterministicFinanceEngine(),
        explainer=LlmBackedExplainer(gateway),
        audit_sink=audit,
        pseudonymizer=pseudonymizer,
        allowed_roles=frozenset(ALLOWLIST.roles),
        clock=lambda: NOW,
        versions={"pipeline": "b3-sim", "validator": "b2", "allowlist": ALLOWLIST.version},
        **({"prefilter_fn": prefilter_fn} if prefilter_fn is not None else {}),
    )
    return Harness(orchestrator, provider, generator, executor, audit, usage, guard, pseudonymizer)


def request(mensaje: str, *, historial=None, contexto=None, rol: str = ROLE, trace: str = "traza-b3-0001") -> dict:
    return {
        "id_traza": trace,
        "usuario": {"id": 7, "rol": rol},
        "mensaje": mensaje,
        "contexto": contexto,
        "historial": historial or [],
        "fecha_referencia_lima": REFERENCE_DATE.isoformat(),
    }
