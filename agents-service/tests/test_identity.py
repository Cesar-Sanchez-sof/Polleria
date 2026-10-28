"""P-9: aserción de identidad firmada por el proxy del ERP (HS256) y su verificación en la API."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

from guards import GuardedTestCase

from agents_service.auth.identity import IDENTITY_HEADER, IdentityError, verify_identity_assertion

KEY = bytes.fromhex("22" * 32)
NOW = 1_791_900_030
TRACE = "erp-0123456789abcdef"
# Vector generado con `jose` (la librería del proxy Next.js), clave ficticia 0x11 * 32.
JOSE_VECTOR = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2wiOiJjb250YWRvcl9kZW1vIiwiaXNzIjoicG9sbGVyaWEtZXJwIiwiYXVkIjoiYWkt"
    "c2VydmljZSIsInN1YiI6IjciLCJqdGkiOiJlcnAtMDEyMzQ1Njc4OWFiY2RlZiIsImlhdCI6MTc5MTkwMDAwMCwiZXhwIjoxNzkxOTAwMDYwfQ"
    ".hpe0LVcAzWo3ccDtgR66XHsyPlZlO2bCbUHgyf8YM6g"
)


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign(claims: dict, *, key: bytes = KEY, header: dict | None = None) -> str:
    head = b64(json.dumps(header or {"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps(claims).encode())
    signature = hmac.new(key, f"{head}.{body}".encode(), hashlib.sha256).digest()
    return f"{head}.{body}.{b64(signature)}"


def signed_raw(payload: bytes, *, key: bytes = KEY) -> str:
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(payload)
    return f"{head}.{body}.{b64(hmac.new(key, f'{head}.{body}'.encode(), hashlib.sha256).digest())}"


def claims(**overrides) -> dict:
    base = {"iss": "polleria-erp", "aud": "ai-service", "sub": "7", "rol": "contador_demo", "jti": TRACE,
            "iat": NOW - 10, "exp": NOW + 50}
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not ...}


def verify(token, **overrides):
    params = {"key": KEY, "trace_id": TRACE, "user_id": 7, "rol": "contador_demo", "now": NOW}
    params.update(overrides)
    return verify_identity_assertion(token, **params)


class VerifierTests(GuardedTestCase):
    def test_valid_assertion(self) -> None:
        identity = verify(sign(claims()))
        self.assertEqual((identity.user_id, identity.rol, identity.trace_id), (7, "contador_demo", TRACE))
        self.assertEqual(verify(sign(claims(aud=["ai-service"]))).user_id, 7)

    def test_compatible_with_jose_from_the_proxy(self) -> None:
        identity = verify(JOSE_VECTOR, key=bytes.fromhex("11" * 32), now=1_791_900_030)
        self.assertEqual((identity.user_id, identity.rol), (7, "contador_demo"))
        with self.assertRaises(IdentityError):
            verify(JOSE_VECTOR, key=KEY, now=1_791_900_030)  # otra clave

    def test_rejected_assertions(self) -> None:
        token = sign(claims())
        head, body, sig = token.split(".")
        cases = {
            "MISSING": [None, ""],
            "MALFORMED": ["a.b", "a.b.c.d", f"{head}.{body}.%%%", "x" * 3000, signed_raw(b"[1]")],
            "BAD_SIGNATURE": [
                f"{head}.{b64(b'[1]')}.{sig}",  # la firma se comprueba antes de leer el contenido
                sign(claims(), key=bytes.fromhex("33" * 32)),
                f"{head}.{b64(json.dumps(claims(rol='admin_total')).encode())}.{sig}",  # payload alterado
                f"{head}.{body}.{b64(b'0' * 32)}",
            ],
            "UNSUPPORTED_HEADER": [
                sign(claims(), header={"alg": "none", "typ": "JWT"}),
                sign(claims(), header={"alg": "HS512", "typ": "JWT"}),
                sign(claims(), header={"alg": "HS256"}),
                sign(claims(), header={"alg": "HS256", "typ": "JWT", "kid": "x"}),
                sign(claims(), header={"alg": "HS256", "typ": "JWT", "crit": ["exp"]}),
                f"{b64(json.dumps({'alg': 'none', 'typ': 'JWT'}).encode())}.{body}.",
            ],
            "BAD_ISSUER": [sign(claims(iss="otro-sistema"))],
            "BAD_AUDIENCE": [sign(claims(aud="otra-api")), sign(claims(aud=["ai-service", "otra"]))],
            "BAD_LIFETIME": [sign(claims(iat=NOW - 10, exp=NOW + 3600)), sign(claims(iat=NOW, exp=NOW))],
            "NOT_YET_VALID": [sign(claims(iat=NOW + 30, exp=NOW + 60))],
            "EXPIRED": [sign(claims(iat=NOW - 120, exp=NOW - 60))],
            "IDENTITY_MISMATCH": [
                sign(claims(sub="8")),
                sign(claims(rol="lector_demo")),
                sign(claims(jti="otra-traza-0000")),
            ],
            "MALFORMED-claims": [sign(claims(iat="ayer")), sign(claims(exp=True)), sign(claims(rol=...))],
        }
        for code, tokens in cases.items():
            for token in tokens:
                with self.subTest(code=code, token=str(token)[:24]):
                    with self.assertRaises(IdentityError) as ctx:
                        verify(token)
                    self.assertEqual(ctx.exception.code, code.split("-")[0])
                    self.assertNotIn(KEY.hex(), repr(ctx.exception))
                    if token:
                        self.assertNotIn(str(token), str(ctx.exception))
