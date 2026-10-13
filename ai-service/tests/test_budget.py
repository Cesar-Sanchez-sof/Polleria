"""Pruebas del control de consumo del Modelo 1 con consumos simulados (T007, SC-018)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal

from guards import GuardedTestCase

from ai_service.llm.budget import (
    REASON_EXHAUSTED,
    REASON_REQUEST_LIMIT,
    REASON_UNVERIFIABLE,
    SERVICE_UNAVAILABLE_MESSAGE,
    USAGE_RECORD_FIELDS,
    Authorization,
    BudgetDenied,
    BudgetGuard,
    BudgetPolicy,
    BudgetUnavailable,
    CallRequest,
    ModelPrice,
    RequestLimitExceeded,
    UsageLog,
)

# Precios y modelo SIMULADOS: no corresponden a ningún proveedor real.
SIM_MODEL = "simulated-model"
SIM_PRICING = {SIM_MODEL: ModelPrice(input_per_1k=Decimal("0.010"), output_per_1k=Decimal("0.030"))}


class FakeClock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


class FakeProvider:
    """Proveedor simulado: solo cuenta llamadas. No hay red ni API comercial."""

    def __init__(self) -> None:
        self.calls = 0

    def complete(self, authorization: Authorization) -> int:
        self.calls += 1
        return min(100, authorization.max_output_tokens)


def make_policy(**overrides: object) -> BudgetPolicy:
    values: dict[str, object] = {
        "monthly_limit": Decimal("1.00"),
        "max_input_tokens": {"interpretar": 2000, "explicar": 1000},
        "max_output_tokens": {"interpretar": 300, "explicar": 500},
        "require_external_verification": False,
    }
    values.update(overrides)
    return BudgetPolicy(**values)  # type: ignore[arg-type]


def make_guard(policy: BudgetPolicy | None = None, verifier=None, now=None) -> tuple[BudgetGuard, UsageLog, FakeClock]:
    log = UsageLog()
    clock = FakeClock(now or datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc))
    guard = BudgetGuard(policy or make_policy(), SIM_PRICING, log, clock, verifier)
    return guard, log, clock


def guarded_call(guard: BudgetGuard, provider: FakeProvider, request: CallRequest) -> None:
    """Patrón obligatorio: autorizar → llamar → registrar. Si se deniega, no hay llamada."""
    authorization = guard.authorize(request)
    output_tokens = provider.complete(authorization)
    guard.record(
        authorization,
        model_version="sim-1",
        input_tokens=request.input_tokens,
        output_tokens=output_tokens,
        latency_ms=10,
        outcome="ok",
    )


def req(trace: str = "t-1", task: str = "interpretar", tokens: int = 500, retry: bool = False) -> CallRequest:
    return CallRequest(trace_id=trace, task=task, model=SIM_MODEL, input_tokens=tokens, is_retry=retry)


class WithinBudgetTests(GuardedTestCase):
    def test_authorized_call_is_recorded(self) -> None:
        guard, log, _ = make_guard()
        provider = FakeProvider()
        guarded_call(guard, provider, req())
        self.assertEqual(provider.calls, 1)
        self.assertEqual(len(log.records()), 1)
        # 500 * 0.010/1000 + 100 * 0.030/1000 = 0.005 + 0.003
        self.assertEqual(log.records()[0].estimated_cost, Decimal("0.008"))
        self.assertEqual(guard.pending_reservations, Decimal("0"))

    def test_reservation_and_cancel(self) -> None:
        guard, _, _ = make_guard()
        authorization = guard.authorize(req())
        # Peor caso: 500 * 0.010/1000 + 300 * 0.030/1000 = 0.005 + 0.009
        self.assertEqual(authorization.reserved_cost, Decimal("0.014"))
        self.assertEqual(guard.pending_reservations, Decimal("0.014"))
        guard.cancel(authorization)
        self.assertEqual(guard.pending_reservations, Decimal("0"))


class ExhaustedBudgetTests(GuardedTestCase):
    def test_exhausted_budget_makes_zero_calls(self) -> None:
        guard, _, _ = make_guard(make_policy(monthly_limit=Decimal("0.010")))
        provider = FakeProvider()
        with self.assertRaises(BudgetUnavailable) as ctx:
            guarded_call(guard, provider, req())
        self.assertEqual(provider.calls, 0)
        self.assertEqual(ctx.exception.reason, REASON_EXHAUSTED)
        self.assertEqual(ctx.exception.http_status, 503)

    def test_accumulated_spend_exhausts_budget(self) -> None:
        guard, _, _ = make_guard(make_policy(monthly_limit=Decimal("0.020")))
        provider = FakeProvider()
        guarded_call(guard, provider, req(trace="a"))  # gasta 0.008
        with self.assertRaises(BudgetUnavailable):
            guarded_call(guard, provider, req(trace="b"))  # 0.008 + 0.014 > 0.020
        self.assertEqual(provider.calls, 1)

    def test_previous_month_does_not_count(self) -> None:
        guard, _, clock = make_guard(make_policy(monthly_limit=Decimal("0.020")))
        provider = FakeProvider()
        clock.now = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)
        guarded_call(guard, provider, req(trace="septiembre"))
        clock.now = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
        guarded_call(guard, provider, req(trace="octubre"))
        self.assertEqual(provider.calls, 2)

    def test_public_message_has_no_economic_details(self) -> None:
        self.assertEqual(BudgetDenied.public_message, SERVICE_UNAVAILABLE_MESSAGE)
        self.assertIsNone(re.search(r"\d|S/|\$|USD|presupuesto|costo|saldo", SERVICE_UNAVAILABLE_MESSAGE, re.I))


class UnverifiableBudgetTests(GuardedTestCase):
    def test_required_verification_without_mechanism_denies(self) -> None:
        guard, _, _ = make_guard(make_policy(require_external_verification=True))
        provider = FakeProvider()
        with self.assertRaises(BudgetUnavailable) as ctx:
            guarded_call(guard, provider, req())
        self.assertEqual(ctx.exception.reason, REASON_UNVERIFIABLE)
        self.assertEqual(provider.calls, 0)

    def test_verifier_returning_none_denies(self) -> None:
        guard, _, _ = make_guard(verifier=lambda: None)
        provider = FakeProvider()
        with self.assertRaises(BudgetUnavailable):
            guarded_call(guard, provider, req())
        self.assertEqual(provider.calls, 0)

    def test_verifier_failure_denies(self) -> None:
        def broken() -> Decimal:
            raise TimeoutError("verificador simulado caído")

        guard, _, _ = make_guard(verifier=broken)
        provider = FakeProvider()
        with self.assertRaises(BudgetUnavailable) as ctx:
            guarded_call(guard, provider, req())
        self.assertEqual(ctx.exception.reason, REASON_UNVERIFIABLE)
        self.assertEqual(provider.calls, 0)

    def test_verifier_with_insufficient_remaining_denies(self) -> None:
        guard, _, _ = make_guard(verifier=lambda: Decimal("0.001"))
        provider = FakeProvider()
        with self.assertRaises(BudgetUnavailable) as ctx:
            guarded_call(guard, provider, req())
        self.assertEqual(ctx.exception.reason, REASON_EXHAUSTED)
        self.assertEqual(provider.calls, 0)

    def test_verifier_with_enough_remaining_allows(self) -> None:
        guard, _, _ = make_guard(verifier=lambda: "0.50")
        provider = FakeProvider()
        guarded_call(guard, provider, req())
        self.assertEqual(provider.calls, 1)

    def test_unknown_model_price_denies(self) -> None:
        guard, _, _ = make_guard()
        with self.assertRaises(BudgetUnavailable) as ctx:
            guard.authorize(CallRequest(trace_id="t", task="interpretar", model="otro", input_tokens=10))
        self.assertEqual(ctx.exception.reason, REASON_UNVERIFIABLE)


class RequestLimitTests(GuardedTestCase):
    def test_one_call_per_task_and_request(self) -> None:
        guard, _, _ = make_guard()
        provider = FakeProvider()
        guarded_call(guard, provider, req(task="interpretar"))
        guarded_call(guard, provider, req(task="explicar"))
        with self.assertRaises(RequestLimitExceeded) as ctx:
            guarded_call(guard, provider, req(task="interpretar"))
        self.assertEqual(ctx.exception.reason, REASON_REQUEST_LIMIT)
        self.assertEqual(ctx.exception.http_status, 503)
        self.assertEqual(provider.calls, 2)

    def test_retry_limits(self) -> None:
        guard, _, _ = make_guard()
        provider = FakeProvider()
        with self.assertRaises(RequestLimitExceeded):
            guarded_call(guard, provider, req(retry=True))  # reintento sin llamada previa
        guarded_call(guard, provider, req())
        guarded_call(guard, provider, req(retry=True))  # 1 reintento permitido
        with self.assertRaises(RequestLimitExceeded):
            guarded_call(guard, provider, req(retry=True))
        self.assertEqual(provider.calls, 2)

    def test_input_token_limit(self) -> None:
        guard, _, _ = make_guard()
        provider = FakeProvider()
        with self.assertRaises(RequestLimitExceeded):
            guarded_call(guard, provider, req(tokens=5000))
        self.assertEqual(provider.calls, 0)

    def test_max_calls_per_request(self) -> None:
        guard, _, _ = make_guard(make_policy(max_calls_per_request=1))
        provider = FakeProvider()
        guarded_call(guard, provider, req(task="interpretar"))
        with self.assertRaises(RequestLimitExceeded):
            guarded_call(guard, provider, req(task="explicar"))
        self.assertEqual(provider.calls, 1)

    def test_unknown_task_is_rejected(self) -> None:
        guard, _, _ = make_guard()
        with self.assertRaises(ValueError):
            guard.authorize(req(task="resumir"))


class UsageLogPrivacyTests(GuardedTestCase):
    def test_usage_record_has_no_prompt_or_response_fields(self) -> None:
        forbidden = {"prompt", "response", "respuesta", "pregunta", "question", "text", "texto", "messages", "content"}
        self.assertFalse(USAGE_RECORD_FIELDS & forbidden)

    def test_policy_validation(self) -> None:
        with self.assertRaises(ValueError):
            make_policy(monthly_limit=Decimal("-1"))
        with self.assertRaises(ValueError):
            make_policy(max_output_tokens={"interpretar": 10})
