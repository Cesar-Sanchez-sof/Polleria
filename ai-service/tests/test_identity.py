"""P-9: aserción de identidad firmada por el proxy del ERP (HS256) y su verificación en la API."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

from starlette.testclient import TestClient

from guards import GuardedTestCase

from ai_service.audit.masking import HMAC_KEY_ENV_VAR
from ai_service.auth.identity import IDENTITY_HEADER, IdentityError, verify_identity_assertion
from ai_service.config.settings import (
    ENV_VAR,
    IDENTITY_KEY_VAR,
    TOKEN_VAR,
    ServiceConfigError,
    load_service_settings,
)
from ai_service.http.app import create_app
from ai_service.http.routes import TOKEN_HEADER

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


class SpyOrchestrator:
    def __init__(self) -> None:
        self.calls: list = []

    def handle(self, payload, *, authorization=None):
        from ai_service.http.schemas import QueryResponse
        from ai_service.orchestrator.pipeline import PipelineOutcome

        self.calls.append(authorization)
        body = json.loads(payload)
        return PipelineOutcome(200, QueryResponse(id_traza=body["id_traza"], estado="sin_datos", texto="Sin datos."))


class ApiIdentityTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.key_hex = secrets.token_hex(32)
        env = {ENV_VAR: "development", TOKEN_VAR: secrets.token_hex(32), HMAC_KEY_ENV_VAR: secrets.token_hex(32),
               IDENTITY_KEY_VAR: self.key_hex}
        self.settings = load_service_settings(env)
        self.spy = SpyOrchestrator()
        self.client = TestClient(create_app(self.settings, self.spy), base_url="http://127.0.0.1", raise_server_exceptions=False)
        self.addCleanup(self.client.close)

    def post(self, *, identity: str | None, user_id: int = 7, rol: str = "contador_demo", trace: str = TRACE):
        body = {"id_traza": trace, "usuario": {"id": user_id, "rol": rol}, "mensaje": "Saldo de caja en septiembre",
                "contexto": None, "historial": [], "fecha_referencia_lima": "2026-10-12"}
        headers = {TOKEN_HEADER: self.settings.internal_token, "Content-Type": "application/json"}
        if identity is not None:
            headers[IDENTITY_HEADER] = identity
        return self.client.post("/v1/queries", content=json.dumps(body), headers=headers)

    def fresh(self, **overrides) -> str:
        now = int(time.time())
        return sign(claims(**{"iat": now, "exp": now + 60, **overrides}), key=bytes.fromhex(self.key_hex))

    def test_verified_identity_creates_an_authenticated_context(self) -> None:
        response = self.post(identity=self.fresh())
        self.assertEqual(response.status_code, 200)
        context = self.spy.calls[-1]
        self.assertEqual((context.rol, context.origen, context.autenticado), ("contador_demo", "erp-session", True))

    def test_missing_forged_expired_or_mismatched_assertions_never_reach_the_orchestrator(self) -> None:
        now = int(time.time())
        cases = {
            "ausente": self.post(identity=None),
            "otra-clave": self.post(identity=sign(claims(iat=now, exp=now + 60))),
            "vencida": self.post(identity=self.fresh(iat=now - 300, exp=now - 240)),
            "rol-del-navegador": self.post(identity=self.fresh(), rol="admin_total"),
            "otro-usuario": self.post(identity=self.fresh(), user_id=8),
            "otra-traza": self.post(identity=self.fresh(), trace="erp-ffffffffffffffff"),
        }
        for name, response in cases.items():
            with self.subTest(case=name):
                self.assertEqual((response.status_code, response.json()), (401, {"error": "No autorizado.", "errores": []}))
                self.assertNotIn(self.key_hex, response.text)
        self.assertEqual(self.spy.calls, [])

    def test_internal_token_is_still_required(self) -> None:
        response = self.client.post(
            "/v1/queries", content="{}", headers={"Content-Type": "application/json", IDENTITY_HEADER: self.fresh()}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.spy.calls, [])

    def test_identity_key_must_be_independent(self) -> None:
        shared = secrets.token_hex(32)
        for env in (
            {TOKEN_VAR: shared, IDENTITY_KEY_VAR: shared},
            {HMAC_KEY_ENV_VAR: shared, IDENTITY_KEY_VAR: shared},
            {IDENTITY_KEY_VAR: secrets.token_hex(8)},
            {IDENTITY_KEY_VAR: "zz" * 32},
        ):
            base = {ENV_VAR: "development", TOKEN_VAR: secrets.token_hex(32), HMAC_KEY_ENV_VAR: secrets.token_hex(32)}
            with self.subTest(keys=sorted(env)), self.assertRaises(ServiceConfigError) as ctx:
                load_service_settings({**base, **env})
            self.assertNotIn(env[IDENTITY_KEY_VAR], str(ctx.exception))
        self.assertNotIn(self.key_hex, repr(self.settings))
