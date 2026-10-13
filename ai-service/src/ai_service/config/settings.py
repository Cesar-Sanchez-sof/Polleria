"""Configuración del servicio HTTP de **desarrollo** con fallo seguro (T026).

Variables (solo se leen estas; nunca ``DATABASE_URL`` ni ``DATABASE_URL_READONLY``):

- ``AI_SERVICE_ENV``: debe ser exactamente ``development``. Cualquier otro valor se rechaza, porque
  el servicio solo dispone de componentes simulados.
- ``AI_SERVICE_HOST``: por defecto ``127.0.0.1``; **solo** se admite ``127.0.0.1``.
- ``AI_SERVICE_PORT``: por defecto ``8001``; entre 1024 y 65535.
- ``AI_SERVICE_INTERNAL_TOKEN``: credencial **provisional** entre el proxy del ERP y el servicio
  (P-9 pendiente). Hexadecimal de al menos 64 caracteres (32 bytes), generado con
  ``python -c "import secrets; print(secrets.token_hex(32))"``. Nunca se versiona.
- ``AI_ASSISTANT_AUDIT_HMAC_KEY``: clave de auditoría (B2); debe ser **distinta** del token.

Generador de SQL (Modelo 2, Fase 1):

- ``AI_SQL_GENERATOR``: ``simulado`` (por defecto) o ``xiyansql``. Selección explícita: si el
  servicio XiYanSQL no está disponible, la consulta responde ``503``; nunca se vuelve al simulado.
- Solo con ``xiyansql`` (obligatorias, salvo las que tienen valor por defecto):
  ``AI_SQLGEN_URL`` (exactamente ``http://127.0.0.1:<puerto>``, distinto del puerto de esta API),
  ``AI_SQLGEN_TOKEN`` (hexadecimal de al menos 32 bytes, independiente de las otras credenciales),
  ``AI_SQLGEN_TIMEOUT_S`` (1–300, por defecto 60) y ``AI_SQLGEN_ADAPTER`` (uno de los adaptadores
  conocidos; por defecto ``xiyansql_v17_json_v10_balanced_full``). Las rutas del adaptador y de la
  caché de Hugging Face solo las conoce el servicio de WSL, en tiempo de ejecución.

Executor de SQL:

- ``AI_SQL_EXECUTOR``: ``ficticio`` (por defecto) o ``postgres_readonly``. Activación **explícita**:
  ``DATABASE_URL_READONLY`` solo se lee con ``postgres_readonly`` (nunca se activa por encontrarla),
  y ese modo exige ``AI_SQL_GENERATOR=xiyansql``. La credencial debe ser de solo lectura.

Modelo 1 (interpretación y explicación):

- ``AI_LLM_PROVIDER``: ``simulado`` (por defecto) u ``openai``. Solo con ``openai``:
  ``OPENAI_API_KEY`` (del entorno o, si falta, del archivo ``ai-service/.env`` que indique el
  arranque; de ese archivo solo se leen ``OPENAI_API_KEY`` y ``OPENAI_MODEL``), ``OPENAI_MODEL``
  (por defecto ``gpt-6-luna``), ``AI_LLM_PRICE_INPUT_PER_1K_USD`` y
  ``AI_LLM_PRICE_OUTPUT_PER_1K_USD`` (obligatorios: el precio real no está confirmado, P-22),
  ``AI_LLM_MONTHLY_LIMIT_USD`` (por defecto 1.00, máximo 5.00), ``AI_LLM_MAX_COST_PER_REQUEST_USD``
  (por defecto 0.02: el peor caso de una consulta no puede superarlo), ``AI_LLM_TIMEOUT_S`` (1–60,
  por defecto 20) y ``AI_LLM_REASONING_EFFORT`` (opcional).

Ningún mensaje de error ni ``repr`` incluye valores de estas variables.

El token interno **no es autenticación real del ERP**: identifica al proxy, no a los usuarios. Los
roles y usuarios que viajan en CT-B siguen siendo simulados hasta resolver DE-1, DE-2 y P-9.
"""

from __future__ import annotations

import hmac
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

from ai_service.audit.masking import HMAC_KEY_ENV_VAR, AuditConfigError, load_hmac_key
from ai_service.sqlgen.profile import DEFAULT_ADAPTER, DEFAULT_MAX_NEW_TOKENS, KNOWN_ADAPTERS

