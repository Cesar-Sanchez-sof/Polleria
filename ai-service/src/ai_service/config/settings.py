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

Modo evaluación académica (``AI_SERVICE_EVAL_MODE=1``; el ERP en un Preview de Vercel llega por un
túnel HTTPS temporal a este servicio, que sigue escuchando solo en ``127.0.0.1``):

- Exige los modelos reales y el RAG remoto: ``AI_SQL_GENERATOR=xiyansql``, ``AI_LLM_PROVIDER=openai``
  y ``AI_RAG_MODE=milvus``.
- Exige ``AI_SQL_EXECUTOR=ficticio`` (explícito): con ``postgres_readonly`` no arranca, y tampoco si
  ``DATABASE_URL_READONLY`` está en el entorno del proceso. Nunca hay datos financieros reales.
- Exige ``AI_ASSISTANT_IDENTITY_KEY`` (P-9): cada solicitud debe traer la identidad firmada.
- Peor caso de espera: ``AI_SQLGEN_TIMEOUT_S`` + 2 × ``AI_LLM_TIMEOUT_S`` ≤ 50 s, por debajo del
  tiempo de espera del proxy de Next.js en Vercel (55 s).

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
IDENTITY_KEY_VAR = "AI_ASSISTANT_IDENTITY_KEY"
RAG_MODE_VAR = "AI_RAG_MODE"
ZILLIZ_URI_VAR = "ZILLIZ_CLOUD_URI"
ZILLIZ_TOKEN_VAR = "ZILLIZ_CLOUD_TOKEN"
RAG_COLLECTION_VAR = "AI_RAG_MILVUS_COLLECTION"
RAG_APPROVED_CORPUS_VAR = "AI_RAG_REMOTE_CORPUS_SHA256"
RAG_MODEL_EVIDENCE_VAR = "AI_RAG_MODEL_EVIDENCE"
EVAL_MODE_VAR = "AI_SERVICE_EVAL_MODE"
EVAL_MAX_WAIT_S = 50
# Únicas claves que pueden leerse de ai-service/.env (ignorado por Git); el entorno tiene prioridad.
# Nunca se lee DATABASE_URL (conexión principal del ERP).
DOTENV_KEYS = frozenset(
    {
        OPENAI_KEY_VAR, OPENAI_MODEL_VAR, READONLY_DSN_VAR, IDENTITY_KEY_VAR, ZILLIZ_URI_VAR, ZILLIZ_TOKEN_VAR,
        RAG_MODE_VAR, RAG_COLLECTION_VAR, RAG_APPROVED_CORPUS_VAR, RAG_MODEL_EVIDENCE_VAR,
    }
)
RAG_MODES = frozenset({"lexico", "semantico", "milvus"})
# Evidencia para el Modelo 2 (T033): ``relaciones`` (solo relaciones del esquema, comportamiento previo)
# o ``ampliada`` (además reglas y métricas con ``evidencia_modelo`` aprobada).
RAG_MODEL_EVIDENCE_MODES = frozenset({"relaciones", "ampliada"})
_ZILLIZ_URI_RE = re.compile(r"^https://[A-Za-z0-9.-]+(:\d{2,5})?$")
_COLLECTION_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")


