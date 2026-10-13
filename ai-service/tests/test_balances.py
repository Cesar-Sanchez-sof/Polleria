"""Pruebas de saldos y paridad con el ERP (T004)."""

from __future__ import annotations

import json
import math
from decimal import Decimal
from pathlib import Path

from guards import GuardedTestCase

from ai_service.finance.balances import (
    Movement,
    account_totals,
    closing_balance,
    is_debit_nature,
    signed_balance,
)

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "parity" / "balances.json"


def _js_math_round(x: float) -> float:
    """Emula ``Math.round`` de JavaScript: entero más cercano, empates hacia +infinito."""
    floor = math.floor(x)
    return floor + 1 if x - floor >= 0.5 else floor


def _js_signed_balance(account_type: str, debit: str, credit: str) -> float:
    """Emula ``signedBalance`` del ERP con la misma aritmética de coma flotante (IEEE 754).

    Solo se usa en pruebas para comprobar los valores ``js_expected`` del fixture; el código del
    servicio nunca usa ``float`` para importes.
    """
    d, c = float(debit), float(credit)
    value = d - c if account_type in {"Activo", "Gasto", "Costo"} else c - d
    return _js_math_round(value * 100) / 100


class ParityTests(GuardedTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.cases = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]

    def test_python_matches_expected_exactly(self) -> None:
        for case in self.cases:
            with self.subTest(case=case["id"]):
                result = signed_balance(case["type"], case["debit"], case["credit"])
                self.assertEqual(result, Decimal(case["py_expected"]))

    def test_js_expectations_match_float_emulation(self) -> None:
        for case in self.cases:
            with self.subTest(case=case["id"]):
                js = _js_signed_balance(case["type"], case["debit"], case["credit"])
                self.assertEqual(Decimal(repr(js)), Decimal(case["js_expected"]))

    def test_divergences_are_declared_not_hidden(self) -> None:
        for case in self.cases:
            with self.subTest(case=case["id"]):
                differs = Decimal(case["py_expected"]) != Decimal(case["js_expected"])
                self.assertEqual(differs, case["diverges"])

    def test_known_divergences(self) -> None:
        divergent = sorted(c["id"] for c in self.cases if c["diverges"])
        self.assertEqual(divergent, ["binario-1.005", "empate-negativo"])


class NatureTests(GuardedTestCase):
    def test_debit_nature_types(self) -> None:
        for account_type in ("Activo", "Gasto", "Costo"):
            self.assertTrue(is_debit_nature(account_type))
        for account_type in ("Pasivo", "Patrimonio", "Ingreso", "Otro"):
            self.assertFalse(is_debit_nature(account_type))


class LedgerTests(GuardedTestCase):
    def test_totals_are_exact(self) -> None:
        movements = [
            Movement(debit=Decimal("400.00"), credit=Decimal("0")),
            Movement(debit=Decimal("0"), credit=Decimal("200.00")),
            Movement(debit="0.10", credit="0.20"),
        ]
        totals = account_totals(movements)
        self.assertEqual(totals.debit, Decimal("400.10"))
        self.assertEqual(totals.credit, Decimal("200.20"))
        self.assertEqual(totals.count, 3)

    def test_closing_balance_spec_013(self) -> None:
        totals = account_totals(
            [Movement(debit="400", credit="0"), Movement(debit="0", credit="200")]
        )
        self.assertEqual(closing_balance("1500", totals), Decimal("1700"))

    def test_empty_movements(self) -> None:
        totals = account_totals([])
        self.assertEqual((totals.debit, totals.credit, totals.count), (Decimal("0"), Decimal("0"), 0))
        self.assertEqual(closing_balance("0", totals), Decimal("0"))

    def test_movement_rejects_float(self) -> None:
        from ai_service.finance.money import InvalidAmountError

        with self.assertRaises(InvalidAmountError):
            Movement(debit=0.1, credit=Decimal("0"))  # type: ignore[arg-type]
