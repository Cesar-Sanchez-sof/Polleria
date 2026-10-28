"""Configuración de ``agents-service`` (agentes de solo lectura Gemini y Groq), con fallo seguro.

Variables (del entorno; en local también de ``agents-service/.env``, solo las claves de
:data:`DOTENV_KEYS`; el entorno tiene prioridad y nunca se lee ``DATABASE_URL``):

- ``AGENTS_SERVICE_INTERNAL_TOKEN``: hexadecimal de al menos 32 bytes; el mismo valor que el proxy del
  ERP envía en ``X-Internal-Token`` (``AGENTS_SERVICE_INTERNAL_TOKEN`` de Next.js). Obligatorio.
- ``AI_ASSISTANT_IDENTITY_KEY`` (P-9): clave HS256 compartida con el proxy; distinta del token. Obligatoria.
- ``DATABASE_URL_READONLY``, ``GEMINI_API_KEY``/``GROQ_API_KEY`` y las banderas ``AI_GEMINI_SQL``/``AI_GROQ_SQL``:
  ver ``agents_service.gemini_sql.config``. Al menos un agente debe estar activo.
- ``PORT``: puerto de escucha (Render lo fija); por defecto 8002. ``AGENTS_SERVICE_PORT`` lo sustituye en local.
- ``AGENTS_SERVICE_HOST``: por defecto ``0.0.0.0`` (necesario dentro del contenedor); en local, ``127.0.0.1``.
- ``AGENTS_SERVICE_ALLOWED_HOSTS`` (opcional): cabeceras ``Host`` aceptadas, separadas por comas. Sin definir
  no se restringe (la autenticación es el token interno y la identidad firmada, no el nombre de host).
- ``AGENTS_SERVICE_ALLOWED_USER_IDS`` (opcional): ids del ERP autorizados (cuentas evaluadoras); otros → ``403``.

Ningún mensaje de error ni ``repr`` incluye valores secretos.
"""

from __future__ import annotations

import hmac
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

from agents_service.gemini_sql.config import (
    GeminiSqlSettings,
    GroqSqlSettings,
    load_gemini_sql_settings,
    load_groq_sql_settings,
)

TOKEN_VAR = "AGENTS_SERVICE_INTERNAL_TOKEN"
IDENTITY_KEY_VAR = "AI_ASSISTANT_IDENTITY_KEY"
READONLY_DSN_VAR = "DATABASE_URL_READONLY"
PORT_VAR = "PORT"
SERVICE_PORT_VAR = "AGENTS_SERVICE_PORT"
HOST_VAR = "AGENTS_SERVICE_HOST"
ALLOWED_HOSTS_VAR = "AGENTS_SERVICE_ALLOWED_HOSTS"
ALLOWED_USERS_VAR = "AGENTS_SERVICE_ALLOWED_USER_IDS"

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8002
MIN_TOKEN_BYTES = 32
MAX_BODY_BYTES = 16 * 1024
_USERS_RE = re.compile(r"^[1-9][0-9]{0,9}(,[1-9][0-9]{0,9}){0,9}$")
_HOST_RE = re.compile(r"^[A-Za-z0-9.-]{1,253}$")

# Únicas claves que pueden leerse de agents-service/.env (ignorado por Git).
DOTENV_KEYS = frozenset(
    {
        TOKEN_VAR, IDENTITY_KEY_VAR, READONLY_DSN_VAR, "GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL",
    }
)


class ServiceConfigError(Exception):
    """Configuración inválida o insegura. Nunca incluye valores de las variables."""


