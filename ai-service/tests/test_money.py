"""Pruebas de importes monetarios (T003)."""

from __future__ import annotations

from decimal import Decimal

from guards import GuardedTestCase

from ai_service.finance.money import (
    InvalidAmountError,
    format_pen,
    format_percent,
    round2,
    to_decimal,
)


class ToDecimalTests(GuardedTestCase):
    def test_accepts_decimal_int_and_str(self) -> None:
        self.assertEqual(to_decimal(Decimal("10.50")), Decimal("10.50"))
        self.assertEqual(to_decimal(7), Decimal("7"))
        self.assertEqual(to_decimal(" 1234.56 "), Decimal("1234.56"))

    def test_rejects_float(self) -> None:
        with self.assertRaises(InvalidAmountError):
            to_decimal(0.1)  # type: ignore[arg-type]

    def test_rejects_bool(self) -> None:
        with self.assertRaises(InvalidAmountError):
            to_decimal(True)

    def test_rejects_non_finite_and_invalid_text(self) -> None:
        for value in ("NaN", "Infinity", "-Infinity", "abc", ""):
            with self.subTest(value=value), self.assertRaises(InvalidAmountError):
                to_decimal(value)

    def test_rejects_unsupported_types(self) -> None:
        with self.assertRaises(InvalidAmountError):
            to_decimal(None)  # type: ignore[arg-type]


class Round2Tests(GuardedTestCase):
    def test_half_up_on_exact_decimals(self) -> None:
        cases = {
            "0.125": "0.13",
            "1.005": "1.01",
            "2.675": "2.68",
            "-0.125": "-0.13",
            "10.004": "10.00",
            "3": "3.00",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(round2(raw), Decimal(expected))


class FormatTests(GuardedTestCase):
    def test_format_pen(self) -> None:
        cases = {
            "1234.5": "S/ 1,234.50",
            "0": "S/ 0.00",
            "-0.001": "S/ 0.00",
            "-1234.567": "-S/ 1,234.57",
            "1234567.891": "S/ 1,234,567.89",
            "0.5": "S/ 0.50",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(format_pen(raw), expected)

    def test_format_percent(self) -> None:
        self.assertEqual(format_percent("12.345"), "12.35 %")
        self.assertEqual(format_percent("-5"), "-5.00 %")
        self.assertEqual(format_percent("-0.001"), "0.00 %")

    def test_format_rejects_float(self) -> None:
        with self.assertRaises(InvalidAmountError):
            format_pen(1.5)  # type: ignore[arg-type]