ENV_VAR = "AI_SERVICE_ENV"
HOST_VAR = "AI_SERVICE_HOST"
PORT_VAR = "AI_SERVICE_PORT"
TOKEN_VAR = "AI_SERVICE_INTERNAL_TOKEN"
SQL_GENERATOR_VAR = "AI_SQL_GENERATOR"
SQLGEN_URL_VAR = "AI_SQLGEN_URL"
SQLGEN_TOKEN_VAR = "AI_SQLGEN_TOKEN"
SQLGEN_TIMEOUT_VAR = "AI_SQLGEN_TIMEOUT_S"
SQLGEN_ADAPTER_VAR = "AI_SQLGEN_ADAPTER"
SQL_EXECUTOR_VAR = "AI_SQL_EXECUTOR"
READONLY_DSN_VAR = "DATABASE_URL_READONLY"
LLM_PROVIDER_VAR = "AI_LLM_PROVIDER"
OPENAI_KEY_VAR = "OPENAI_API_KEY"
OPENAI_MODEL_VAR = "OPENAI_MODEL"
LLM_PRICE_IN_VAR = "AI_LLM_PRICE_INPUT_PER_1K_USD"
LLM_PRICE_OUT_VAR = "AI_LLM_PRICE_OUTPUT_PER_1K_USD"
LLM_MONTHLY_VAR = "AI_LLM_MONTHLY_LIMIT_USD"
LLM_MAX_REQUEST_COST_VAR = "AI_LLM_MAX_COST_PER_REQUEST_USD"
LLM_TIMEOUT_VAR = "AI_LLM_TIMEOUT_S"
LLM_REASONING_VAR = "AI_LLM_REASONING_EFFORT"
DOTENV_KEYS = frozenset({OPENAI_KEY_VAR, OPENAI_MODEL_VAR})

DEVELOPMENT = "development"
ALLOWED_HOST = "127.0.0.1"
DEFAULT_PORT = 8001
MIN_TOKEN_BYTES = 32
MAX_BODY_BYTES = 16 * 1024
SIMULATED_GENERATOR = "simulado"
XIYAN_GENERATOR = "xiyansql"
SQL_GENERATORS = frozenset({SIMULATED_GENERATOR, XIYAN_GENERATOR})
FIXTURE_EXECUTOR = "ficticio"
POSTGRES_EXECUTOR = "postgres_readonly"
SQL_EXECUTORS = frozenset({FIXTURE_EXECUTOR, POSTGRES_EXECUTOR})
_DSN_SCHEMES = ("postgresql://", "postgres://")
SIMULATED_LLM = "simulado"
OPENAI_LLM = "openai"
DEFAULT_OPENAI_MODEL = "gpt-6-luna"
MAX_MONTHLY_LIMIT_USD = Decimal("5.00")
# Límites de tokens del Modelo 1 real por tarea (entrada estimada y salida máxima), y margen para las
# instrucciones y el esquema, que la estimación de entrada del gateway no incluye.
LLM_MAX_INPUT_TOKENS = {"interpretar": 1500, "explicar": 600}
LLM_MAX_OUTPUT_TOKENS = {"interpretar": 300, "explicar": 400}
LLM_INSTRUCTION_ALLOWANCE_TOKENS = 600
_OPENAI_MODEL_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
_OPENAI_KEY_RE = re.compile(r"^sk-[A-Za-z0-9_-]{20,}$")
DEFAULT_SQLGEN_TIMEOUT_S = 60
_SQLGEN_URL_RE = re.compile(r"^http://127\.0\.0\.1:([0-9]{4,5})$")


class ServiceConfigError(Exception):
    """Configuración del servicio inválida o insegura. Nunca incluye valores secretos."""


@dataclass(frozen=True)
class SqlGenSettings:
    """Canal hacia el servicio de inferencia XiYanSQL (solo con ``AI_SQL_GENERATOR=xiyansql``)."""

    url: str
    token: str = field(repr=False)
    timeout_s: float = DEFAULT_SQLGEN_TIMEOUT_S
    adapter: str = DEFAULT_ADAPTER
    max_new_tokens: int = DEFAULT_MAX_NEW_TOKENS

    def __repr__(self) -> str:
        return (
            f"SqlGenSettings(url={self.url!r}, token='***', timeout_s={self.timeout_s}, "
            f"adapter={self.adapter!r}, max_new_tokens={self.max_new_tokens})"
        )


