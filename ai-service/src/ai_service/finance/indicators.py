"""Primitivas deterministas del motor financiero (T005, FR-019).

Solo operaciones aritméticas genéricas que las respuestas necesitan para expresar cifras y
porcentajes. **No** se definen indicadores con nombre propio (liquidez, márgenes, etc.): su
catálogo y sus fórmulas están pendientes de P-6.

Reglas:

- Las entradas pasan por ``money.to_decimal`` (sin ``float``).
- Los resultados son ``Decimal`` exactos sin redondear; el redondeo se aplica al presentar.
- Si un cálculo no es posible (denominador cero), se devuelve :class:`NoCalculable`; nunca
  ``inf`` ni ``NaN`` (edge case de división por cero de la spec).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from ai_service.finance.money import AmountInput, to_decimal

HUNDRED = Decimal("100")


@dataclass(frozen=True)
class NoCalculable:
    """Resultado no calculable, con un motivo apto para explicar al usuario."""

    reason: str


Result = Decimal | NoCalculable

ZERO_DENOMINATOR = "El denominador es cero; el valor no se puede calcular."
ZERO_TOTAL = "El total de referencia es cero; el porcentaje no se puede calcular."
ZERO_BASE = "El valor del período base es cero; la variación no se puede calcular."


def ratio(numerator: AmountInput, denominator: AmountInput) -> Result:
    """``numerator / denominator``; ``NoCalculable`` si el denominador es cero."""
    den = to_decimal(denominator)
    if den == 0:
        return NoCalculable(ZERO_DENOMINATOR)
    return to_decimal(numerator) / den


def percentage_of(part: AmountInput, total: AmountInput) -> Result:
    """Porcentaje que representa ``part`` sobre ``total`` (``part / total * 100``)."""
    tot = to_decimal(total)
    if tot == 0:
        return NoCalculable(ZERO_TOTAL)
    return to_decimal(part) / tot * HUNDRED


def percentage_change(previous: AmountInput, current: AmountInput) -> Result:
    """Variación porcentual ``(current - previous) / previous * 100``.

    Fórmula aritmética estándar, sin reglas adicionales. Con una base negativa el signo del
    resultado debe explicarse al usuario; esa interpretación no se decide aquí.
    """
    prev = to_decimal(previous)
    if prev == 0:
        return NoCalculable(ZERO_BASE)
    return (to_decimal(current) - prev) / prev * HUNDRED
