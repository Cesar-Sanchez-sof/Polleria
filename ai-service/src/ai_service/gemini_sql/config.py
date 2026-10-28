"""Configuración del agente Gemini (activación **explícita**; falla de forma segura).

Variables (del entorno o, si faltan, de ``ai-service/.env``; nunca ``DATABASE_URL``):

- ``AI_GEMINI_SQL=1``: activa el agente. Sin esto no se lee ninguna otra variable y la ruta no existe.
- ``GEMINI_API_KEY``: clave de la API de Gemini. ``GEMINI_MODEL`` (opcional, por defecto ``gemini-3.5-flash``).
- ``DATABASE_URL_READONLY``: conexión del rol ``ai_readonly`` (solo ``SELECT``); distinta de ``DATABASE_URL``.
- ``AI_ASSISTANT_IDENTITY_KEY`` (P-9) es obligatoria: sin identidad firmada del ERP no hay agente.
- ``AI_GEMINI_SQL_TIMEOUT_S`` (1–40, por defecto 20): espera máxima a Gemini.

Groq usa el mismo agente con sus propias variables: ``AI_GROQ_SQL=1``, ``GROQ_API_KEY``, ``GROQ_MODEL``
(opcional, por defecto ``openai/gpt-oss-120b``) y ``AI_GROQ_SQL_TIMEOUT_S``; comparte ``DATABASE_URL_READONLY``
y ``AI_ASSISTANT_IDENTITY_KEY``.

Ningún mensaje de error ni ``repr`` incluye valores de estas variables.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field

AI_GEMINI_SQL_VAR = "AI_GEMINI_SQL"
GEMINI_KEY_VAR = "GEMINI_API_KEY"
GEMINI_MODEL_VAR = "GEMINI_MODEL"
GEMINI_TIMEOUT_VAR = "AI_GEMINI_SQL_TIMEOUT_S"
READONLY_DSN_VAR = "DATABASE_URL_READONLY"
IDENTITY_KEY_VAR = "AI_ASSISTANT_IDENTITY_KEY"
AI_GROQ_SQL_VAR = "AI_GROQ_SQL"
GROQ_KEY_VAR = "GROQ_API_KEY"
GROQ_MODEL_VAR = "GROQ_MODEL"
GROQ_TIMEOUT_VAR = "AI_GROQ_SQL_TIMEOUT_S"
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
DEFAULT_TIMEOUT_S = 20
MAX_TIMEOUT_S = 40
_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{20,200}$")
_MODEL_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,60}$", re.IGNORECASE)
_GROQ_MODEL_RE = re.compile(r"^[a-z0-9][a-z0-9._/-]{0,80}$", re.IGNORECASE)  # admite "openai/gpt-oss-120b"
_DSN_SCHEMES = ("postgresql://", "postgres://")


class GeminiSqlConfigError(Exception):
    """Configuración inválida o insegura del agente. Nunca incluye valores secretos."""


@dataclass(frozen=True)
class GeminiSqlSettings:
    api_key: str = field(repr=False)
    readonly_dsn: str = field(repr=False)
    model: str = DEFAULT_GEMINI_MODEL
    timeout_s: int = DEFAULT_TIMEOUT_S

    def __repr__(self) -> str:
        return f"GeminiSqlSettings(api_key='***', readonly_dsn='***', model={self.model!r}, timeout_s={self.timeout_s})"


def load_gemini_sql_settings(
    env: Mapping[str, str], from_file: Mapping[str, str], *, identity_key_configured: bool
) -> GeminiSqlSettings | None:
    """``None`` si el agente no está activado; error si se activa con una configuración insegura."""
    flag = env.get(AI_GEMINI_SQL_VAR, "").strip()
    if flag not in ("", "0", "1"):
        raise GeminiSqlConfigError(f"{AI_GEMINI_SQL_VAR} debe ser '1' o no definirse.")
    if flag != "1":
        return None

    def read(name: str) -> str:
        return env.get(name, "").strip() or from_file.get(name, "").strip()

    if not identity_key_configured:
        raise GeminiSqlConfigError(f"{AI_GEMINI_SQL_VAR}=1 exige {IDENTITY_KEY_VAR} (P-9).")
    api_key = read(GEMINI_KEY_VAR)
    if not _KEY_RE.match(api_key):
        raise GeminiSqlConfigError(f"{GEMINI_KEY_VAR} falta o no tiene un formato válido.")
    model = read(GEMINI_MODEL_VAR) or DEFAULT_GEMINI_MODEL
    if not _MODEL_RE.match(model):
        raise GeminiSqlConfigError(f"{GEMINI_MODEL_VAR} no es un identificador de modelo válido.")
    dsn = read(READONLY_DSN_VAR)
    if not dsn.startswith(_DSN_SCHEMES):
        raise GeminiSqlConfigError(f"{READONLY_DSN_VAR} falta o no es una conexión PostgreSQL válida.")
    write_dsn = env.get("DATABASE_URL", "").strip()
    if write_dsn and write_dsn == dsn:
        raise GeminiSqlConfigError(f"{READONLY_DSN_VAR} debe ser distinta de la conexión del ERP.")
    timeout_text = env.get(GEMINI_TIMEOUT_VAR, "").strip() or str(DEFAULT_TIMEOUT_S)
    if not timeout_text.isdigit() or not 1 <= int(timeout_text) <= MAX_TIMEOUT_S:
        raise GeminiSqlConfigError(f"{GEMINI_TIMEOUT_VAR} debe estar entre 1 y {MAX_TIMEOUT_S}.")
    return GeminiSqlSettings(api_key=api_key, readonly_dsn=dsn, model=model, timeout_s=int(timeout_text))


@dataclass(frozen=True)
class GroqSqlSettings:
    api_key: str = field(repr=False)
    readonly_dsn: str = field(repr=False)
    model: str = DEFAULT_GROQ_MODEL
    timeout_s: int = DEFAULT_TIMEOUT_S

    def __repr__(self) -> str:
        return f"GroqSqlSettings(api_key='***', readonly_dsn='***', model={self.model!r}, timeout_s={self.timeout_s})"


def load_groq_sql_settings(
    env: Mapping[str, str], from_file: Mapping[str, str], *, identity_key_configured: bool
) -> GroqSqlSettings | None:
    """Igual que Gemini: ``None`` si ``AI_GROQ_SQL`` no es ``1``; error si se activa con configuración insegura."""
    flag = env.get(AI_GROQ_SQL_VAR, "").strip()
    if flag not in ("", "0", "1"):
        raise GeminiSqlConfigError(f"{AI_GROQ_SQL_VAR} debe ser '1' o no definirse.")
    if flag != "1":
        return None

    def read(name: str) -> str:
        return env.get(name, "").strip() or from_file.get(name, "").strip()

    if not identity_key_configured:
        raise GeminiSqlConfigError(f"{AI_GROQ_SQL_VAR}=1 exige {IDENTITY_KEY_VAR} (P-9).")
    api_key = read(GROQ_KEY_VAR)
    if not _KEY_RE.match(api_key):
        raise GeminiSqlConfigError(f"{GROQ_KEY_VAR} falta o no tiene un formato válido.")
    model = read(GROQ_MODEL_VAR) or DEFAULT_GROQ_MODEL
    if not _GROQ_MODEL_RE.match(model):
        raise GeminiSqlConfigError(f"{GROQ_MODEL_VAR} no es un identificador de modelo válido.")
    dsn = read(READONLY_DSN_VAR)
    if not dsn.startswith(_DSN_SCHEMES):
        raise GeminiSqlConfigError(f"{READONLY_DSN_VAR} falta o no es una conexión PostgreSQL válida.")
    write_dsn = env.get("DATABASE_URL", "").strip()
    if write_dsn and write_dsn == dsn:
        raise GeminiSqlConfigError(f"{READONLY_DSN_VAR} debe ser distinta de la conexión del ERP.")
    timeout_text = env.get(GROQ_TIMEOUT_VAR, "").strip() or str(DEFAULT_TIMEOUT_S)
    if not timeout_text.isdigit() or not 1 <= int(timeout_text) <= MAX_TIMEOUT_S:
        raise GeminiSqlConfigError(f"{GROQ_TIMEOUT_VAR} debe estar entre 1 y {MAX_TIMEOUT_S}.")
    return GroqSqlSettings(api_key=api_key, readonly_dsn=dsn, model=model, timeout_s=int(timeout_text))
