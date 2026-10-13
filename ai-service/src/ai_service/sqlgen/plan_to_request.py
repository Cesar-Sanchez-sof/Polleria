"""``PlanToRequest``: ``QueryPlan`` → solicitud JSON del contrato 1.0 del entrenamiento.

Conversión **determinista**: solo usa la cuenta y el período ya revalidados por el backend. El texto
del usuario, el historial y el contexto nunca llegan al Modelo 2.

Contrato 1.0 (12 claves, serialización canónica del dataset: claves ordenadas, separadores
compactos, ``ensure_ascii=False``): ``comparison``, ``conditions``, ``dimensions``, ``domain``,
``filters``, ``group_by``, ``intent``, ``limit``, ``metrics``, ``order_by``, ``subject``, ``time``.

Campos que ``QueryPlan`` no representa y que se fijan por tipo de plan (no se infieren del modelo):

- ``saldo_cuenta`` usa el patrón entrenado "débito y crédito por cuenta y tipo de cuenta"
  (``aggregate`` / ``accounting_account`` / ``[accounting_account, account_type]``) más el filtro
  entrenado ``account_code eq``. Esa **combinación exacta** no aparece en el dataset v1.7 (cada parte
  sí): es una composición fuera de distribución que debe medirse en la primera inferencia real.
- ``time.concept`` = ``journal_entry_date`` y ``end_exclusive`` = día siguiente a ``hasta``, porque
  el período del plan es inclusivo y el contrato usa ``[start, end_exclusive)``.
- Sin ``conditions`` ni reglas sobre ``journal_entry.status``: el criterio de asientos anulados
  (P-4) sigue pendiente y no se inventa aquí.
"""

from __future__ import annotations

import json
import re
from datetime import timedelta
from typing import Any

from ai_service.orchestrator.ports import QueryPlan

REQUEST_KEYS: tuple[str, ...] = (
    "comparison",
    "conditions",
    "dimensions",
    "domain",
    "filters",
    "group_by",
    "intent",
    "limit",
    "metrics",
    "order_by",
    "subject",
    "time",
)
TIME_KEYS: tuple[str, ...] = ("concept", "end_exclusive", "grain", "start")
FILTER_KEYS: tuple[str, ...] = ("field", "operator", "value")
ACCOUNT_CODE_RE = re.compile(r"^[0-9]{1,10}$")

# Tablas del M-Schema por tipo de plan, en el orden de la variante de entrenamiento equivalente.
SCHEMA_TABLES: dict[str, tuple[str, ...]] = {
    "saldo_cuenta": ("accounting_account", "journal_entry", "journal_entry_detail"),
}
# Columnas mínimas que el rol debe tener para que la consulta sea resoluble. Si falta alguna, el
# Modelo 2 no se invoca (pedirle SQL sobre objetos que el rol no ve solo produciría un rechazo).
REQUIRED_OBJECTS: dict[str, dict[str, frozenset[str]]] = {
    "saldo_cuenta": {
        "accounting_account": frozenset({"id", "code", "type"}),
        "journal_entry": frozenset({"id", "entry_date"}),
        "journal_entry_detail": frozenset({"entry_id", "account_id", "debit", "credit"}),
    },
}


class UnsupportedPlan(ValueError):
    """El plan no tiene una conversión aprobada al contrato 1.0."""


def build_request(plan: QueryPlan) -> dict[str, Any]:
    if plan.kind != "saldo_cuenta":
        raise UnsupportedPlan("Tipo de plan sin conversión al contrato 1.0.")
    if not isinstance(plan.cuenta, str) or not ACCOUNT_CODE_RE.match(plan.cuenta):
        raise UnsupportedPlan("Código de cuenta no válido.")
    if plan.periodo.desde > plan.periodo.hasta:
        raise UnsupportedPlan("Período no válido.")
    return {
        "comparison": None,
        "conditions": [],
        "dimensions": ["accounting_account", "account_type"],
        "domain": "accounting",
        "filters": [{"field": "account_code", "operator": "eq", "value": plan.cuenta}],
        "group_by": ["accounting_account"],
        "intent": "aggregate",
        "limit": None,
        "metrics": ["total_debit", "total_credit"],
        "order_by": [],
        "subject": "accounting_account",
        "time": {
            "concept": "journal_entry_date",
            "end_exclusive": (plan.periodo.hasta + timedelta(days=1)).isoformat(),
            "grain": None,
            "start": plan.periodo.desde.isoformat(),
        },
    }


def serialize_request(request: dict[str, Any]) -> str:
    """Serialización idéntica a la del dataset (verificada en 1364 ejemplos de entrenamiento)."""
    if tuple(sorted(request)) != REQUEST_KEYS:
        raise UnsupportedPlan("La solicitud no tiene exactamente las claves del contrato 1.0.")
    return json.dumps(request, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def plan_to_request(plan: QueryPlan) -> str:
    return serialize_request(build_request(plan))
