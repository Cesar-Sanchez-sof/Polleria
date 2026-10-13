"""Pruebas de las explicaciones verificadas (T023, FR-020)."""

from __future__ import annotations

from decimal import Decimal

from guards import GuardedTestCase

from ai_service.explanation.markers import (
    DUPLICATE_FIGURE,
    MALFORMED_MARKER,
    UNKNOWN_MARKER,
    UNUSED_FIGURE,
    UNVERIFIED_QUANTITY,
    MarkerValidationError,
    render_verified,
)
from ai_service.http.schemas import Figure

FIGURES = (
    Figure(marcador="c1", valor=Decimal("3749.50"), unidad="PEN", origen="motor"),
    Figure(marcador="c2", valor=Decimal("12.5"), unidad="%", origen="motor"),
)


class RenderTests(GuardedTestCase):
    def test_inserts_verified_figures(self) -> None:
        text = render_verified("Saldo al 30/09/2026: {{c1}}, que representa {{ c2 }} del total.", FIGURES)
        self.assertEqual(text, "Saldo al 30/09/2026: S/ 3,749.50, que representa 12.50 % del total.")

    def test_years_and_dates_are_allowed(self) -> None:
        text = render_verified("En 2026 (01/09/2026 al 30/09/2026) fue {{c1}}; variación {{c2}}.", FIGURES)
        self.assertIn("S/ 3,749.50", text)

    def test_rejections(self) -> None:
        cases = {
            "Saldo {{c9}} y {{c1}} {{c2}}": UNKNOWN_MARKER,
            "Solo {{c1}}": UNUSED_FIGURE,
            "Saldo {{1234.56}} {{c1}} {{c2}}": MALFORMED_MARKER,
            "Saldo {{c1} {{c2}}": MALFORMED_MARKER,
            "Saldo {c1} {{c1}} {{c2}}": MALFORMED_MARKER,
            "Saldo {{c1}} más 200 {{c2}}": UNVERIFIED_QUANTITY,
            "Saldo {{c1}} y S/ {{c2}}": UNVERIFIED_QUANTITY,
            "Saldo {{c1}} ({{c2}}) o sea 90%": UNVERIFIED_QUANTITY,
            "Saldo {{c1}} {{c2}} y $ extra": UNVERIFIED_QUANTITY,
            "Saldo {{c1}} {{c2}} desde el día 5": UNVERIFIED_QUANTITY,
        }
        for text, code in cases.items():
            with self.subTest(text=text):
                with self.assertRaises(MarkerValidationError) as ctx:
                    render_verified(text, FIGURES)
                self.assertEqual(ctx.exception.code, code)

    def test_duplicate_figures(self) -> None:
        with self.assertRaises(MarkerValidationError) as ctx:
            render_verified("{{c1}}", (FIGURES[0], FIGURES[0]))
        self.assertEqual(ctx.exception.code, DUPLICATE_FIGURE)

    def test_model_cannot_change_values(self) -> None:
        text = render_verified("{{c1}} {{c2}}", FIGURES)
        self.assertEqual(text, "S/ 3,749.50 12.50 %")
