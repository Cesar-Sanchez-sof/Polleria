"""Saldos contables (T004, D-4).

Reglas tomadas **en solo lectura** del ERP; no se inventan reglas nuevas:

- :func:`signed_balance` replica ``signedBalance(type, debit, credit)`` de
  ``lib/accounting/balance-sheet.ts``: las cuentas ``Activo``, ``Gasto`` y ``Costo`` tienen
  naturaleza deudora (``debe - haber``); cualquier otro tipo (``Pasivo``, ``Patrimonio``,
  ``Ingreso`` y, como en el ERP, tipos no reconocidos) tiene naturaleza acreedora
  (``haber - debe``). El resultado se redondea a 2 decimales (ver ``money`` para las diferencias
  de redondeo con JavaScript).
- :func:`closing_balance` replica el saldo del libro mayor (spec ``013``, BR-8):
  ``saldoFinal = saldoAnterior + Σdebe - Σhaber``, siempre con naturaleza deudora.

Fuera de alcance hasta decisiones pendientes:

- **Asientos anulados (P-4)**: este módulo no filtra movimientos. Quien lo llama decide qué
  movimientos entran; hoy el libro mayor incluye anulados y el balance no.
- **Indicadores con nombre propio (P-6)**: no se implementan aquí.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

from ai_service.finance.money import AmountInput, round2, to_decimal

DEBIT_NATURE_TYPES: frozenset[str] = frozenset({"Activo", "Gasto", "Costo"})


def is_debit_nature(account_type: str) -> bool:
    """``True`` si el tipo de cuenta tiene naturaleza deudora según el ERP."""
    return account_type in DEBIT_NATURE_TYPES


def signed_balance(account_type: str, debit: AmountInput, credit: AmountInput) -> Decimal:
    """Saldo con el signo de la naturaleza de la cuenta, redondeado a 2 decimales."""
    d = to_decimal(debit)
    c = to_decimal(credit)
    return round2(d - c) if is_debit_nature(account_type) else round2(c - d)


@dataclass(frozen=True)
class Movement:
    """Movimiento de una cuenta (importes exactos, sin redondear)."""

    debit: Decimal
    credit: Decimal

    def __post_init__(self) -> None:
        object.__setattr__(self, "debit", to_decimal(self.debit))
        object.__setattr__(self, "credit", to_decimal(self.credit))


@dataclass(frozen=True)
class Totals:
    """Totales de un conjunto de movimientos."""

    debit: Decimal
    credit: Decimal
    count: int


def account_totals(movements: Iterable[Movement]) -> Totals:
    """Suma exacta de debe y haber (sin redondeo intermedio)."""
    debit = Decimal("0")
    credit = Decimal("0")
    count = 0
    for movement in movements:
        debit += movement.debit
        credit += movement.credit
        count += 1
    return Totals(debit=debit, credit=credit, count=count)


def closing_balance(opening: AmountInput, totals: Totals) -> Decimal:
    """Saldo final del libro mayor: ``saldoAnterior + Σdebe - Σhaber`` (exacto, sin redondear).

    El redondeo se aplica al presentar la cifra (``money.round2`` / ``money.format_pen``).
    """
    return to_decimal(opening) + totals.debit - totals.credit
