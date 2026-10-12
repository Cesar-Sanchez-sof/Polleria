"""Control de consumo del Modelo 1 (T007, D-13 parcialmente aprobada, D-14, SC-018).

Antes de **cada** llamada facturable al proveedor del Modelo 1 se debe pedir autorización a
:class:`BudgetGuard`. Si se deniega, **no se hace la llamada** y el orquestador responde con el
``503`` controlado de la spec, sin detalles económicos.

Controles implementados:

- **Presupuesto mensual**: gasto registrado del mes + reservas pendientes + coste máximo de la
  llamada (tokens de entrada + máximo de salida) no puede superar el límite.
- **Verificación externa con fallo seguro**: si la política exige verificar el saldo restante con
  un mecanismo del proveedor (límite de gasto, saldo prepago o equivalente) y ese mecanismo no
  existe, falla o no responde, la llamada se deniega. **No se presupone** que el proveedor ofrezca
  un límite estricto (R-04).
- **Límites por solicitud**: una llamada por tarea y consulta, un máximo de llamadas por consulta,
  un máximo de reintentos por tarea y límites de tokens de entrada y salida por tarea.
- **Registro de uso** sin prompts ni respuestas (SEC-8): solo metadatos y coste estimado.

ADVERTENCIA: el contador de este módulo vive **en memoria**. Se pierde si el proceso se reinicia o
el servicio gratuito se suspende, así que **no es un límite económico garantizado para
producción**. La persistencia y la estrategia definitiva están pendientes (R-06, P-22). En B1 solo
se usa con consumos y precios simulados.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field, fields
from datetime import datetime
from decimal import Decimal
from types import MappingProxyType

from ai_service.finance.money import AmountInput, to_decimal

TASKS: frozenset[str] = frozenset({"interpretar", "explicar"})
THOUSAND = Decimal("1000")

SERVICE_UNAVAILABLE_STATUS = 503
SERVICE_UNAVAILABLE_MESSAGE = (
    "El asistente no está disponible en este momento. Intenta más tarde."
)

REASON_EXHAUSTED = "budget_exhausted"
REASON_UNVERIFIABLE = "budget_unverifiable"
REASON_REQUEST_LIMIT = "request_limit"


class BudgetDenied(Exception):
    """La llamada facturable se denegó; no debe realizarse.

    ``reason`` es un código interno para registros técnicos. Al usuario solo se le muestra
    :data:`SERVICE_UNAVAILABLE_MESSAGE` con estado ``503``, sin importes ni detalles económicos.
    """

    http_status = SERVICE_UNAVAILABLE_STATUS
    public_message = SERVICE_UNAVAILABLE_MESSAGE

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class BudgetUnavailable(BudgetDenied):
    """Presupuesto agotado o imposible de verificar."""


class RequestLimitExceeded(BudgetDenied):
    """Se superó un límite de llamadas, reintentos o tokens de la consulta."""

    def __init__(self) -> None:
        super().__init__(REASON_REQUEST_LIMIT)


@dataclass(frozen=True)
class ModelPrice:
    """Precio por cada 1000 tokens. En B1 solo se usan valores simulados."""

    input_per_1k: Decimal
    output_per_1k: Decimal

    def __post_init__(self) -> None:
        object.__setattr__(self, "input_per_1k", to_decimal(self.input_per_1k))
        object.__setattr__(self, "output_per_1k", to_decimal(self.output_per_1k))
        if self.input_per_1k < 0 or self.output_per_1k < 0:
            raise ValueError("Los precios no pueden ser negativos.")

    def cost(self, input_tokens: int, output_tokens: int) -> Decimal:
        return (
            Decimal(input_tokens) * self.input_per_1k + Decimal(output_tokens) * self.output_per_1k
        ) / THOUSAND


@dataclass(frozen=True)
class BudgetPolicy:
    """Política de consumo. Los valores concretos dependen de P-22 y P-11."""

    monthly_limit: Decimal
    max_input_tokens: Mapping[str, int]
    max_output_tokens: Mapping[str, int]
    max_calls_per_request: int = 2
    max_retries_per_task: int = 1
    require_external_verification: bool = True

    def __post_init__(self) -> None:
        object.__setattr__(self, "monthly_limit", to_decimal(self.monthly_limit))
        if self.monthly_limit < 0:
            raise ValueError("El límite mensual no puede ser negativo.")
        for name in ("max_input_tokens", "max_output_tokens"):
            limits = dict(getattr(self, name))
            if set(limits) != TASKS or any(v < 0 for v in limits.values()):
                raise ValueError(f"{name} debe definir un límite no negativo para cada tarea.")
            object.__setattr__(self, name, MappingProxyType(limits))
        if self.max_calls_per_request < 0 or self.max_retries_per_task < 0:
            raise ValueError("Los límites de llamadas y reintentos no pueden ser negativos.")


@dataclass(frozen=True)
class CallRequest:
    """Solicitud de autorización para una llamada facturable."""

    trace_id: str
    task: str
    model: str
    input_tokens: int
    is_retry: bool = False


@dataclass(frozen=True)
class Authorization:
    """Autorización concedida para una única llamada."""

    trace_id: str
    task: str
    model: str
    max_output_tokens: int
    reserved_cost: Decimal


@dataclass(frozen=True)
class UsageRecord:
    """Registro de uso. Por diseño no tiene campos para prompts ni respuestas (SEC-8)."""

    trace_id: str
    task: str
    model: str
    model_version: str
    input_tokens: int
    output_tokens: int
    estimated_cost: Decimal
    latency_ms: int
    outcome: str
    recorded_at: datetime


USAGE_RECORD_FIELDS: frozenset[str] = frozenset(f.name for f in fields(UsageRecord))


class UsageLog:
    """Registro de consumo en memoria (solo para simulación; ver advertencia del módulo)."""

    def __init__(self) -> None:
        self._records: list[UsageRecord] = []

    def append(self, record: UsageRecord) -> None:
        self._records.append(record)

    def records(self) -> tuple[UsageRecord, ...]:
        return tuple(self._records)

    def spent_in_month(self, year: int, month: int) -> Decimal:
        return sum(
            (
                r.estimated_cost
                for r in self._records
                if r.recorded_at.year == year and r.recorded_at.month == month
            ),
            Decimal("0"),
        )


RemainingBudgetVerifier = Callable[[], AmountInput | None]


@dataclass
class _RequestState:
    calls: int = 0
    tasks_called: set[str] = field(default_factory=set)
    retries: dict[str, int] = field(default_factory=dict)


class BudgetGuard:
    """Autoriza o deniega cada llamada facturable al Modelo 1."""

    def __init__(
        self,
        policy: BudgetPolicy,
        pricing: Mapping[str, ModelPrice],
        usage_log: UsageLog,
        clock: Callable[[], datetime],
        remaining_verifier: RemainingBudgetVerifier | None = None,
    ) -> None:
        self._policy = policy
        self._pricing = dict(pricing)
        self._usage = usage_log
        self._clock = clock
        self._verifier = remaining_verifier
        self._pending = Decimal("0")
        self._requests: dict[str, _RequestState] = {}

    @property
    def pending_reservations(self) -> Decimal:
        return self._pending

    def authorize(self, request: CallRequest) -> Authorization:
        """Concede una autorización o lanza :class:`BudgetDenied`. Nunca llama al proveedor."""
        if request.task not in TASKS:
            raise ValueError(f"Tarea desconocida: {request.task!r}.")
        if request.input_tokens < 0:
            raise ValueError("input_tokens no puede ser negativo.")

        state = self._requests.get(request.trace_id, _RequestState())
        self._check_request_limits(request, state)

        price = self._pricing.get(request.model)
        if price is None:
            # Sin precio conocido no se puede estimar el coste: fallo seguro.
            raise BudgetUnavailable(REASON_UNVERIFIABLE)

        max_output = self._policy.max_output_tokens[request.task]
        worst_case = price.cost(request.input_tokens, max_output)

        now = self._clock()
        spent = self._usage.spent_in_month(now.year, now.month)
        if spent + self._pending + worst_case > self._policy.monthly_limit:
            raise BudgetUnavailable(REASON_EXHAUSTED)

        self._check_external_remaining(worst_case)

        if request.is_retry:
            state.retries[request.task] = state.retries.get(request.task, 0) + 1
        else:
            state.calls += 1
            state.tasks_called.add(request.task)
        self._requests[request.trace_id] = state
        self._pending += worst_case
        return Authorization(
            trace_id=request.trace_id,
            task=request.task,
            model=request.model,
            max_output_tokens=max_output,
            reserved_cost=worst_case,
        )

    def record(
        self,
        authorization: Authorization,
        *,
        model_version: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: int,
        outcome: str,
    ) -> UsageRecord:
        """Registra el consumo real de una llamada autorizada y libera su reserva."""
        price = self._pricing[authorization.model]
        record = UsageRecord(
            trace_id=authorization.trace_id,
            task=authorization.task,
            model=authorization.model,
            model_version=model_version,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=price.cost(input_tokens, output_tokens),
            latency_ms=latency_ms,
            outcome=outcome,
            recorded_at=self._clock(),
        )
        self._release(authorization)
        self._usage.append(record)
        return record

    def cancel(self, authorization: Authorization) -> None:
        """Libera la reserva de una autorización cuya llamada no llegó a hacerse."""
        self._release(authorization)

    def _release(self, authorization: Authorization) -> None:
        self._pending = max(Decimal("0"), self._pending - authorization.reserved_cost)

    def _check_request_limits(self, request: CallRequest, state: _RequestState) -> None:
        if request.input_tokens > self._policy.max_input_tokens[request.task]:
            raise RequestLimitExceeded()
        if request.is_retry:
            if request.task not in state.tasks_called:
                raise RequestLimitExceeded()
            if state.retries.get(request.task, 0) >= self._policy.max_retries_per_task:
                raise RequestLimitExceeded()
        else:
            if request.task in state.tasks_called:
                raise RequestLimitExceeded()
            if state.calls >= self._policy.max_calls_per_request:
                raise RequestLimitExceeded()

    def _check_external_remaining(self, worst_case: Decimal) -> None:
        if self._verifier is None:
            if self._policy.require_external_verification:
                raise BudgetUnavailable(REASON_UNVERIFIABLE)
            return
        try:
            remaining = self._verifier()
        except Exception as exc:  # cualquier fallo del mecanismo externo → fallo seguro
            raise BudgetUnavailable(REASON_UNVERIFIABLE) from exc
        if remaining is None:
            raise BudgetUnavailable(REASON_UNVERIFIABLE)
        try:
            remaining_amount = to_decimal(remaining)
        except ValueError as exc:
            raise BudgetUnavailable(REASON_UNVERIFIABLE) from exc
        if worst_case > remaining_amount:
            raise BudgetUnavailable(REASON_EXHAUSTED)
