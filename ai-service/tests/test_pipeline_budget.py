"""Pruebas de integración del control de presupuesto en el pipeline (T024, SC-018, D-14).

Solo consumos y precios simulados. El contador de BudgetGuard vive en memoria y no es un control
económico garantizado para producción (R-06, P-22).
"""

from __future__ import annotations

import re
from decimal import Decimal

from guards import GuardedTestCase

from ai_service.llm.budget import USAGE_RECORD_FIELDS
from ai_service.orchestrator.pipeline import ERROR_UNAVAILABLE, ErrorBody
from pipeline_support import build_harness, make_policy, request

QUESTION = "¿Cuál fue el saldo de caja en septiembre?"


class BudgetPipelineTests(GuardedTestCase):
    def test_normal_flow_records_two_simulated_calls(self) -> None:
        h = build_harness()
        outcome = h.orchestrator.handle(request(QUESTION))
        self.assertEqual(outcome.status_code, 200)
        self.assertEqual(len(h.provider.calls), 2)  # interpretar + explicar
        self.assertEqual([r.task for r in h.usage.records()], ["interpretar", "explicar"])
        self.assertGreater(sum(r.estimated_cost for r in h.usage.records()), Decimal("0"))
        self.assertEqual(h.guard.pending_reservations, Decimal("0"))

    def test_exhausted_budget_blocks_before_any_call(self) -> None:
        h = build_harness(policy=make_policy(monthly_limit="0.001"))
        outcome = h.orchestrator.handle(request(QUESTION))
        self.assertEqual(outcome.status_code, 503)
        self.assertIsInstance(outcome.body, ErrorBody)
        self.assertEqual(outcome.body.error, ERROR_UNAVAILABLE)
        self.assertEqual(h.provider.calls, [])  # ninguna llamada facturable
        self.assertEqual(h.executor.calls, 0)
        self.assertIn("BUDGET_EXHAUSTED", outcome.audit.codigos_rechazo)

    def test_unverifiable_budget_blocks(self) -> None:
        for verifier, policy in ((None, make_policy(require_external_verification=True)), (lambda: None, None)):
            with self.subTest(verifier=verifier):
                h = build_harness(policy=policy, verifier=verifier)
                outcome = h.orchestrator.handle(request(QUESTION))
                self.assertEqual(outcome.status_code, 503)
                self.assertEqual(h.provider.calls, [])
                self.assertIn("BUDGET_UNVERIFIABLE", outcome.audit.codigos_rechazo)

    def test_budget_exhausted_at_explanation_stage(self) -> None:
        # Peor caso de interpretar ≈ 0.0093 (cabe); gasto real ≈ 0.0021; peor caso de explicar
        # ≈ 0.0123 → 0.0021 + 0.0123 > 0.012, así que la explicación se bloquea.
        h = build_harness(policy=make_policy(monthly_limit="0.012"))
        outcome = h.orchestrator.handle(request(QUESTION))
        self.assertEqual(outcome.status_code, 503)
        self.assertEqual([c.entrada.tarea for c in h.provider.calls], ["interpretar"])
        self.assertEqual(h.executor.calls, 1)  # el SQL ya validado sí se ejecutó (fixture)

    def test_error_body_has_no_economic_details(self) -> None:
        h = build_harness(policy=make_policy(monthly_limit="0"))
        outcome = h.orchestrator.handle(request(QUESTION))
        dumped = outcome.body.model_dump_json()
        self.assertIsNone(re.search(r"\d|S/|\$|USD|presupuesto|costo|saldo|budget", dumped, re.I))

    def test_prefilter_rejections_consume_no_budget(self) -> None:
        h = build_harness()
        for message in ("Anula el asiento 12", "¿Quién ganó el partido?", "Pagos del DNI 45871236"):
            with self.subTest(message=message):
                outcome = h.orchestrator.handle(request(message))
                self.assertEqual(outcome.status_code, 200)
        self.assertEqual(h.provider.calls, [])
        self.assertEqual(h.usage.records(), ())

    def test_usage_log_stores_no_prompts(self) -> None:
        h = build_harness()
        h.orchestrator.handle(request(QUESTION))
        self.assertFalse(USAGE_RECORD_FIELDS & {"prompt", "mensaje", "texto", "respuesta", "historial"})
        for record in h.usage.records():
            self.assertNotIn("caja", repr(record).lower())
