"""Pruebas de integración y seguridad de la API HTTP de desarrollo (T028, T029).

Usan el ``TestClient`` de Starlette (transporte en proceso, sin servidor ni red). Las barreras de
aislamiento siguen activas: en Windows, el bucle de ``asyncio`` usa el ``socketpair`` interno
acotado de ``guards``; cualquier otra conexión haría fallar la prueba. Datos solo ficticios.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from decimal import Decimal

from guards import GuardedTestCase

from starlette.testclient import TestClient

from ai_service.assembly import build_dev_orchestrator
from ai_service.audit.masking import HMAC_KEY_ENV_VAR
from ai_service.config.settings import ENV_VAR, TOKEN_VAR, load_service_settings
from ai_service.http.app import create_app
from ai_service.http.routes import TOKEN_HEADER
from ai_service.llm.budget import BudgetPolicy
from ai_service.orchestrator.prefilter import ALLOW
from pipeline_support import audit_clear_text, build_harness

NOW = datetime(2026, 10, 12, 17, 0, tzinfo=timezone.utc)
SECURITY_HEADERS = {"cache-control": "no-store", "x-content-type-options": "nosniff"}


def make_settings():
    return load_service_settings(
        {ENV_VAR: "development", TOKEN_VAR: secrets.token_hex(32), HMAC_KEY_ENV_VAR: secrets.token_hex(32)}
    )


class SpyOrchestrator:
    """Envuelve un orquestador y cuenta las invocaciones."""

    def __init__(self, inner) -> None:
        self.inner = inner
        self.calls = 0

    def handle(self, payload):
        self.calls += 1
        return self.inner.handle(payload)


def payload(mensaje: str, **overrides) -> dict:
    body = {
        "id_traza": "traza-http-0001",
        "usuario": {"id": 7, "rol": "contador_demo"},
        "mensaje": mensaje,
        "contexto": None,
        "historial": [],
        "fecha_referencia_lima": "2026-10-12",
    }
    body.update(overrides)
    return body


class ApiTestCase(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.settings = make_settings()
        orchestrator, self.audit = build_dev_orchestrator(self.settings, clock=lambda: NOW)
        self.spy = SpyOrchestrator(orchestrator)
        self.client = self.make_client(self.spy)

    def make_client(self, orchestrator, base_url: str = "http://127.0.0.1") -> TestClient:
        client = TestClient(create_app(self.settings, orchestrator), base_url=base_url, raise_server_exceptions=False)
        self.addCleanup(client.close)
        return client

    def headers(self, **extra: str) -> dict[str, str]:
        return {TOKEN_HEADER: self.settings.internal_token, "Content-Type": "application/json", **extra}

    def post(self, body, headers=None, client=None):
        data = body if isinstance(body, (bytes, str)) else json.dumps(body, ensure_ascii=False)
        return (client or self.client).post("/v1/queries", content=data, headers=headers or self.headers())

    def assert_security_headers(self, response) -> None:
        for name, value in SECURITY_HEADERS.items():
            self.assertEqual(response.headers.get(name), value)

    def assert_no_token(self, response) -> None:
        self.assertNotIn(self.settings.internal_token, response.text)
        self.assertNotIn(self.settings.internal_token, str(dict(response.headers)))


class HealthAndDocsTests(ApiTestCase):
    def test_health(self) -> None:
        response = self.client.get("/v1/health")
        self.assertEqual((response.status_code, response.json()), (200, {"estado": "ok"}))
        self.assert_security_headers(response)

    def test_documentation_is_disabled(self) -> None:
        for path in ("/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json(), {"error": "Recurso no encontrado.", "errores": []})
                self.assert_security_headers(response)

    def test_method_not_allowed_is_generic(self) -> None:
        response = self.client.get("/v1/queries")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json()["error"], "Método no permitido.")


class QueryTests(ApiTestCase):
    def test_valid_query_returns_ct_b_response(self) -> None:
        response = self.post(payload("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["estado"], "respondida")
        figures = {f["marcador"]: Decimal(f["valor"]) for f in body["cifras"]}
        self.assertEqual(figures, {"c1": Decimal("1149.60"), "c2": Decimal("1800.00"), "c3": Decimal("650.40")})
        self.assertIn("S/ 1,149.60", body["texto"])
        self.assertIn("%(", body["evidencias"][0]["plantilla_sql"])  # sin literales en la evidencia
        self.assert_security_headers(response)
        self.assert_no_token(response)
        self.assertGreaterEqual(self.internal_socketpairs, 1)  # transporte compatible con las barreras

    def test_no_data(self) -> None:
        body = self.post(payload("Saldo de caja en julio")).json()
        self.assertEqual((body["estado"], body["cifras"]), ("sin_datos", []))

    def test_invalid_json_and_contract_errors_are_400_without_echo(self) -> None:
        marker = "MARCADOR_DE_ENTRADA_FICTICIO"
        cases = {
            "json-invalido": "{" + marker,
            "campo-extra": json.dumps(payload("Saldo de caja", extra=marker)),
            "tipo-invalido": json.dumps(payload("Saldo de caja", usuario={"id": marker, "rol": "contador_demo"})),
            "ruta-no-habilitada": json.dumps(
                payload("Saldo de caja", contexto={"ruta": "/accounting/guide", "filtros": {}, "x": marker})
            ),
        }
        for name, data in cases.items():
            with self.subTest(case=name):
                response = self.post(data)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"], "La solicitud no es válida.")
                self.assertNotIn(marker, response.text)
                self.assert_security_headers(response)

    def test_non_utf8_body_is_400(self) -> None:
        response = self.post(b"\xff\xfe\x00")
        self.assertEqual(response.status_code, 400)

    def test_forbidden_role_is_403(self) -> None:
        response = self.post(payload("Saldo de caja en septiembre", usuario={"id": 7, "rol": "admin"}))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "No tienes permisos para usar el asistente financiero.")


class AuthenticationTests(ApiTestCase):
    def test_missing_or_wrong_token_never_reaches_the_orchestrator(self) -> None:
        cases = {
            "sin-token": {"Content-Type": "application/json"},
            "token-incorrecto": {TOKEN_HEADER: secrets.token_hex(32), "Content-Type": "application/json"},
            "prefijo": {TOKEN_HEADER: self.settings.internal_token[:-2], "Content-Type": "application/json"},
            "vacio": {TOKEN_HEADER: "", "Content-Type": "application/json"},
        }
        for name, headers in cases.items():
            with self.subTest(case=name):
                response = self.post(payload("Saldo de caja en septiembre"), headers=headers)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json(), {"error": "No autorizado.", "errores": []})
                self.assert_security_headers(response)
                self.assert_no_token(response)
        self.assertEqual(self.spy.calls, 0)

    def test_wrong_content_type_and_oversized_body_never_reach_the_orchestrator(self) -> None:
        response = self.post(payload("Saldo de caja"), headers=self.headers(**{"Content-Type": "text/plain"}))
        self.assertEqual(response.status_code, 415)
        oversized = json.dumps(payload("Saldo de caja " + "x" * (self.settings.max_body_bytes + 10)))
        response = self.post(oversized)
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"], "La solicitud es demasiado grande.")
        self.assertEqual(self.spy.calls, 0)


class HostTests(ApiTestCase):
    def test_untrusted_host_headers_are_rejected(self) -> None:
        for base_url in ("http://evil.example", "http://localhost", "http://0.0.0.0"):
            with self.subTest(host=base_url):
                client = self.make_client(self.spy, base_url=base_url)
                response = client.post("/v1/queries", content=json.dumps(payload("Saldo de caja")), headers=self.headers())
                self.assertEqual(response.status_code, 400)
                self.assert_security_headers(response)
        self.assertEqual(self.spy.calls, 0)


class FailureTests(ApiTestCase):
    def test_budget_exhausted_is_503_without_economic_details(self) -> None:
        policy = BudgetPolicy(
            monthly_limit=Decimal("0"),
            max_input_tokens={"interpretar": 2000, "explicar": 1000},
            max_output_tokens={"interpretar": 300, "explicar": 400},
            require_external_verification=False,
        )
        orchestrator, _ = build_dev_orchestrator(self.settings, clock=lambda: NOW, budget_policy=policy)
        response = self.post(payload("Saldo de caja en septiembre"), client=self.make_client(orchestrator))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"], "El asistente no está disponible en este momento. Intenta más tarde.")
        for word in ("presupuesto", "costo", "budget", "S/", "USD"):
            self.assertNotIn(word, response.text)

    def test_security_incident_is_503_generic(self) -> None:
        harness = build_harness(prefilter_fn=lambda _r: ALLOW)  # prefiltro defectuoso simulado (B3)
        response = self.post(
            payload("Saldo de caja en septiembre del DNI 45871236"), client=self.make_client(harness.orchestrator)
        )
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("45871236", response.text)
        self.assertEqual(harness.provider.calls, [])

    def test_unexpected_error_is_500_without_details(self) -> None:
        class BrokenOrchestrator:
            def handle(self, _payload):
                raise RuntimeError("detalle interno secreto en C:/ruta/privada")

        response = self.post(payload("Saldo de caja en septiembre"), client=self.make_client(BrokenOrchestrator()))
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"error": "Error interno del servicio.", "errores": []})
        for leak in ("detalle", "RuntimeError", "Traceback", "ruta/privada"):
            self.assertNotIn(leak, response.text)
        self.assert_security_headers(response)


class LeakageTests(ApiTestCase):
    def test_sensitive_question_is_blocked_and_not_leaked(self) -> None:
        response = self.post(payload("Pagos del cliente con DNI 45871236 en septiembre"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["estado"], "no_resoluble")
        self.assertNotIn("45871236", response.text)
        self.assertNotIn("45871236", audit_clear_text(self.audit.records[-1]))

    def test_audit_traces_have_no_clear_figures_or_question(self) -> None:
        self.post(payload("¿Cuál fue el saldo de caja en septiembre?"))
        clear_text = audit_clear_text(self.audit.records[-1])
        for secret in ("1149.60", "1,149.60", "1800", "650.40", "caja", "septiembre", self.settings.internal_token):
            self.assertNotIn(secret, clear_text)
