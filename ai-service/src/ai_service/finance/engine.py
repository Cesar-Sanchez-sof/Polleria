"""Adaptador del motor financiero para el orquestador (T022, C10).

No es un motor nuevo: reutiliza las reglas de B1 (``balances.signed_balance`` y ``money.round2``).
Solo soporta el cálculo confirmado de **saldo de una cuenta** en un período; los indicadores con
nombre propio siguen pendientes de P-6. El criterio de asientos anulados (P-4) tampoco se decide
aquí: el motor usa las filas que recibe.

Contrato de filas para ``saldo_cuenta`` (una fila agrupada por tipo de cuenta):
``{"tipo": str, "debe": str|Decimal, "haber": str|Decimal, "movimientos": int}``.
"""

from __future__ import annotations

from collections.abc import Sequence

from ai_service.finance.balances import signed_balance
from ai_service.finance.money import round2, to_decimal
from ai_service.http.schemas import Figure
from ai_service.orchestrator.ports import FinanceResult, QueryPlan, Row


class FinanceEngineError(ValueError):
    """Las filas no cumplen el contrato esperado; no se calcula ninguna cifra."""


class DeterministicFinanceEngine:
    def compute(self, plan: QueryPlan, rows: Sequence[Row]) -> FinanceResult:
        if plan.kind != "saldo_cuenta":
            raise FinanceEngineError("Cálculo no soportado.")
        if not rows:
            return FinanceResult(no_data=True)
        if len(rows) != 1:
            raise FinanceEngineError("Se esperaba una sola fila agregada por cuenta.")

        row = rows[0]
        try:
            account_type = str(row["tipo"])
            debit = to_decimal(row["debe"])  # type: ignore[arg-type]
            credit = to_decimal(row["haber"])  # type: ignore[arg-type]
            movements = int(row["movimientos"])  # type: ignore[call-overload]
        except (KeyError, TypeError, ValueError) as exc:
            raise FinanceEngineError("Fila con formato inválido.") from exc

        if movements <= 0:
            return FinanceResult(no_data=True)  # BR-5: sin datos no hay cifra

        return FinanceResult(
            figures=(
                Figure(marcador="c1", valor=signed_balance(account_type, debit, credit), unidad="PEN", origen="motor"),
                Figure(marcador="c2", valor=round2(debit), unidad="PEN", origen="executor"),
                Figure(marcador="c3", valor=round2(credit), unidad="PEN", origen="executor"),
            )
        )
