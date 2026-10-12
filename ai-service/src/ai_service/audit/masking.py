"""Enmascaramiento y seudonimización para las trazas (T015, SEC-8).

- **Clave HMAC**: se recibe por configuración (variable :data:`HMAC_KEY_ENV_VAR`, nombre PROPUESTO)
  como texto hexadecimal de al menos 64 caracteres (32 bytes). **Nunca** se escribe en el código ni
  se muestra. Si falta o es débil, se lanza :class:`AuditConfigError` (fallo seguro: sin clave no se
  construyen trazas). La gestión real de la clave está pendiente de P-10.
- **Plantilla SQL**: todos los literales del SQL validado se sustituyen por marcadores; los valores
  solo se conservan como **tipo + HMAC-SHA256**, nunca en claro.
- **Redacción de texto libre**: URLs de conexión, contraseñas, tokens, correos, DNI, RUC e importes
  se sustituyen antes de registrar cualquier diagnóstico.

Un HMAC con clave es una seudonimización **irreversible sin la clave**; con la clave permite
correlacionar valores iguales entre trazas. Por eso la clave es un secreto de despliegue (DE-7).
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass

import sqlglot
from sqlglot import exp
from sqlglot.tokens import Tokenizer

HMAC_KEY_ENV_VAR = "AI_ASSISTANT_AUDIT_HMAC_KEY"
MIN_KEY_BYTES = 32
HMAC_PREFIX = "hmac-sha256:"
DIALECT = "postgres"


class AuditConfigError(Exception):
    """Falta configuración obligatoria de auditoría o es insegura. Nunca incluye la clave."""


class AuditMaskingError(Exception):
    """El SQL no se pudo parametrizar de forma segura; no debe registrarse en claro."""


def load_hmac_key(env: Mapping[str, str], var_name: str = HMAC_KEY_ENV_VAR) -> bytes:
    """Lee la clave HMAC de ``env`` (solo ``var_name``) y la valida; falla de forma segura."""
    raw = env.get(var_name, "")
    value = raw.strip() if isinstance(raw, str) else ""
    if not value:
        raise AuditConfigError(f"Falta la clave de auditoría {var_name}; no se generan trazas.")
    try:
        key = bytes.fromhex(value)
    except ValueError as exc:
        raise AuditConfigError(f"La clave {var_name} debe estar en hexadecimal.") from exc
    if len(key) < MIN_KEY_BYTES:
        raise AuditConfigError(f"La clave {var_name} debe tener al menos {MIN_KEY_BYTES} bytes.")
    return key


class Pseudonymizer:
    """Calcula HMAC-SHA256 con una clave inyectada. La clave no se expone en ``repr``."""

    __slots__ = ("_key",)

    def __init__(self, key: bytes) -> None:
        if not isinstance(key, bytes) or len(key) < MIN_KEY_BYTES:
            raise AuditConfigError(f"La clave HMAC debe tener al menos {MIN_KEY_BYTES} bytes.")
        self._key = key

    def __repr__(self) -> str:
        return "Pseudonymizer(key='***')"

    def digest(self, value: str, *, context: str) -> str:
        """HMAC del valor ligado a un contexto (``usuario``, ``parametro:text``…)."""
        message = f"{context}\x1f{value}".encode("utf-8")
        return HMAC_PREFIX + hmac.new(self._key, message, hashlib.sha256).hexdigest()


@dataclass(frozen=True)
class ParametrizedSql:
    """Plantilla sin literales y los valores originales (solo en memoria, para enmascararlos)."""

    template: str
    parameters: tuple[tuple[str, str], ...]  # (tipo, valor) — nunca se registran en claro


def parametrize_sql(sql: str) -> ParametrizedSql:
    """Sustituye todos los literales del SQL por marcadores ``%(n)s``.

    Se espera SQL ya aprobado por el validador. Si no es una única sentencia sin comentarios, se
    lanza :class:`AuditMaskingError` para que nunca se registre texto SQL sin parametrizar.
    """
    try:
        tokens = Tokenizer(dialect=DIALECT).tokenize(sql)
        if any(token.comments for token in tokens):
            raise AuditMaskingError("El SQL contiene comentarios.")
        logger = logging.getLogger("sqlglot")
        previous = logger.level
        logger.setLevel(logging.ERROR)
        try:
            statements = [s for s in sqlglot.parse(sql, read=DIALECT) if s is not None]
        finally:
            logger.setLevel(previous)
    except AuditMaskingError:
        raise
    except Exception as exc:
        raise AuditMaskingError("El SQL no se pudo analizar para parametrizarlo.") from exc
    if len(statements) != 1 or isinstance(statements[0], exp.Command):
        raise AuditMaskingError("Solo se parametriza una única sentencia analizable.")

    tree = statements[0]
    literals = list(tree.find_all(exp.Literal))
    parameters: list[tuple[str, str]] = []
    for index, literal in enumerate(literals, start=1):
        parameters.append(("text" if literal.is_string else "number", str(literal.this)))
        literal.replace(exp.Placeholder(this=str(index)))
    return ParametrizedSql(template=tree.sql(dialect=DIALECT), parameters=tuple(parameters))


def mask_parameters(
    parameters: tuple[tuple[str, str], ...], pseudonymizer: Pseudonymizer
) -> tuple[tuple[str, str], ...]:
    """Devuelve ``(tipo, hmac)`` por parámetro; el valor original nunca sale de esta función."""
    return tuple(
        (kind, pseudonymizer.digest(value, context=f"parametro:{kind}")) for kind, value in parameters
    )


# --------------------------------------------------------------------------- texto libre

_SENSITIVE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("[CONEXION]", re.compile(r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://\S+", re.I)),
    ("[SECRETO]", re.compile(r"\b(?:password|passwd|pwd|contrase(?:n|ñ)a|secret|api[_-]?key|token)\s*[=:]\s*\S+", re.I)),
    ("[SECRETO]", re.compile(r"\bbearer\s+[A-Za-z0-9._~+/=-]+", re.I)),
    ("[SECRETO]", re.compile(r"\bsk-[A-Za-z0-9_-]{10,}\b")),
    ("[CORREO]", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("[RUC]", re.compile(r"\b(?:10|15|17|20)\d{9}\b")),
    ("[DNI]", re.compile(r"\b\d{8}\b")),
    ("[IMPORTE]", re.compile(r"(?:S/|US\$|\$)\s?-?\d[\d,]*(?:\.\d+)?")),
)


def redact_text(text: str) -> str:
    """Sustituye datos sensibles conocidos de un texto libre (p. ej. un diagnóstico técnico)."""
    redacted = text
    for replacement, pattern in _SENSITIVE_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


def contains_sensitive(text: str) -> bool:
    """``True`` si el texto contiene algún patrón sensible conocido."""
    return any(pattern.search(text) for _, pattern in _SENSITIVE_PATTERNS)