@dataclass(frozen=True)
class RagSettings:
    """Recuperación (RAG). ``milvus`` solo con credenciales y la huella del corpus aprobado."""

    mode: str = "lexico"
    milvus_uri: str | None = field(default=None, repr=False)
    milvus_token: str | None = field(default=None, repr=False)
    collection: str = "erp_ai_rag_v1"
    approved_corpus_sha256: str | None = None
    model_evidence: str = "relaciones"

    def __repr__(self) -> str:
        return (
            f"RagSettings(mode={self.mode!r}, milvus_uri={'***' if self.milvus_uri else None}, "
            f"milvus_token={'***' if self.milvus_token else None}, collection={self.collection!r}, "
            f"model_evidence={self.model_evidence!r})"
        )

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
    identity_key: bytes | None = field(default=None, repr=False)
    rag: RagSettings = field(default_factory=RagSettings)
    eval_mode: bool = False

    def __repr__(self) -> str:
        return (
            f"ServiceSettings(environment={self.environment!r}, host={self.host!r}, port={self.port}, "
            f"internal_token='***', audit_hmac_key='***', max_body_bytes={self.max_body_bytes}, "
            f"sql_generator={self.sql_generator!r}, sqlgen={self.sqlgen!r}, "
            f"sql_executor={self.sql_executor!r}, readonly_dsn={'***' if self.readonly_dsn else None}, "
            f"llm_provider={self.llm_provider!r}, llm={self.llm!r}, "
            f"identity_key={'***' if self.identity_key else None}, rag={self.rag!r}, eval_mode={self.eval_mode})"
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

    ``dotenv_path`` (opcional): de ese archivo solo se toman las claves de :data:`DOTENV_KEYS`, y cada
    una solo cuando la función que la usa está activa; las variables del entorno tienen prioridad.
    """
    from_file = read_dotenv_keys(dotenv_path) if dotenv_path is not None else {}
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
        # Solo se lee con activación explícita; nunca DATABASE_URL.
        readonly_dsn = _read(env, READONLY_DSN_VAR) or from_file.get(READONLY_DSN_VAR, "").strip()
        if not readonly_dsn.startswith(_DSN_SCHEMES):
            raise ServiceConfigError(f"{READONLY_DSN_VAR} falta o no es una conexión PostgreSQL válida.")

    identity_key = _load_identity_key(
        _read(env, IDENTITY_KEY_VAR) or from_file.get(IDENTITY_KEY_VAR, "").strip(),
        other_secrets=(token_bytes, audit_key, *((bytes.fromhex(sqlgen.token),) if sqlgen else ())),
    )
    if executor == POSTGRES_EXECUTOR and identity_key is None:
        raise ServiceConfigError(f"{SQL_EXECUTOR_VAR}={POSTGRES_EXECUTOR} requiere {IDENTITY_KEY_VAR} (P-9).")

    llm_provider = _read(env, LLM_PROVIDER_VAR, SIMULATED_LLM)
    if llm_provider not in (SIMULATED_LLM, OPENAI_LLM):
        raise ServiceConfigError(f"{LLM_PROVIDER_VAR} debe ser '{SIMULATED_LLM}' u '{OPENAI_LLM}'.")
    llm = _load_llm_settings(env, from_file) if llm_provider == OPENAI_LLM else None
    rag = _load_rag_settings(env, from_file)

    eval_text = _read(env, EVAL_MODE_VAR)
    if eval_text not in ("", "0", "1"):
        raise ServiceConfigError(f"{EVAL_MODE_VAR} debe ser '1' o no definirse.")
    eval_mode = eval_text == "1"
    if eval_mode:
        _check_eval_profile(env, generator, executor, llm_provider, rag.mode, identity_key, sqlgen, llm)

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
        identity_key=identity_key,
        rag=rag,
        eval_mode=eval_mode,
    )


def _check_eval_profile(
    env: Mapping[str, str],
    generator: str,
    executor: str,
    llm_provider: str,
    rag_mode: str,
    identity_key: bytes | None,
    sqlgen: SqlGenSettings | None,
    llm: LlmSettings | None,
) -> None:
    """Perfil de evaluación: modelos reales + Milvus, SOLO Executor ficticio y P-9 obligatorio."""
    # Datos financieros reales: imposibles en evaluación, aunque alguien los active por error.
    if executor != FIXTURE_EXECUTOR or _read(env, SQL_EXECUTOR_VAR) != FIXTURE_EXECUTOR:
        raise ServiceConfigError(f"{EVAL_MODE_VAR}=1 exige {SQL_EXECUTOR_VAR}={FIXTURE_EXECUTOR} (explícito).")
    if READONLY_DSN_VAR in env:
        raise ServiceConfigError(f"{EVAL_MODE_VAR}=1 no admite {READONLY_DSN_VAR} en el entorno del proceso.")
    if generator != XIYAN_GENERATOR or llm_provider != OPENAI_LLM or rag_mode != "milvus":
        raise ServiceConfigError(
            f"{EVAL_MODE_VAR}=1 exige {SQL_GENERATOR_VAR}={XIYAN_GENERATOR}, {LLM_PROVIDER_VAR}={OPENAI_LLM} "
            f"y {RAG_MODE_VAR}=milvus."
        )
    if identity_key is None:
        raise ServiceConfigError(f"{EVAL_MODE_VAR}=1 exige {IDENTITY_KEY_VAR} (P-9).")
    if sqlgen is None or llm is None:
        raise ServiceConfigError(f"{EVAL_MODE_VAR}=1 exige la configuración completa de ambos modelos.")
    if sqlgen.timeout_s + 2 * llm.timeout_s > EVAL_MAX_WAIT_S:
        raise ServiceConfigError(
            f"{EVAL_MODE_VAR}=1 exige {SQLGEN_TIMEOUT_VAR} + 2 × {LLM_TIMEOUT_VAR} ≤ {EVAL_MAX_WAIT_S} s."
        )


def _load_rag_settings(env: Mapping[str, str], from_file: Mapping[str, str]) -> RagSettings:
    def read(name: str, default: str = "") -> str:
        # Entorno primero; después ai-service/.env (solo claves de DOTENV_KEYS); por último el valor por defecto.
        return _read(env, name) or from_file.get(name, "").strip() or default

    mode = read(RAG_MODE_VAR, "lexico")
    if mode not in RAG_MODES:
        raise ServiceConfigError(f"{RAG_MODE_VAR} debe ser 'lexico', 'semantico' o 'milvus'.")
    model_evidence = read(RAG_MODEL_EVIDENCE_VAR, "relaciones")
    if model_evidence not in RAG_MODEL_EVIDENCE_MODES:
        raise ServiceConfigError(f"{RAG_MODEL_EVIDENCE_VAR} debe ser 'relaciones' o 'ampliada'.")
    if mode != "milvus":
        return RagSettings(mode=mode, model_evidence=model_evidence)
    # Recuperación REMOTA: deshabilitada salvo credenciales y aprobación explícita del corpus.
    uri = read(ZILLIZ_URI_VAR)
    token = read(ZILLIZ_TOKEN_VAR)
    if not _ZILLIZ_URI_RE.match(uri) or not token:
        raise ServiceConfigError(f"{RAG_MODE_VAR}=milvus requiere {ZILLIZ_URI_VAR} (https) y {ZILLIZ_TOKEN_VAR}.")
    collection = read(RAG_COLLECTION_VAR, "erp_ai_rag_v1")
    if not _COLLECTION_RE.match(collection):
        raise ServiceConfigError(f"{RAG_COLLECTION_VAR} no es un nombre de colección válido.")
    approved = read(RAG_APPROVED_CORPUS_VAR).lower()
    if not re.fullmatch(r"[0-9a-f]{64}", approved):
        raise ServiceConfigError(f"{RAG_MODE_VAR}=milvus requiere {RAG_APPROVED_CORPUS_VAR} (huella del corpus aprobado).")
    return RagSettings(
        mode=mode, milvus_uri=uri, milvus_token=token, collection=collection, approved_corpus_sha256=approved,
        model_evidence=model_evidence,
    )


def _load_identity_key(raw: str, *, other_secrets: tuple[bytes, ...]) -> bytes | None:
    """Clave HS256 compartida con el proxy del ERP (P-9). Opcional salvo con el Executor real."""
    if not raw:
        return None
    try:
        key = bytes.fromhex(raw)
    except ValueError:
        raise ServiceConfigError(f"{IDENTITY_KEY_VAR} debe ser hexadecimal.") from None
    if len(key) < MIN_TOKEN_BYTES:
        raise ServiceConfigError(f"{IDENTITY_KEY_VAR} debe tener al menos {MIN_TOKEN_BYTES} bytes.")
    if any(hmac.compare_digest(key, secret) for secret in other_secrets):
        raise ServiceConfigError(f"{IDENTITY_KEY_VAR} debe ser independiente de las demás credenciales.")
    return key


def _decimal(env: Mapping[str, str], name: str, default: str | None = None) -> Decimal:
    text = _read(env, name, default or "")
    try:
        value = Decimal(text)
    except (InvalidOperation, ValueError):
        raise ServiceConfigError(f"{name} es obligatorio y debe ser un número decimal.") from None
    if not value.is_finite() or value < 0:
        raise ServiceConfigError(f"{name} debe ser un número no negativo.")
    return value


def _load_llm_settings(env: Mapping[str, str], from_file: Mapping[str, str]) -> LlmSettings:
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
