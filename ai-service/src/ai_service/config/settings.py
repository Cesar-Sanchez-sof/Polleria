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

Ningún mensaje de error ni ``repr`` incluye valores de estas variables.

El token interno **no es autenticación real del ERP**: identifica al proxy, no a los usuarios. Los
roles y usuarios que viajan en CT-B siguen siendo simulados hasta resolver DE-1, DE-2 y P-9.
"""

from __future__ import annotations

import hmac
from collections.abc import Mapping
from dataclasses import dataclass, field

from ai_service.audit.masking import HMAC_KEY_ENV_VAR, AuditConfigError, load_hmac_key

ENV_VAR = "AI_SERVICE_ENV"
HOST_VAR = "AI_SERVICE_HOST"
PORT_VAR = "AI_SERVICE_PORT"
TOKEN_VAR = "AI_SERVICE_INTERNAL_TOKEN"

DEVELOPMENT = "development"
ALLOWED_HOST = "127.0.0.1"
DEFAULT_PORT = 8001
MIN_TOKEN_BYTES = 32
MAX_BODY_BYTES = 16 * 1024


class ServiceConfigError(Exception):
    """Configuración del servicio inválida o insegura. Nunca incluye valores secretos."""


@dataclass(frozen=True)
class ServiceSettings:
    environment: str
    host: str
    port: int
    internal_token: str = field(repr=False)
    audit_hmac_key: bytes = field(repr=False)
    max_body_bytes: int = MAX_BODY_BYTES

    def __repr__(self) -> str:
        return (
            f"ServiceSettings(environment={self.environment!r}, host={self.host!r}, port={self.port}, "
            f"internal_token='***', audit_hmac_key='***', max_body_bytes={self.max_body_bytes})"
        )

    def token_matches(self, provided: str | None) -> bool:
        """Comparación en tiempo constante del token interno."""
        if not provided:
            return False
        return hmac.compare_digest(provided.encode("utf-8"), self.internal_token.encode("utf-8"))


def _read(env: Mapping[str, str], name: str, default: str = "") -> str:
    value = env.get(name, default)
    return value.strip() if isinstance(value, str) else ""


def load_service_settings(env: Mapping[str, str]) -> ServiceSettings:
    """Valida la configuración leyendo solo las variables del módulo; falla de forma segura."""
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

    return ServiceSettings(
        environment=environment,
        host=host,
        port=int(port_text),
        internal_token=token,
        audit_hmac_key=audit_key,
    )