@dataclass(frozen=True)
class AgentsServiceSettings:
    host: str
    port: int
    internal_token: str = field(repr=False)
    identity_key: bytes = field(repr=False)
    gemini: GeminiSqlSettings | None = None
    groq: GroqSqlSettings | None = None
    max_body_bytes: int = MAX_BODY_BYTES
    allowed_hosts: tuple[str, ...] | None = None
    # Ids del ERP autorizados (identidad firmada P-9); ``None`` = sin restricción adicional.
    eval_allowed_user_ids: frozenset[int] | None = None

    def __repr__(self) -> str:
        return (
            f"AgentsServiceSettings(host={self.host!r}, port={self.port}, internal_token='***', identity_key='***', "
            f"gemini={self.gemini!r}, groq={self.groq!r}, max_body_bytes={self.max_body_bytes}, "
            f"allowed_hosts={self.allowed_hosts!r}, eval_allowed_user_ids={sorted(self.eval_allowed_user_ids or ())})"
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


def _hex_secret(raw: str, name: str) -> bytes:
    if not raw:
        raise ServiceConfigError(f"Falta {name}; el servicio no arranca sin esa credencial.")
    try:
        secret = bytes.fromhex(raw)
    except ValueError:
        raise ServiceConfigError(f"{name} debe ser hexadecimal.") from None
    if len(secret) < MIN_TOKEN_BYTES:
        raise ServiceConfigError(f"{name} debe tener al menos {MIN_TOKEN_BYTES} bytes.")
    return secret


def load_service_settings(env: Mapping[str, str], *, dotenv_path: Path | None = None) -> AgentsServiceSettings:
    """Valida la configuración leyendo solo las variables del módulo; falla de forma segura."""
    from_file = read_dotenv_keys(dotenv_path) if dotenv_path is not None else {}

    def read(name: str) -> str:
        return _read(env, name) or from_file.get(name, "").strip()

    host = _read(env, HOST_VAR, DEFAULT_HOST)
    if not _HOST_RE.match(host):
        raise ServiceConfigError(f"{HOST_VAR} no es una dirección válida.")
    port_text = _read(env, SERVICE_PORT_VAR) or _read(env, PORT_VAR, str(DEFAULT_PORT))
    if not port_text.isdigit() or not 1 <= int(port_text) <= 65535:
        raise ServiceConfigError(f"{SERVICE_PORT_VAR}/{PORT_VAR} debe ser un número de puerto válido.")

    token = read(TOKEN_VAR)
    token_bytes = _hex_secret(token, TOKEN_VAR)
    identity_key = _hex_secret(read(IDENTITY_KEY_VAR), IDENTITY_KEY_VAR)
    if hmac.compare_digest(identity_key, token_bytes):
        raise ServiceConfigError(f"{IDENTITY_KEY_VAR} debe ser independiente de {TOKEN_VAR}.")

    # Los agentes leen sus claves del entorno y, en local, del .env (el entorno tiene prioridad).
    gemini = load_gemini_sql_settings(env, from_file, identity_key_configured=True)
    groq = load_groq_sql_settings(env, from_file, identity_key_configured=True)
    if gemini is None and groq is None:
        raise ServiceConfigError("Activa al menos un agente: AI_GEMINI_SQL=1 o AI_GROQ_SQL=1 (con su clave de API).")

    hosts_text = _read(env, ALLOWED_HOSTS_VAR).replace(" ", "")
    allowed_hosts: tuple[str, ...] | None = None
    if hosts_text:
        parts = tuple(hosts_text.split(","))
        if not all(_HOST_RE.match(part) or part.startswith("*.") and _HOST_RE.match(part[2:]) for part in parts):
            raise ServiceConfigError(f"{ALLOWED_HOSTS_VAR} debe ser una lista de nombres de host separados por comas.")
        allowed_hosts = parts

    users_text = _read(env, ALLOWED_USERS_VAR).replace(" ", "")
    if users_text and not _USERS_RE.match(users_text):
        raise ServiceConfigError(f"{ALLOWED_USERS_VAR} debe ser una lista de ids enteros separados por comas.")
    allowed_users = frozenset(int(v) for v in users_text.split(",")) if users_text else None

    return AgentsServiceSettings(
        host=host,
        port=int(port_text),
        internal_token=token,
        identity_key=identity_key,
        gemini=gemini,
        groq=groq,
        allowed_hosts=allowed_hosts,
        eval_allowed_user_ids=allowed_users,
    )