@dataclass(frozen=True)
class LlmSettings:
    """Modelo 1 real (solo con ``AI_LLM_PROVIDER=openai``). Precios en USD por 1000 tokens."""

    api_key: str = field(repr=False)
    model: str
    price_input_per_1k: Decimal
    price_output_per_1k: Decimal
    monthly_limit: Decimal
    max_cost_per_request: Decimal
    timeout_s: int
    reasoning_effort: str | None = None

    def __repr__(self) -> str:
        return (
            f"LlmSettings(api_key='***', model={self.model!r}, monthly_limit={self.monthly_limit}, "
            f"max_cost_per_request={self.max_cost_per_request}, timeout_s={self.timeout_s})"
        )

    def worst_case_request_cost(self) -> Decimal:
        """Coste máximo de una consulta (interpretar + explicar) con los límites de tokens."""
        total = Decimal("0")
        for task in LLM_MAX_INPUT_TOKENS:
            input_tokens = LLM_MAX_INPUT_TOKENS[task] + LLM_INSTRUCTION_ALLOWANCE_TOKENS
            total += (
                Decimal(input_tokens) * self.price_input_per_1k
                + Decimal(LLM_MAX_OUTPUT_TOKENS[task]) * self.price_output_per_1k
            ) / Decimal(1000)
        return total


@dataclass(frozen=True)
class ServiceSettings:
    environment: str
    host: str
    port: int
    internal_token: str = field(repr=False)
    audit_hmac_key: bytes = field(repr=False)
    max_body_bytes: int = MAX_BODY_BYTES
    sql_generator: str = SIMULATED_GENERATOR
    sqlgen: SqlGenSettings | None = None
    sql_executor: str = FIXTURE_EXECUTOR
    readonly_dsn: str | None = field(default=None, repr=False)
    llm_provider: str = SIMULATED_LLM
    llm: LlmSettings | None = None

    def __repr__(self) -> str:
        return (
            f"ServiceSettings(environment={self.environment!r}, host={self.host!r}, port={self.port}, "
            f"internal_token='***', audit_hmac_key='***', max_body_bytes={self.max_body_bytes}, "
            f"sql_generator={self.sql_generator!r}, sqlgen={self.sqlgen!r}, "
            f"sql_executor={self.sql_executor!r}, readonly_dsn={'***' if self.readonly_dsn else None}, "
            f"llm_provider={self.llm_provider!r}, llm={self.llm!r})"
        )

    def token_matches(self, provided: str | None) -> bool:
        """Comparación en tiempo constante del token interno."""
        if not provided:
            return False
        return hmac.compare_digest(provided.encode("utf-8"), self.internal_token.encode("utf-8"))


def _read(env: Mapping[str, str], name: str, default: str = "") -> str:
    value = env.get(name, default)
    return value.strip() if isinstance(value, str) else ""


def read_dotenv_keys(path: Path, keys: frozenset[str] = DOTENV_KEYS) -> dict[str, str]:
    """Lee **solo** ``keys`` de un archivo ``.env`` (``CLAVE=valor``); ignora todo lo demás.

    Nunca devuelve ni registra otras variables y no modifica ``os.environ``.
    """
    values: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return values
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.removeprefix("export ").strip()
        if name in keys:
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[name] = value
    return values


