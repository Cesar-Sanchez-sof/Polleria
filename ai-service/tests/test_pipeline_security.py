"""Incidentes de seguridad dentro del pipeline (B3, BR-13, SEC-6). Solo datos ficticios y simulaciones.

Se simula un **fallo del prefiltro** (inyectando uno permisivo) para comprobar que la segunda línea
de defensa (``ModelGateway``) y la tercera (proveedor simulado) detienen el procesamiento sin
exponer datos, sin consumir presupuesto y sin invocar componentes posteriores.
"""

from __future__ import annotations

from decimal import Decimal

from guards import GuardedTestCase

from ai_service.orchestrator.pipeline import COMPONENT_FAILURE, ERROR_UNAVAILABLE, ErrorBody
from ai_service.orchestrator.ports import Fragment
from ai_service.orchestrator.prefilter import ALLOW
from ai_service.orchestrator.security import (
    SECURITY_INCIDENT,
    SENSITIVE_DATA_BLOCKED,
    SecurityIncident,
    SensitiveDataBlocked,
)
from ai_service.simulation.components import KeywordRetriever
from ai_service.simulation.llm import MockLlmProvider, SensitiveDataLeak
from pipeline_support import GOLD, assert_audit_hmacs, audit_clear_text, build_harness, request

FAKE_DNI = "45871236"
FAKE_EMAIL = "ana.perez@ejemplo.test"
AMOUNTS = ("3749.50", "3,749.50", "5200", "5,200.00", "1450.50", "1,450.50")


def permissive_prefilter(_request):
    """Simula un prefiltro defectuoso que deja pasar todo."""
    return ALLOW


class CountingRetriever:
    def __init__(self) -> None:
        self._inner = KeywordRetriever(Fragment(**f) for f in GOLD["fragments"])
        self.calls = 0

    def retrieve(self, query, k):
        self.calls += 1
        return self._inner.retrieve(query, k)


class HierarchyTests(GuardedTestCase):
    def test_security_exceptions_are_specific(self) -> None:
        self.assertFalse(issubclass(SecurityIncident, AssertionError))
        self.assertTrue(issubclass(SensitiveDataBlocked, SecurityIncident))
        self.assertTrue(issubclass(SensitiveDataLeak, SecurityIncident))
        self.assertNotIn(FAKE_DNI, str(SensitiveDataBlocked()))


class GatewayBlocksSensitiveDataTests(GuardedTestCase):
    """Segunda línea: ModelGateway bloquea antes del presupuesto y del proveedor."""

    def _assert_stopped_before_everything(self, h, retriever, outcome) -> None:
        self.assertEqual(outcome.status_code, 503)
        self.assertTrue(outcome.security_incident)
        self.assertIsInstance(outcome.body, ErrorBody)
        self.assertEqual(outcome.body.error, ERROR_UNAVAILABLE)
        self.assertIn(SECURITY_INCIDENT, outcome.audit.codigos_rechazo)
        self.assertIn(SENSITIVE_DATA_BLOCKED, outcome.audit.codigos_rechazo)
        # Ningún componente posterior se invoca y no se consume presupuesto.
        self.assertEqual(h.provider.calls, [])
        self.assertEqual(h.usage.records(), ())
        self.assertEqual(h.guard.pending_reservations, Decimal("0"))
        self.assertEqual(retriever.calls, 0)
        self.assertEqual(h.generator.calls, 0)
        self.assertEqual(h.executor.calls, 0)
        # Nada sensible en la respuesta ni en los campos en claro de la traza; HMAC validados aparte.
        clear_text = audit_clear_text(outcome.audit)
        for secret in (FAKE_DNI, FAKE_EMAIL):
            self.assertNotIn(secret, outcome.body.model_dump_json())
            self.assertNotIn(secret, clear_text)
        assert_audit_hmacs(self, outcome.audit, h.pseudonymizer)

    def test_sensitive_message_with_failed_prefilter(self) -> None:
        retriever = CountingRetriever()
        h = build_harness(prefilter_fn=permissive_prefilter, retriever=retriever)
        outcome = h.orchestrator.handle(request(f"Saldo de caja en septiembre del DNI {FAKE_DNI}"))
        self._assert_stopped_before_everything(h, retriever, outcome)

    def test_sensitive_user_history_with_failed_prefilter(self) -> None:
        retriever = CountingRetriever()
        h = build_harness(prefilter_fn=permissive_prefilter, retriever=retriever)
        history = [{"rol": "usuario", "texto": f"escríbeme a {FAKE_EMAIL}"}]
        outcome = h.orchestrator.handle(request("Saldo de caja en septiembre", historial=history))
        self._assert_stopped_before_everything(h, retriever, outcome)

    def test_assistant_turns_with_amounts_are_not_forwarded(self) -> None:
        # Sin prefiltro: los turnos del asistente (con cifras reales) nunca llegan al proveedor.
        h = build_harness(prefilter_fn=permissive_prefilter)
        history = [
            {"rol": "usuario", "texto": "Saldo de caja en septiembre"},
            {"rol": "asistente", "texto": "El saldo es S/ 3,749.50."},
        ]
        outcome = h.orchestrator.handle(request("¿y en agosto?", historial=history))
        self.assertEqual(outcome.status_code, 200)
        self.assertFalse(outcome.security_incident)
        self.assertEqual(outcome.body.estado, "respondida")


