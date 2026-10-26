"""Resolución determinista de períodos (BR-10, FR-026).

Las fechas relativas se resuelven **en el backend** a partir de ``fecha_referencia_lima`` (la fecha
civil de ``America/Lima`` que envía el proxy), nunca con la fecha UTC del servidor ni por un
modelo. Se reconocen, en este orden: rangos ``del dd/mm/aaaa al dd/mm/aaaa`` y fechas sueltas,
"ayer", "hoy", "esta semana" / "la semana pasada", "últimos N días", "este mes" / "el mes pasado" /
"el último mes", "este año" / "el año pasado" y nombres de mes. Lo que no se reconoce devuelve
``None`` (el pipeline pide aclaración o aplica el período por defecto de la familia). No se asume
ninguna conversión de los límites UTC de los períodos contables (pendiente de verificación según
BR-10).
"""

from __future__ import annotations

import calendar
import re
from collections.abc import Iterable
from datetime import date, timedelta

from ai_service.http.schemas import Period

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}
MAX_LAST_DAYS = 366
_MONTH_RE = re.compile(r"\b(" + "|".join(MONTHS) + r")\b(?:\s+(?:de|del)\s+((?:19|20)\d{2}))?", re.IGNORECASE)
_THIS_MONTH_RE = re.compile(r"\beste\s+mes\b", re.IGNORECASE)
_LAST_MONTH_RE = re.compile(r"\b(?:el\s+)?(?:mes\s+(?:pasado|anterior)|[uú]ltimo\s+mes)\b", re.IGNORECASE)
_DATE = r"(\d{1,2})/(\d{1,2})/((?:19|20)\d{2})"
_RANGE_RE = re.compile(rf"\b(?:del?|desde)\s+(?:el\s+)?{_DATE}\s+(?:al|hasta(?:\s+el)?)\s+{_DATE}", re.IGNORECASE)
_SINGLE_DATE_RE = re.compile(rf"\b{_DATE}\b")
_YESTERDAY_RE = re.compile(r"\bayer\b", re.IGNORECASE)
_TODAY_RE = re.compile(r"\bhoy\b", re.IGNORECASE)
_THIS_WEEK_RE = re.compile(r"\besta\s+semana\b", re.IGNORECASE)
_LAST_WEEK_RE = re.compile(r"\b(?:la\s+)?semana\s+(?:pasada|anterior)\b|\b[uú]ltima\s+semana\b", re.IGNORECASE)
_LAST_DAYS_RE = re.compile(r"\b[uú]ltimos\s+(\d{1,3})\s+d[ií]as\b", re.IGNORECASE)
_THIS_YEAR_RE = re.compile(r"\beste\s+año\b|\ben\s+lo\s+que\s+va\s+del\s+año\b", re.IGNORECASE)
_LAST_YEAR_RE = re.compile(r"\b(?:el\s+)?año\s+(?:pasado|anterior)\b", re.IGNORECASE)


def month_period(year: int, month: int) -> Period:
    last_day = calendar.monthrange(year, month)[1]
    return Period(desde=date(year, month, 1), hasta=date(year, month, last_day))


def _date(day: str, month: str, year: str) -> date | None:
    try:
        return date(int(year), int(month), int(day))
    except ValueError:
        return None


def _month_from_match(match: re.Match[str], reference: date) -> Period:
    month = MONTHS[match.group(1).lower()]
    if match.group(2):
        year = int(match.group(2))
    else:
        # Un mes posterior al de referencia se entiende como el del año anterior.
        year = reference.year if month <= reference.month else reference.year - 1
    return month_period(year, month)


def resolve_period(text: str, reference: date) -> Period | None:
    """Período mencionado en ``text`` respecto de la fecha civil de Lima ``reference``."""
    if match := _RANGE_RE.search(text):
        start, end = _date(*match.groups()[:3]), _date(*match.groups()[3:])
        if start and end and start <= end:
            return Period(desde=start, hasta=end)
        return None
    if match := _SINGLE_DATE_RE.search(text):
        day = _date(*match.groups())
        return Period(desde=day, hasta=day) if day else None
    if _YESTERDAY_RE.search(text):
        day = reference - timedelta(days=1)
        return Period(desde=day, hasta=day)
    if _TODAY_RE.search(text):
        return Period(desde=reference, hasta=reference)
    if _THIS_WEEK_RE.search(text):
        return Period(desde=reference - timedelta(days=reference.weekday()), hasta=reference)
    if _LAST_WEEK_RE.search(text):
        monday = reference - timedelta(days=reference.weekday() + 7)
        return Period(desde=monday, hasta=monday + timedelta(days=6))
    if match := _LAST_DAYS_RE.search(text):
        days = int(match.group(1))
        if 1 <= days <= MAX_LAST_DAYS:
            return Period(desde=reference - timedelta(days=days - 1), hasta=reference)
        return None
    if _THIS_MONTH_RE.search(text):
        return month_period(reference.year, reference.month)
    if _LAST_MONTH_RE.search(text):
        year, month = (reference.year, reference.month - 1) if reference.month > 1 else (reference.year - 1, 12)
        return month_period(year, month)
    if _THIS_YEAR_RE.search(text):
        return Period(desde=date(reference.year, 1, 1), hasta=reference)
    if _LAST_YEAR_RE.search(text):
        return Period(desde=date(reference.year - 1, 1, 1), hasta=date(reference.year - 1, 12, 31))
    match = _MONTH_RE.search(text)
    if match:
        return _month_from_match(match, reference)
    return None


def resolve_months(text: str, reference: date, limit: int = 2) -> list[Period]:
    """Meses distintos mencionados en orden (para comparar períodos, p. ej. "agosto y septiembre")."""
    periods: list[Period] = []
    for match in _MONTH_RE.finditer(text):
        period = _month_from_match(match, reference)
        if period not in periods:
            periods.append(period)
        if len(periods) == limit:
            break
    return periods


MONTH_NAMES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def period_text(period: Period) -> str:
    """"septiembre de 2026" (mes completo), "el 14/09/2026" (un día) o "del 01/09/2026 al 15/09/2026"."""
    desde, hasta = period.desde, period.hasta
    if desde == hasta:
        return f"el {desde:%d/%m/%Y}"
    if desde.day == 1 and hasta == month_period(desde.year, desde.month).hasta:
        return f"{MONTH_NAMES[desde.month - 1]} de {desde.year}"
    return f"del {desde:%d/%m/%Y} al {hasta:%d/%m/%Y}"


def month_to_date(reference: date) -> Period:
    """Período por defecto de las familias sin período explícito: del 1 del mes a la fecha de referencia."""
    return Period(desde=reference.replace(day=1), hasta=reference)


HISTORY_START = date(2000, 1, 1)


def full_history(reference: date) -> Period:
    """Período por defecto cuando la pregunta abarca todo el historial ("en total", rankings generales)."""
    return Period(desde=HISTORY_START, hasta=reference)


def default_period_text(period: Period) -> str:
    return "todo el historial registrado" if period.desde == HISTORY_START else period_text(period)


def resolve_period_from(texts: Iterable[str], reference: date) -> Period | None:
    """Primer período reconocible en ``texts`` (en el orden dado)."""
    for text in texts:
        period = resolve_period(text, reference)
        if period is not None:
            return period
    return None
