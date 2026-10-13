"""Cifras de ``saldo_cuenta`` a partir del resultado del SQL de XiYanSQL, sin inventar datos.

El patrón entrenado devuelve, por cuenta, ``code``/``account_code``, ``type``/``account_type``,
``total_debit`` y ``total_credit``, pero **no** el número de movimientos. El motor de B3 lo exige
(``movimientos``) para distinguir "sin datos" de un saldo cero. Rellenarlo sería inventar un dato,
así que este módulo no lo usa:

1. **Presencia verificable por la forma del SQL** (:func:`ensure_verifiable_saldo_shape`, antes del
   validador): ``FROM journal_entry_detail`` con ``JOIN`` internos, ``GROUP BY``, totales como
   ``SUM`` directos y sin ``COALESCE``, subconsultas ni CTE. Con esa forma, existe una fila si y solo
   si hubo al menos un movimiento en el período. Si el modelo genera otra forma (por ejemplo,
   ``LEFT JOIN`` con ``COALESCE``, que convertiría "sin movimientos" en un saldo 0), la salida se
   trata como inválida y la consulta queda ``no_resoluble``.
2. **Cifras solo de valores devueltos** (:class:`XiYanSaldoFinanceAdapter`): sin filas →
   ``sin_datos``; una fila con código de la cuenta pedida, tipo conocido y ambos totales presentes →
   cifras con las mismas primitivas de B1 que el motor (``signed_balance``, ``round2``). Cualquier
   dato obligatorio ausente o inconsistente → ``FinanceEngineError`` (``503`` controlado, sin cifras).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

from ai_service.finance.balances import signed_balance
from ai_service.finance.engine import FinanceEngineError
from ai_service.finance.money import round2, to_decimal
from ai_service.http.schemas import Figure
from ai_service.orchestrator.ports import FinanceResult, InvalidGeneratorOutput, QueryPlan, Row

ACCOUNT_TYPES: frozenset[str] = frozenset({"Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto", "Costo"})
CODE_ALIASES = ("account_code", "code")
TYPE_ALIASES = ("account_type", "type")
TOTAL_COLUMNS = ("total_debit", "total_credit")
BASE_TABLE = "journal_entry_detail"


def ensure_verifiable_saldo_shape(sql: str) -> None:
    """Rechaza el SQL de saldo cuya forma no permite saber si hubo movimientos."""
    try:
        tree = sqlglot.parse_one(sql, read="postgres")
    except SqlglotError:
        raise InvalidGeneratorOutput("UNPARSEABLE_OUTPUT") from None
    if not isinstance(tree, exp.Select) or tree.args.get("with_") or tree.find(exp.Subquery, exp.Union):
        raise InvalidGeneratorOutput("UNVERIFIABLE_RESULT_SHAPE")
    source = tree.args.get("from_")
    if not isinstance(source, exp.From) or not isinstance(source.this, exp.Table) or source.this.name != BASE_TABLE:
        raise InvalidGeneratorOutput("UNVERIFIABLE_RESULT_SHAPE")
    for join in tree.args.get("joins") or []:
        if join.side or join.kind not in ("", "INNER") or join.args.get("on") is None:
            raise InvalidGeneratorOutput("UNVERIFIABLE_RESULT_SHAPE")
    if tree.args.get("group") is None or tree.find(exp.Coalesce):
        raise InvalidGeneratorOutput("UNVERIFIABLE_RESULT_SHAPE")
    totals = {p.alias: p.this for p in tree.expressions if isinstance(p, exp.Alias) and p.alias in TOTAL_COLUMNS}
    if set(totals) != set(TOTAL_COLUMNS) or not all(isinstance(value, exp.Sum) for value in totals.values()):
        raise InvalidGeneratorOutput("UNVERIFIABLE_RESULT_SHAPE")


def _pick(row: Row, aliases: Sequence[str]) -> object:
    present = [alias for alias in aliases if alias in row]
    if len(present) != 1:
        raise FinanceEngineError("Columnas del resultado ausentes o ambiguas.")
    return row[present[0]]


class XiYanSaldoFinanceAdapter:
    def compute(self, plan: QueryPlan, rows: Sequence[Row]) -> FinanceResult:
        if plan.kind != "saldo_cuenta":
            raise FinanceEngineError("Cálculo no soportado.")
        if not rows:
            return FinanceResult(no_data=True)  # forma verificada: sin filas ⇔ sin movimientos
        if len(rows) != 1:
            raise FinanceEngineError("Se esperaba una sola fila agregada por cuenta.")

        row = rows[0]
        if any(column not in row or row[column] is None for column in TOTAL_COLUMNS):
            raise FinanceEngineError("Totales ausentes en el resultado.")
        if str(_pick(row, CODE_ALIASES)) != plan.cuenta:
            raise FinanceEngineError("El resultado no corresponde a la cuenta solicitada.")
        account_type = _pick(row, TYPE_ALIASES)
        if account_type not in ACCOUNT_TYPES:
            raise FinanceEngineError("Tipo de cuenta no reconocido.")  # signed_balance lo trataría como acreedora

        debit = to_decimal(row["total_debit"])  # type: ignore[arg-type]
        credit = to_decimal(row["total_credit"])  # type: ignore[arg-type]
        return FinanceResult(
            figures=(
                Figure(marcador="c1", valor=signed_balance(str(account_type), debit, credit), unidad="PEN", origen="motor"),
                Figure(marcador="c2", valor=round2(debit), unidad="PEN", origen="executor"),
                Figure(marcador="c3", valor=round2(credit), unidad="PEN", origen="executor"),
            )
        )