def load_service_settings(env: Mapping[str, str], *, dotenv_path: Path | None = None) -> ServiceSettings:
    """Valida la configuración leyendo solo las variables del módulo; falla de forma segura.

    ``dotenv_path`` (opcional) solo se consulta con ``AI_LLM_PROVIDER=openai`` y solo para
    ``OPENAI_API_KEY`` y ``OPENAI_MODEL``; las variables del entorno tienen prioridad.
    """
    environment = _read(env, ENV_VAR)
    if environment != DEVELOPMENT:
        raise ServiceConfigError(
            f"{ENV_VAR} debe ser '{DEVELOPMENT}': el servicio solo dispone de componentes simulados."
        )

    host = _read(env, HOST_VAR, ALLOWED_HOST)
    if host != ALLOWED_HOST:
        raise ServiceConfigError(f"El servicio de desarrollo solo puede escuchar en {ALLOWED_HOST}.")

    port_text = _read(env, PORT_VAR, str(DEFAULT_PORT))
    if not port_text.isdigit() or not 1024 <= int(port_text) <= 65535:
        raise ServiceConfigError(f"{PORT_VAR} debe ser un número de puerto entre 1024 y 65535.")

    token = _read(env, TOKEN_VAR)
    if not token:
        raise ServiceConfigError(f"Falta {TOKEN_VAR}; el servicio no arranca sin credencial interna.")
    try:
        token_bytes = bytes.fromhex(token)
    except ValueError as exc:
        raise ServiceConfigError(f"{TOKEN_VAR} debe ser hexadecimal.") from exc
    if len(token_bytes) < MIN_TOKEN_BYTES:
        raise ServiceConfigError(f"{TOKEN_VAR} debe tener al menos {MIN_TOKEN_BYTES} bytes.")

    try:
        audit_key = load_hmac_key(env)
    except AuditConfigError as exc:
        raise ServiceConfigError(f"Configuración de auditoría inválida ({HMAC_KEY_ENV_VAR}).") from exc
    if hmac.compare_digest(audit_key, token_bytes):
        raise ServiceConfigError(f"{TOKEN_VAR} y {HMAC_KEY_ENV_VAR} deben ser independientes.")

    generator = _read(env, SQL_GENERATOR_VAR, SIMULATED_GENERATOR)
    if generator not in SQL_GENERATORS:
        raise ServiceConfigError(f"{SQL_GENERATOR_VAR} debe ser '{SIMULATED_GENERATOR}' o '{XIYAN_GENERATOR}'.")
    sqlgen = (
        _load_sqlgen_settings(env, service_port=int(port_text), other_secrets=(token_bytes, audit_key))
        if generator == XIYAN_GENERATOR
        else None
    )

    executor = _read(env, SQL_EXECUTOR_VAR, FIXTURE_EXECUTOR)
    if executor not in SQL_EXECUTORS:
        raise ServiceConfigError(f"{SQL_EXECUTOR_VAR} debe ser '{FIXTURE_EXECUTOR}' o '{POSTGRES_EXECUTOR}'.")
    readonly_dsn = None
    if executor == POSTGRES_EXECUTOR:
        if generator != XIYAN_GENERATOR:
            raise ServiceConfigError(f"{SQL_EXECUTOR_VAR}={POSTGRES_EXECUTOR} requiere {SQL_GENERATOR_VAR}={XIYAN_GENERATOR}.")
        readonly_dsn = _read(env, READONLY_DSN_VAR)  # solo se lee con activación explícita
        if not readonly_dsn.startswith(_DSN_SCHEMES):
            raise ServiceConfigError(f"{READONLY_DSN_VAR} falta o no es una conexión PostgreSQL válida.")

    llm_provider = _read(env, LLM_PROVIDER_VAR, SIMULATED_LLM)
    if llm_provider not in (SIMULATED_LLM, OPENAI_LLM):
        raise ServiceConfigError(f"{LLM_PROVIDER_VAR} debe ser '{SIMULATED_LLM}' u '{OPENAI_LLM}'.")
    llm = _load_llm_settings(env, dotenv_path) if llm_provider == OPENAI_LLM else None

    return ServiceSettings(
        environment=environment,
        host=host,
        port=int(port_text),
        internal_token=token,
        audit_hmac_key=audit_key,
        sql_generator=generator,
        sqlgen=sqlgen,
        sql_executor=executor,
        readonly_dsn=readonly_dsn,
        llm_provider=llm_provider,
        llm=llm,
    )


def _decimal(env: Mapping[str, str], name: str, default: str | None = None) -> Decimal:
    text = _read(env, name, default or "")
    try:
        value = Decimal(text)
    except (InvalidOperation, ValueError):
        raise ServiceConfigError(f"{name} es obligatorio y debe ser un número decimal.") from None
    if not value.is_finite() or value < 0:
        raise ServiceConfigError(f"{name} debe ser un número no negativo.")
    return value


