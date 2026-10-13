"""Resolución determinista de períodos (BR-10, FR-026).

Las fechas relativas se resuelven **en el backend** a partir de ``fecha_referencia_lima`` (la fecha
civil de ``America/Lima`` que envía el proxy), nunca con la fecha UTC del servidor ni por un
modelo. Solo se reconocen expresiones de mes completo; lo que no se reconoce devuelve ``None`` y el
pipeline pide aclaración. No se asume ninguna conversión de los límites UTC de los períodos
contables (pendiente de verificación según BR-10).
"""

from __future__ import annotations

import calendar
import re
from collections.abc import Iterable
from datetime import date

from ai_service.http.schemas import Period

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}
_MONTH_RE = re.compile(r"\b(" + "|".join(MONTHS) + r")\b(?:\s+(?:de|del)\s+((?:19|20)\d{2}))?", re.IGNORECASE)
_THIS_MONTH_RE = re.compile(r"\beste\s+mes\b", re.IGNORECASE)
_LAST_MONTH_RE = re.compile(r"\b(?:el\s+)?mes\s+(?:pasado|anterior)\b", re.IGNORECASE)


def month_period(year: int, month: int) -> Period:
    last_day = calendar.monthrange(year, month)[1]
    return Period(desde=date(year, month, 1), hasta=date(year, month, last_day))


def resolve_period(text: str, reference: date) -> Period | None:
    """Mes completo mencionado en ``text`` respecto de la fecha civil de Lima ``reference``."""
    if _THIS_MONTH_RE.search(text):
        return month_period(reference.year, reference.month)
    if _LAST_MONTH_RE.search(text):
        year, month = (reference.year, reference.month - 1) if reference.month > 1 else (reference.year - 1, 12)
        return month_period(year, month)
    match = _MONTH_RE.search(text)
    if match:
        month = MONTHS[match.group(1).lower()]
        if match.group(2):
            year = int(match.group(2))
        else:
            # Un mes posterior al de referencia se entiende como el del año anterior.
            year = reference.year if month <= reference.month else reference.year - 1
        return month_period(year, month)
    return None


def resolve_period_from(texts: Iterable[str], reference: date) -> Period | None:
    """Primer período reconocible en ``texts`` (en el orden dado)."""
    for text in texts:
        period = resolve_period(text, reference)
        if period is not None:
            return period
    return None
