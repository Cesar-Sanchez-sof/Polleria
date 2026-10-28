"""P-9: aserción de identidad firmada por el proxy del ERP (JWT compacto HS256, solo biblioteca estándar).

El proxy Next.js obtiene la identidad **exclusivamente** de ``sesionActual()`` (cookie de sesión
verificada y usuario activo en la base) y firma, con ``AI_ASSISTANT_IDENTITY_KEY`` (secreto distinto
del token interno), una aserción de vida corta por solicitud:

``{"iss": "polleria-erp", "aud": "ai-service", "sub": "<idUsuario>", "rol": "<rol del asistente>",
"jti": "<id_traza>", "iat": <s>, "exp": <s>}`` con ``exp - iat <= 60``.

Este módulo la verifica antes de que exista cualquier ``AuthorizationContext``:

- cabecera exactamente ``{"alg": "HS256", "typ": "JWT"}`` (se rechazan ``none``, otros algoritmos y
  cabeceras adicionales como ``kid`` o ``crit``);
- firma HMAC-SHA256 comparada en tiempo constante;
- ``iss``, ``aud``, vida máxima, ``iat`` no futuro y ``exp`` no vencido (tolerancia de reloj 5 s);
- ``sub``, ``rol`` y ``jti`` idénticos al usuario, rol y traza de la solicitud CT-B;
- ``mod`` (opcional): lista de módulos del ERP que el usuario puede consultar, calculada por el proxy a
  partir de sus permisos reales; si viene, el asistente solo lee tablas de esos módulos.

Los errores solo llevan un código fijo: nunca el token, la clave ni los claims.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
from dataclasses import dataclass
from typing import Any

ISSUER = "polleria-erp"
# Valor que firma el proxy del ERP (``lib/ai-assistant/identity.ts``); se conserva al separar agents-service de ai-service.
AUDIENCE = "ai-service"
IDENTITY_HEADER = "X-ERP-Identity"
MAX_LIFETIME_S = 60
CLOCK_SKEW_S = 5
MAX_TOKEN_CHARS = 2048
EXPECTED_HEADER = {"alg": "HS256", "typ": "JWT"}
REQUIRED_CLAIMS = frozenset({"iss", "aud", "sub", "rol", "jti", "iat", "exp"})


class IdentityError(Exception):
    """Aserción ausente, alterada, vencida o que no corresponde a la solicitud."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


MODULE_RE = re.compile(r"^[a-z][a-z_]{2,29}$")
MAX_MODULES = 20


@dataclass(frozen=True)
class VerifiedIdentity:
    user_id: int
    rol: str
    trace_id: str
    # Claim opcional ``mod``: módulos del ERP que el usuario puede consultar según SUS permisos (los
    # calcula el proxy desde la base). ``None`` si el proxy no la envía (compatibilidad).
    modulos: frozenset[str] | None = None


def _b64decode(segment: str) -> bytes:
    if not segment or any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" for c in segment):
        raise IdentityError("MALFORMED")
    try:
        return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))
    except (ValueError, TypeError):
        raise IdentityError("MALFORMED") from None


def _json_object(segment: str) -> dict[str, Any]:
    try:
        value = json.loads(_b64decode(segment))
    except ValueError:
        raise IdentityError("MALFORMED") from None
    if not isinstance(value, dict):
        raise IdentityError("MALFORMED")
    return value


def _int_claim(claims: dict[str, Any], name: str) -> int:
    value = claims.get(name)
    if not isinstance(value, int) or isinstance(value, bool):
        raise IdentityError("MALFORMED")
    return value


def verify_identity_assertion(
    token: str | None,
    *,
    key: bytes,
    trace_id: str,
    user_id: int,
    rol: str,
    now: float,
) -> VerifiedIdentity:
    if not isinstance(token, str) or not token:
        raise IdentityError("MISSING")
    if len(token) > MAX_TOKEN_CHARS or token.count(".") != 2:
        raise IdentityError("MALFORMED")
    header_b64, payload_b64, signature_b64 = token.split(".")

    if _json_object(header_b64) != EXPECTED_HEADER:
        raise IdentityError("UNSUPPORTED_HEADER")
    expected = hmac.new(key, f"{header_b64}.{payload_b64}".encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _b64decode(signature_b64)):
        raise IdentityError("BAD_SIGNATURE")

    claims = _json_object(payload_b64)
    if not REQUIRED_CLAIMS <= set(claims):
        raise IdentityError("MALFORMED")
    if claims["iss"] != ISSUER:
        raise IdentityError("BAD_ISSUER")
    audience = claims["aud"]
    if not (audience == AUDIENCE or (isinstance(audience, list) and audience == [AUDIENCE])):
        raise IdentityError("BAD_AUDIENCE")
    issued_at, expires_at = _int_claim(claims, "iat"), _int_claim(claims, "exp")
    if not 0 < expires_at - issued_at <= MAX_LIFETIME_S:
        raise IdentityError("BAD_LIFETIME")
    if issued_at > now + CLOCK_SKEW_S:
        raise IdentityError("NOT_YET_VALID")
    if now >= expires_at + CLOCK_SKEW_S:
        raise IdentityError("EXPIRED")
    if claims["sub"] != str(user_id) or claims["rol"] != rol or claims["jti"] != trace_id:
        raise IdentityError("IDENTITY_MISMATCH")
    modules = None
    if "mod" in claims:
        raw = claims["mod"]
        if (not isinstance(raw, list) or len(raw) > MAX_MODULES
                or not all(isinstance(m, str) and MODULE_RE.match(m) for m in raw)):
            raise IdentityError("MALFORMED")
        modules = frozenset(raw)
    return VerifiedIdentity(user_id=user_id, rol=rol, trace_id=trace_id, modulos=modules)