class ProviderDetectsSensitiveDataTests(GuardedTestCase):
    """Tercera línea: el proveedor (simulado) detecta el incidente."""

    def test_incident_at_interpretation_stage(self) -> None:
        provider = MockLlmProvider(GOLD["account_keywords"], fail_with=SensitiveDataLeak())
        h = build_harness(provider=provider)
        outcome = h.orchestrator.handle(request("Saldo de caja en septiembre"))
        self.assertEqual(outcome.status_code, 503)
        self.assertTrue(outcome.security_incident)
        self.assertIn("PROVIDER_SENSITIVE_DATA", outcome.audit.codigos_rechazo)
        self.assertEqual(len(provider.calls), 1)
        self.assertEqual(h.usage.records(), ())  # reserva liberada, nada facturado
        self.assertEqual(h.guard.pending_reservations, Decimal("0"))
        self.assertEqual(h.generator.calls, 0)
        self.assertEqual(h.executor.calls, 0)

    def test_incident_at_explanation_stage_returns_no_figures(self) -> None:
        def leak(_request):
            raise SensitiveDataLeak()

        provider = MockLlmProvider(GOLD["account_keywords"], explain_override=leak)
        h = build_harness(provider=provider)
        outcome = h.orchestrator.handle(request("Saldo de caja en septiembre"))
        self.assertEqual(outcome.status_code, 503)
        self.assertTrue(outcome.security_incident)
        self.assertIsInstance(outcome.body, ErrorBody)  # nunca una respuesta "respondida"
        self.assertEqual(h.executor.calls, 1)  # ya se había ejecutado; nada se ejecuta después
        self.assertEqual([r.task for r in h.usage.records()], ["interpretar"])
        self.assertEqual(h.guard.pending_reservations, Decimal("0"))
        clear_text = audit_clear_text(outcome.audit)
        for amount in AMOUNTS:
            self.assertNotIn(amount, outcome.body.model_dump_json())
            self.assertNotIn(amount, clear_text)  # no en el texto de un digest hexadecimal
        assert_audit_hmacs(self, outcome.audit, h.pseudonymizer)
        self.assertEqual(len(outcome.audit.parametros), 4)  # LIMIT, cuenta, desde, hasta: solo HMAC


class NonSecurityFailuresTests(GuardedTestCase):
    def test_stray_assertion_error_is_controlled_and_not_a_security_incident(self) -> None:
        class AssertingRetriever:
            def retrieve(self, query, k):
                raise AssertionError("defecto interno simulado")

        h = build_harness(retriever=AssertingRetriever())
        outcome = h.orchestrator.handle(request("Saldo de caja en septiembre"))
        self.assertEqual(outcome.status_code, 503)  # controlado, sin caída del proceso
        self.assertFalse(outcome.security_incident)
        self.assertIn(COMPONENT_FAILURE, outcome.audit.codigos_rechazo)
        self.assertNotIn("defecto", outcome.body.model_dump_json())
        self.assertEqual(h.executor.calls, 0)

    def test_provider_outage_is_not_flagged_as_security(self) -> None:
        provider = MockLlmProvider(GOLD["account_keywords"], fail_with=TimeoutError("simulado"))
        h = build_harness(provider=provider)
        outcome = h.orchestrator.handle(request("Saldo de caja en septiembre"))
        self.assertEqual(outcome.status_code, 503)
        self.assertFalse(outcome.security_incident)
        self.assertNotIn(SECURITY_INCIDENT, outcome.audit.codigos_rechazo)
