"""Importes monetarios con ``Decimal`` (T003, BR-4).

Conversión estricta
-------------------
:func:`to_decimal` solo acepta ``Decimal``, ``int`` o ``str``. Rechaza ``float`` porque la
representación binaria introduce errores (``0.1 + 0.2 != 0.3``); los importes deben llegar como
texto o ``Decimal``, como los devuelve PostgreSQL para columnas ``numeric``. También rechaza
``bool``, ``NaN`` e infinitos.

Redondeo y diferencias con el ERP (JavaScript)
----------------------------------------------
El ERP redondea con ``Math.round(n * 100) / 100`` sobre números de coma flotante
(``round2`` en ``lib/accounting/balance-sheet.ts``). Este módulo redondea con
``Decimal.quantize(Decimal("0.01"), ROUND_HALF_UP)`` sobre valores decimales exactos. Ambos
coinciden salvo en los **empates en el tercer decimal**, por dos causas documentadas:

1. **Representación binaria en JavaScript**: ``1.005 * 100`` vale ``100.49999999999999`` en coma
   flotante, así que el ERP obtiene ``1.00``; aquí se obtiene ``1.01``. No todos los empates
   divergen: ``2.675 * 100`` vale exactamente ``267.5`` y ambos obtienen ``2.68``.
2. **Empates negativos**: ``Math.round`` desempata hacia ``+∞`` (``Math.round(-12.5) == -12``),
   mientras que ``ROUND_HALF_UP`` desempata alejándose de cero. Para ``-0.125`` el ERP obtiene
   ``-0.12`` y aquí ``-0.13``.

Estas divergencias **no se ocultan con tolerancias**: se enumeran en
``tests/fixtures/parity/balances.json`` y se verifican caso por caso. Solo afectan a importes con
más de dos decimales; los importes contables registrados con dos decimales no se ven afectados.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CENT = Decimal("0.01")

AmountInput = Decimal | int | str


class InvalidAmountError(ValueError):
    """El valor no es un importe decimal válido."""


def to_decimal(value: AmountInput) -> Decimal:
    """Convierte un importe a ``Decimal`` de forma estricta (sin ``float``)."""
    if isinstance(value, bool):
        raise InvalidAmountError("Un booleano no es un importe.")
    if isinstance(value, float):
        raise InvalidAmountError(
            "No se aceptan float para importes; use str o Decimal para evitar errores binarios."
        )
    if isinstance(value, Decimal):
        result = value
    elif isinstance(value, int):
        result = Decimal(value)
    elif isinstance(value, str):
        try:
            result = Decimal(value.strip())
        except InvalidOperation as exc:
            raise InvalidAmountError("El texto no representa un importe decimal.") from exc
    else:
        raise InvalidAmountError(f"Tipo de importe no admitido: {type(value).__name__}.")
    if not result.is_finite():
        raise InvalidAmountError("El importe debe ser un número finito.")
    return result


def round2(value: AmountInput) -> Decimal:
    """Redondea a 2 decimales con ``ROUND_HALF_UP`` (ver diferencias con JavaScript arriba)."""
    return to_decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def format_pen(value: AmountInput) -> str:
    """Formatea un importe en soles: ``S/ 1,234.56`` (negativos: ``-S/ 1,234.56``)."""
    amount = round2(value)
    sign = "-" if amount < 0 else ""
    return f"{sign}S/ {abs(amount):,.2f}"


def format_count(value: AmountInput) -> str:
    """Formatea una cantidad (comprobantes, unidades): ``1,234``; con decimales si los tiene (``12.50``)."""
    amount = to_decimal(value)
    if amount == amount.to_integral_value():
        return f"{int(amount):,}"
    return f"{round2(amount):,.2f}"


def format_percent(value: AmountInput) -> str:
    """Formatea un porcentaje ya expresado sobre 100, con 2 decimales: ``12.35 %``."""
    percent = round2(value)
    if percent == 0:
        percent = abs(percent)  # evita "-0.00 %"
    return f"{percent:.2f} %"
