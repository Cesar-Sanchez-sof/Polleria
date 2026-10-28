"""Cifras de las familias de consulta (P1) a partir de las filas devueltas, sin inventar datos.

Reglas:

- Solo se leen las columnas de métrica declaradas en el catálogo (``metrics``) y las columnas de
  etiqueta (``labels``); si el resultado no trae ninguna métrica esperada → ``FinanceEngineError``
  (la consulta queda ``no_resoluble`` con ``RESULT_NOT_INTERPRETABLE``; nunca se adivina).
- Cero filas → ``no_data`` ("la consulta no devolvió registros"); no es un fallo. Una consulta
  escalar con ``COALESCE`` devuelve una fila con 0, que es un resultado real y se muestra.
- Cifras derivadas, calculadas aquí con ``Decimal`` (``origen="motor"``): total del período en las
  agrupadas, listas y series; día de mayor importe en las series; diferencia en las comparaciones.
- Se muestran como máximo :data:`MAX_FIGURES` cifras (límite del contrato); si hay más filas, una
  nota lo indica ("Se muestran N de M filas"). Los totales derivados usan **todas** las filas.
- Las etiquetas de filas (nombre de un plato, una fecha) nunca van al Modelo 1: viajan como
  marcadores de texto ``eN`` que el backend inserta tras validar la explicación.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from ai_service.audit.masking import contains_sensitive
from ai_service.finance.engine import FinanceEngineError
from ai_service.finance.money import InvalidAmountError, round2, to_decimal
from ai_service.http.schemas import Figure
from ai_service.orchestrator.ports import FinanceEngine, FinanceResult, QueryPlan, Row
from ai_service.sqlgen.families import FamilyCatalog, QueryFamily

MAX_FIGURES = 20
MAX_ROWS_SHOWN = 8
MAX_LABEL_CHARS = 80
HIDDEN_LABEL = "(dato oculto)"


@dataclass(frozen=True)
class _Value:
    column: str
    value: Decimal
    unit: str
    label: str


def _number(raw: object, unit: str) -> Decimal:
    if raw is None:
        return Decimal("0")  # SUM sin filas en una agregación escalar
    try:
        value = to_decimal(raw if isinstance(raw, (Decimal, int, str)) else str(raw))
    except InvalidAmountError:
        raise FinanceEngineError("Valor de métrica no numérico.") from None
    return round2(value) if unit == "PEN" else value


def _text(raw: object) -> str:
    if isinstance(raw, datetime):
        text = raw.strftime("%d/%m/%Y")
    elif isinstance(raw, date):
        text = raw.strftime("%d/%m/%Y")
    else:
        text = str(raw).strip()
    return HIDDEN_LABEL if contains_sensitive(text) else text


class FamilyResultAdapter:
    def __init__(self, catalog: FamilyCatalog) -> None:
        self._catalog = catalog

    def compute(self, plan: QueryPlan, rows: Sequence[Row]) -> FinanceResult:
        if plan.kind != "familia" or plan.familia is None:
            raise FinanceEngineError("Cálculo no soportado.")
        family = self._catalog.get(plan.familia)
        if not rows:
            return FinanceResult(no_data=True)
        # Columna del resultado de cada métrica: su nombre o un alias declarado en el catálogo.
        source = {}
        for metric in family.metrics:
            found = next((c for c in (metric, *family.aliases.get(metric, ())) if c in rows[0]), None)
            if found is not None:
                source[metric] = found
        if not source:
            raise FinanceEngineError("El resultado no trae ninguna métrica esperada.")
        table = [
            [_Value(m, _number(row.get(c), family.metrics[m][0]), *family.metrics[m]) for m, c in source.items()]
            for row in rows
        ]
        labels = [self._row_label(family, row) for row in rows]
        return _Builder(family, table, labels, plan.foco, plan.metrica).build()

    @staticmethod
    def _row_label(family: QueryFamily, row: Row) -> str:
        parts = [_text(row[c]) for c in family.labels if c in row and row[c] is not None]
        if family.labels and not parts:
            raise FinanceEngineError("Fila sin columnas de etiqueta.")
        if family.labels[:3] == ("voucher_type", "series", "number") and len(parts) >= 3:
            parts = [parts[0], f"{parts[1]}-{parts[2]}", *parts[3:]]  # B001-123
        return " · ".join(parts)[:MAX_LABEL_CHARS]


class _Builder:
    def __init__(self, family: QueryFamily, table: list[list[_Value]], labels: list[str], focus: str | None = None,
                 metric: str | None = None) -> None:
        self.family, self.table, self.row_labels, self.focus, self.metric = family, table, labels, focus, metric
        self.figures: list[Figure] = []
        self.labels: dict[str, str] = {}
        self.meanings: dict[str, str] = {}
        self.text_labels: dict[str, str] = {}
        self.primary: list[str] = []
        self.notes: list[str] = []

    def add(self, value: Decimal, unit: str, label: str, origin: str, meaning: str | None = None) -> str:
        marker = f"c{len(self.figures) + 1}"
        self.figures.append(Figure(marcador=marker, valor=value, unidad=unit, origen=origin))  # type: ignore[arg-type]
        self.labels[marker] = label[:MAX_LABEL_CHARS]
        if meaning:
            self.meanings[marker] = meaning
            self.primary.append(marker)
        return marker

    def text(self, value: str, meaning: str) -> None:
        marker = f"e{len(self.text_labels) + 1}"
        self.text_labels[marker] = value
        self.meanings[marker] = meaning

    def total(self, value: _Value) -> Decimal:
        return sum((row[[v.column for v in row].index(value.column)].value for row in self.table), Decimal("0"))

    def build(self) -> FinanceResult:
        shape = self.family.shape
        first = self.table[0]
        money = next((v for v in first if v.column == self.metric), None) or next((v for v in first if v.unit == "PEN"), first[0])
        if shape in ("escalar", "comparacion"):
            for value in first:
                self.add(value.value, value.unit, value.label, "executor", meaning=value.label.lower())
            if self.family.diferencia:
                left, right, label = self.family.diferencia
                by_column = {v.column: v.value for v in first}
                if left in by_column and right in by_column:
                    self.add(round2(by_column[left] - by_column[right]), "PEN", label, "motor", meaning=label.lower())
        else:
            if shape == "ranking":
                self.add(money.value, money.unit, f"Primer lugar · {self.row_labels[0]}", "executor",
                         meaning=f"{money.label.lower()} del primer lugar")
                self.text(self.row_labels[0], "nombre del primer lugar")
            elif shape == "serie":
                best = max(range(len(self.table)), key=lambda i: self.table[i][first.index(money)].value)
                self.add(self.table[best][first.index(money)].value, money.unit,
                         f"Mayor del período ({self.row_labels[best]})", "executor",
                         meaning=f"{money.label.lower()} del día con el mayor valor")
                self.text(self.row_labels[best], "fecha del día con el mayor valor")
            if self.focus and shape in ("agrupada", "ranking"):
                self._focus(money)
            if shape in ("agrupada", "serie", "lista") and money.unit in ("PEN", "N"):
                self.add(self.total(money), money.unit, f"Total del período · {money.label}", "motor",
                         meaning=None if self.focus else f"total del período ({money.label.lower()})")
            if shape == "agrupada" and not self.focus and len(self.table) > 1:
                # Grupo con el mayor valor ("¿proveedores con más compras?"): calculado aquí, no por orden de filas.
                column = first.index(money)
                best = max(range(len(self.table)), key=lambda i: self.table[i][column].value)
                self.add(self.table[best][column].value, money.unit, f"Mayor · {self.row_labels[best]}", "executor",
                         meaning=f"{money.label.lower()} del grupo con el mayor valor")
                self.text(self.row_labels[best], "nombre del grupo con el mayor valor")
            if shape == "lista":
                self.add(Decimal(len(self.table)), "N", "Registros encontrados", "motor", meaning="cantidad de registros")
            self._rows()
        return FinanceResult(
            figures=tuple(self.figures),
            labels=self.labels,
            primary=tuple(self.primary),
            meanings=self.meanings,
            text_labels=self.text_labels,
            notes=tuple(self.notes),
        )

    def _focus(self, money: _Value) -> None:
        """El grupo que pide la pregunta. Si la consulta agrupada no lo devolvió, no tuvo registros en el período:
        su valor es 0 (suma o conteo vacíos), calculado aquí y marcado como tal."""
        column = self.table[0].index(money)
        wanted = self.focus.lower()  # type: ignore[union-attr]
        index = next((i for i, label in enumerate(self.row_labels) if wanted in label.lower()), None)
        if index is None:
            self.add(Decimal("0"), money.unit, f"{self.focus} · sin registros en el período", "motor",
                     meaning=f"{money.label.lower()} del grupo consultado")
            self.text(self.focus, "nombre del grupo consultado")  # type: ignore[arg-type]
            self.notes.append(f"No hubo registros de {self.focus} en el período.")
            return
        self.add(self.table[index][column].value, money.unit, f"{self.row_labels[index]} · {money.label}", "executor",
                 meaning=f"{money.label.lower()} del grupo consultado")
        self.text(self.row_labels[index], "nombre del grupo consultado")

    def _rows(self) -> None:
        per_row = len(self.table[0])
        room = max(0, (MAX_FIGURES - len(self.figures)) // per_row)
        shown = min(len(self.table), room, MAX_ROWS_SHOWN)
        for label, row in zip(self.row_labels[:shown], self.table[:shown]):
            for value in row:
                self.add(value.value, value.unit, f"{label} · {value.label}", "executor")
        if shown < len(self.table):
            self.notes.append(f"Se muestran {shown} de {len(self.table)} filas; los totales usan todas las filas.")


class PlanFinanceRouter:
    """``FinanceEngine`` del modo XiYanSQL: saldo de cuenta (B1) o familia de consulta (P1)."""

    def __init__(self, saldo: FinanceEngine, families: FamilyResultAdapter | None, free: FinanceEngine | None = None) -> None:
        self._saldo, self._families, self._free = saldo, families, free

    def compute(self, plan: QueryPlan, rows: Sequence[Row]) -> FinanceResult:
        if plan.kind == "libre":
            if self._free is None:
                raise FinanceEngineError("Ruta ampliada no habilitada.")
            return self._free.compute(plan, rows)
        if plan.kind == "familia":
            if self._families is None:
                raise FinanceEngineError("Familias de consulta no habilitadas.")
            return self._families.compute(plan, rows)
        return self._saldo.compute(plan, rows)
