"""Pruebas de las primitivas del motor financiero (T005)."""

from __future__ import annotations

from decimal import Decimal

from guards import GuardedTestCase

from ai_service.finance.indicators import (
    NoCalculable,
    percentage_change,
    percentage_of,
    ratio,
)
from ai_service.finance.money import InvalidAmountError, round2


class RatioTests(GuardedTestCase):
    def test_ratio(self) -> None:
        self.assertEqual(ratio("150", "100"), Decimal("1.5"))

    def test_zero_denominator_is_not_calculable(self) -> None:
        result = ratio("10", "0")
        self.assertIsInstance(result, NoCalculable)
        self.assertTrue(result.reason)  # type: ignore[union-attr]


class PercentageOfTests(GuardedTestCase):
    def test_share_of_total(self) -> None:
        self.assertEqual(percentage_of("250", "1000"), Decimal("25"))

    def test_presentation_rounding(self) -> None:
        result = percentage_of("1", "3")
        assert isinstance(result, Decimal)
        self.assertEqual(round2(result), Decimal("33.33"))

    def test_zero_total(self) -> None:
        self.assertIsInstance(percentage_of("5", "0"), NoCalculable)


class PercentageChangeTests(GuardedTestCase):
    def test_increase_and_decrease(self) -> None:
        self.assertEqual(percentage_change("200", "250"), Decimal("25"))
        self.assertEqual(percentage_change("200", "150"), Decimal("-25"))

    def test_zero_base(self) -> None:
        self.assertIsInstance(percentage_change("0", "100"), NoCalculable)


class SafetyOfResultsTests(GuardedTestCase):
    def test_results_are_finite_or_not_calculable(self) -> None:
        samples = [
            ratio("1", "0"),
            ratio("0", "7"),
            percentage_of("0", "0"),
            percentage_change("0", "0"),
            percentage_change("-50", "25"),
        ]
        for result in samples:
            with self.subTest(result=result):
                if isinstance(result, Decimal):
                    self.assertTrue(result.is_finite())
                else:
                    self.assertIsInstance(result, NoCalculable)

    def test_rejects_float_inputs(self) -> None:
        with self.assertRaises(InvalidAmountError):
            ratio(1.0, "2")  # type: ignore[arg-type]
