"""Cifras de la **ruta ampliada** a partir de las filas devueltas por Neon, sin inventar ni transformar datos.

El SQL de esta ruta no tiene una forma entrenada, así que el resultado se presenta tal cual:

- Cero filas → ``no_data`` (consulta válida sin registros; no es un fallo).
- Columnas numéricas → cifras. La unidad se deduce SOLO del nombre de la columna: importes (``amount``,
  ``total``, ``price``, ``cost``…) en soles; el resto (conteos, cantidades, stock) como cantidad. Los
  identificadores (``id``, ``*_id``) no se muestran.
- Columnas de texto o fecha → etiquetas de fila; en la explicación viajan como marcadores ``eN`` que el
  backend inserta (nunca se envían al Modelo 1).
- Varias filas → «Registros devueltos» (``origen="motor"``) y, por fila, sus cifras con la etiqueta de la
  fila, hasta :data:`MAX_FIGURES`; si hay más, una nota lo indica.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import date, datetime, time
from decimal import Decimal

from ai_service.audit.masking import contains_sensitive
from ai_service.finance.engine import FinanceEngineError
from ai_service.finance.money import InvalidAmountError, round2, to_decimal
from ai_service.http.schemas import Figure
from ai_service.orchestrator.ports import FinanceResult, QueryPlan, Row

MAX_FIGURES = 20
MAX_ROWS_SHOWN = 8
MAX_TEXT_LABELS = 5
MAX_LABEL_CHARS = 80
HIDDEN_LABEL = "(dato oculto)"
_MONEY_RE = re.compile(
    r"(amount|total|subtotal|price|cost|igv|paid|payment|revenue|sales|income|expense|debit|credit|difference|"
    r"balance|importe|monto|precio|costo|venta|compra|gasto|pago|cobro|saldo)"
)
_QUANTITY_RE = re.compile(r"(count|quantity|qty|number|stock|units|cantidad|unidades|numero|capacity|orders?_count)")
_ID_RE = re.compile(r"(^id$|_id$)")
_COUNT_WORDS = frozenset({"count", "number", "cantidad", "numero"})
# Números que identifican (comprobante, serie, código, mesa): se muestran como texto, no como cifras.
_LABEL_NUMBER_RE = re.compile(r"(^number$|_number$|^code$|_code$|^series$|^serie$|^year$|^month$)")
# Columnas que tiene sentido sumar entre filas (no precios, costos unitarios ni promedios).
_ADDITIVE_RE = re.compile(r"(stock|quantity|qty|amount|total|subtotal|paid|count|units|cantidad|importe|monto)")
_NON_ADDITIVE_RE = re.compile(r"(price|precio|unit_|average|avg|promedio|rate|percent|ratio|cost)")


def _tokens(name: str) -> set[str]:
    return {t for t in re.split(r"[_\W]+", name.lower()) if t}


def _unit(column: str) -> str:
    name = column.lower()
    if _QUANTITY_RE.search(name):
        return "N"
    return "PEN" if _MONEY_RE.search(name) else "N"


def humanize(column: str) -> str:
    """``total_sales_amount`` → ``total sales amount`` (sin dígitos: va al Modelo 1 como significado)."""
    text = re.sub(r"[\d_]+", " ", column).strip()
    return text or "valor"


def _is_number(value: object) -> bool:
    return isinstance(value, (int, Decimal, float)) and not isinstance(value, bool)


def _text(value: object) -> str:
    if isinstance(value, datetime):
        text = value.strftime("%d/%m/%Y %H:%M")
    elif isinstance(value, date):
        text = value.strftime("%d/%m/%Y")
    elif isinstance(value, time):
        text = value.strftime("%H:%M")
    elif isinstance(value, bool):
        text = "sí" if value else "no"
    else:
        text = str(value).strip()
    return HIDDEN_LABEL if contains_sensitive(text) else text[:MAX_LABEL_CHARS]


def _number(value: object, unit: str) -> Decimal:
    try:
        number = to_decimal(value if not isinstance(value, float) else str(value))
    except InvalidAmountError:
        raise FinanceEngineError("Valor numérico no interpretable.") from None
    return round2(number) if unit == "PEN" else number


class FreeResultAdapter:
    def compute(self, plan: QueryPlan, rows: Sequence[Row]) -> FinanceResult:
        if plan.kind != "libre":
            raise FinanceEngineError("Cálculo no soportado.")
        if not rows or (len(rows) == 1 and all(v is None for v in rows[0].values())):
            return FinanceResult(no_data=True)  # sin filas, o un agregado sin filas que sumar (NULL)
        columns = [c for c in rows[0] if not _ID_RE.search(c.lower())]
        numeric = [c for c in columns if not _LABEL_NUMBER_RE.search(c.lower()) and any(_is_number(r.get(c)) for r in rows)
                   and all(r.get(c) is None or _is_number(r.get(c)) for r in rows)]
        textual = [c for c in columns if c not in numeric]
        # Primero las columnas que coinciden con las métricas pedidas (la cifra principal es la que se preguntó).
        wanted = set().union(*(_tokens(m) for m in (plan.solicitud or {}).get("metrics", []) or [""]))
        numeric.sort(key=lambda c: -len(_tokens(c) & wanted))
        if not numeric and not textual:
            raise FinanceEngineError("El resultado solo contiene identificadores.")
        figures: list[Figure] = []
        labels: dict[str, str] = {}
        meanings: dict[str, str] = {}
        text_labels: dict[str, str] = {}
        primary: list[str] = []
        notes: list[str] = []

        def add(value: Decimal, unit: str, label: str, origin: str, meaning: str | None = None) -> None:
            marker = f"c{len(figures) + 1}"
            figures.append(Figure(marcador=marker, valor=value, unidad=unit, origen=origin))  # type: ignore[arg-type]
            labels[marker] = label[:MAX_LABEL_CHARS]
            if meaning:
                meanings[marker] = meaning
                primary.append(marker)

        def text(value: str, meaning: str) -> None:
            marker = f"e{len(text_labels) + 1}"
            text_labels[marker] = value
            meanings[marker] = meaning

        def row_label(row: Row) -> str:
            return " · ".join(_text(row[c]) for c in textual if row.get(c) is not None) or "Fila"

        if len(rows) == 1:
            row = rows[0]
            # Cifras principales: las que mejor coinciden con las métricas pedidas ("order_count" frente a
            # "table_count"). Sin métricas y con textos ("¿qué período está abierto?"), la respuesta son los
            # textos y los importes del registro; los conteos no pedidos quedan solo en el detalle.
            best = max((len(_tokens(c) & wanted) for c in numeric), default=0)
            if wanted & _COUNT_WORDS and not any(_tokens(c) & _COUNT_WORDS for c in numeric):
                main = []  # se pidió un conteo y ninguna columna lo es ("¿hay caja abierta?"): cuenta el registro
            elif best:
                # En el orden de las métricas pedidas: para cada una, su columna (mismo nombre o la más parecida).
                main = []
                for metric in (plan.solicitud or {}).get("metrics", []) or []:
                    scored = [(c == metric, len(_tokens(c) & _tokens(metric)), c) for c in numeric if c not in main]
                    exact, overlap, column = max(scored, default=(False, 0, ""))
                    if exact or overlap:
                        main.append(column)
                main = main[:3]
            elif not wanted and textual:
                main = [c for c in numeric if _unit(c) == "PEN"][:3]
            else:
                main = numeric[:3]
            for column in [*main, *(c for c in numeric[:8] if c not in main)]:  # las pedidas primero
                if row.get(column) is not None:
                    unit = _unit(column)
                    add(_number(row[column], unit), unit, humanize(column).capitalize(), "executor",
                        meaning=humanize(column) if column in main else None)
            for column in textual[:MAX_TEXT_LABELS]:
                if row.get(column) is not None:
                    text(_text(row[column]), humanize(column))
            if not primary:  # solo texto (o números no pedidos): se cuenta el registro y se muestran sus valores
                add(Decimal(1), "N", "Registros devueltos", "motor", meaning="cantidad de registros")
        else:
            if (plan.solicitud or {}).get("intent") == "ranking" and numeric:
                # Ranking: la respuesta es el primer lugar (las filas vienen ordenadas por el SQL validado).
                column = numeric[0]
                if rows[0].get(column) is not None:
                    unit = _unit(column)
                    add(_number(rows[0][column], unit), unit, f"Primer lugar · {row_label(rows[0])} · {humanize(column)}",
                        "executor", meaning=f"{humanize(column)} del primer lugar")
                    text(row_label(rows[0]), "nombre del primer lugar")
            add(Decimal(len(rows)), "N", "Registros devueltos", "motor", meaning="cantidad de registros")
            for column in numeric:  # total entre filas solo de magnitudes sumables (stock, cantidades, importes)
                name = column.lower()
                if _ADDITIVE_RE.search(name) and not _NON_ADDITIVE_RE.search(name) and len(figures) < 3:
                    unit = _unit(column)
                    total = sum((_number(r[column], unit) for r in rows if r.get(column) is not None), Decimal("0"))
                    add(total, unit, f"Total · {humanize(column)}", "motor", meaning=f"total de {humanize(column)}")
            per_row = max(1, len(numeric))
            shown = min(len(rows), MAX_ROWS_SHOWN, (MAX_FIGURES - len(figures)) // per_row if numeric else 0)
            for index, row in enumerate(rows[:shown]):
                label = row_label(row)
                for column in numeric:
                    if row.get(column) is not None:
                        unit = _unit(column)
                        add(_number(row[column], unit), unit, f"{label} · {humanize(column)}", "executor",
                            meaning=f"{humanize(column)} del primer registro" if index == 0 and len(primary) < 2 else None)
            if textual:
                for row in rows[:MAX_TEXT_LABELS]:
                    text(row_label(row), "elemento de la lista")
            if not numeric and textual:
                listed = ", ".join(row_label(r) for r in rows[:MAX_ROWS_SHOWN])
                notes.append(f"Registros: {listed}"[:180])
            if numeric and shown < len(rows):
                notes.append(f"Se muestran {shown} de {len(rows)} filas.")
        return FinanceResult(figures=tuple(figures), labels=labels, primary=tuple(primary), meanings=meanings,
                             text_labels=text_labels, notes=tuple(notes))
