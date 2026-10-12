"""Inserción determinista de cifras verificadas en la explicación (T023, FR-020, BR-2).

El Modelo 1 (o su sustituto) solo escribe **marcadores** como ``{{c1}}``. Este módulo:

1. Valida que todos los marcadores existan entre las cifras autorizadas de la consulta
   (producidas por el SQL Executor o el motor financiero) y que **todas** las cifras se usen.
2. Rechaza cualquier cantidad no verificada fuera de los marcadores: dígitos, símbolos de moneda o
   de porcentaje. Solo se permiten años (``2026``) y fechas completas (``30/09/2026``).
3. Sustituye cada marcador por el valor formateado (``S/ 1,234.56`` o ``12.35 %``).

Cualquier incumplimiento lanza :class:`MarkerValidationError`: la explicación se descarta y el
pipeline responde con un error controlado. El modelo nunca puede modificar una cifra.
"""

from __future__ import annotations

import re
from collections.abc import Sequence

from ai_service.finance.money import format_pen, format_percent
from ai_service.http.schemas import Figure

UNKNOWN_MARKER = "UNKNOWN_MARKER"
UNUSED_FIGURE = "UNUSED_FIGURE"
MALFORMED_MARKER = "MALFORMED_MARKER"
UNVERIFIED_QUANTITY = "UNVERIFIED_QUANTITY"
DUPLICATE_FIGURE = "DUPLICATE_FIGURE"

_MARKER_RE = re.compile(r"\{\{\s*([^{}]*?)\s*\}\}")
_MARKER_ID_RE = re.compile(r"^c[0-9]{1,3}$")
_ALLOWED_NUMERIC_RE = re.compile(r"\b\d{2}/\d{2}/(?:19|20)\d{2}\b|\b(?:19|20)\d{2}\b")
_QUANTITY_RE = re.compile(r"\d|S/|US\$|\$|%|€")


class MarkerValidationError(ValueError):
    """La explicación no es segura; ``code`` indica el motivo (para auditoría)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _format(figure: Figure) -> str:
    return format_pen(figure.valor) if figure.unidad == "PEN" else format_percent(figure.valor)


def render_verified(text: str, figures: Sequence[Figure]) -> str:
    """Devuelve el texto final con las cifras autorizadas insertadas, o lanza un error."""
    by_marker: dict[str, Figure] = {}
    for figure in figures:
        if figure.marcador in by_marker:
            raise MarkerValidationError(DUPLICATE_FIGURE)
        by_marker[figure.marcador] = figure

    if text.count("{{") != text.count("}}"):
        raise MarkerValidationError(MALFORMED_MARKER)

    used: set[str] = set()
    for raw in _MARKER_RE.findall(text):
        if not _MARKER_ID_RE.match(raw):
            raise MarkerValidationError(MALFORMED_MARKER)
        if raw not in by_marker:
            raise MarkerValidationError(UNKNOWN_MARKER)
        used.add(raw)
    if used != set(by_marker):
        raise MarkerValidationError(UNUSED_FIGURE)

    outside = _MARKER_RE.sub(" ", text)
    if "{" in outside or "}" in outside:
        raise MarkerValidationError(MALFORMED_MARKER)
    if _QUANTITY_RE.search(_ALLOWED_NUMERIC_RE.sub(" ", outside)):
        raise MarkerValidationError(UNVERIFIED_QUANTITY)

    return _MARKER_RE.sub(lambda m: _format(by_marker[m.group(1)]), text)