def _load_llm_settings(env: Mapping[str, str], dotenv_path: Path | None) -> LlmSettings:
    from_file = read_dotenv_keys(dotenv_path) if dotenv_path is not None else {}
    api_key = _read(env, OPENAI_KEY_VAR) or from_file.get(OPENAI_KEY_VAR, "").strip()
    if not _OPENAI_KEY_RE.match(api_key):
        raise ServiceConfigError(f"Falta {OPENAI_KEY_VAR} o no tiene un formato válido.")
    model = _read(env, OPENAI_MODEL_VAR) or from_file.get(OPENAI_MODEL_VAR, "").strip() or DEFAULT_OPENAI_MODEL
    if not _OPENAI_MODEL_RE.match(model):
        raise ServiceConfigError(f"{OPENAI_MODEL_VAR} no es un identificador de modelo válido.")

    price_in = _decimal(env, LLM_PRICE_IN_VAR)
    price_out = _decimal(env, LLM_PRICE_OUT_VAR)
    monthly = _decimal(env, LLM_MONTHLY_VAR, "1.00")
    if not Decimal("0") < monthly <= MAX_MONTHLY_LIMIT_USD:
        raise ServiceConfigError(f"{LLM_MONTHLY_VAR} debe estar entre 0 y {MAX_MONTHLY_LIMIT_USD}.")
    max_request = _decimal(env, LLM_MAX_REQUEST_COST_VAR, "0.02")
    timeout_text = _read(env, LLM_TIMEOUT_VAR, "20")
    if not timeout_text.isdigit() or not 1 <= int(timeout_text) <= 60:
        raise ServiceConfigError(f"{LLM_TIMEOUT_VAR} debe ser un número de segundos entre 1 y 60.")
    effort = _read(env, LLM_REASONING_VAR) or None
    if effort is not None and effort not in ("minimal", "low", "medium", "high"):
        raise ServiceConfigError(f"{LLM_REASONING_VAR} no es válido.")

    settings = LlmSettings(
        api_key=api_key,
        model=model,
        price_input_per_1k=price_in,
        price_output_per_1k=price_out,
        monthly_limit=monthly,
        max_cost_per_request=max_request,
        timeout_s=int(timeout_text),
        reasoning_effort=effort,
    )
    if settings.worst_case_request_cost() > max_request:
        raise ServiceConfigError(
            f"El coste máximo por consulta supera {LLM_MAX_REQUEST_COST_VAR}; reduce precios o tokens."
        )
    return settings


def _load_sqlgen_settings(
    env: Mapping[str, str], *, service_port: int, other_secrets: tuple[bytes, ...]
) -> SqlGenSettings:
    url = _read(env, SQLGEN_URL_VAR)
    match = _SQLGEN_URL_RE.match(url)
    if not match or not 1024 <= int(match.group(1)) <= 65535:
        raise ServiceConfigError(f"{SQLGEN_URL_VAR} debe ser exactamente http://127.0.0.1:<puerto 1024-65535>.")
    if int(match.group(1)) == service_port:
        raise ServiceConfigError(f"{SQLGEN_URL_VAR} no puede usar el puerto de esta API.")

    token = _read(env, SQLGEN_TOKEN_VAR)
    if not token:
        raise ServiceConfigError(f"Falta {SQLGEN_TOKEN_VAR}; el generador XiYanSQL no se habilita sin credencial.")
    try:
        token_bytes = bytes.fromhex(token)
    except ValueError as exc:
        raise ServiceConfigError(f"{SQLGEN_TOKEN_VAR} debe ser hexadecimal.") from exc
    if len(token_bytes) < MIN_TOKEN_BYTES:
        raise ServiceConfigError(f"{SQLGEN_TOKEN_VAR} debe tener al menos {MIN_TOKEN_BYTES} bytes.")
    if any(hmac.compare_digest(token_bytes, secret) for secret in other_secrets):
        raise ServiceConfigError(f"{SQLGEN_TOKEN_VAR} debe ser independiente de las demás credenciales.")

    timeout_text = _read(env, SQLGEN_TIMEOUT_VAR, str(DEFAULT_SQLGEN_TIMEOUT_S))
    if not timeout_text.isdigit() or not 1 <= int(timeout_text) <= 300:
        raise ServiceConfigError(f"{SQLGEN_TIMEOUT_VAR} debe ser un número de segundos entre 1 y 300.")

    adapter = _read(env, SQLGEN_ADAPTER_VAR, DEFAULT_ADAPTER)
    if adapter not in KNOWN_ADAPTERS:
        raise ServiceConfigError(f"{SQLGEN_ADAPTER_VAR} no es un adaptador conocido.")

    return SqlGenSettings(url=url, token=token, timeout_s=float(timeout_text), adapter=adapter)
