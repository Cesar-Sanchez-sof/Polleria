"""Modelo 1 real (OpenAI Responses API) con una API SIMULADA: sin red ni llamadas facturables.

``FakeOpenAI`` responde con el formato de la Responses API sobre ``httpx.MockTransport``. La clave
es ficticia y generada en cada prueba; el archivo ``ai-service/.env`` real nunca se lee aquí.
"""

from __future__ import annotations

import json
import os
import secrets
import tempfile
from decimal import Decimal
from pathlib import Path

import httpx

from guards import GuardedTestCase
from sqlgen_support import NOW, payload

from ai_service.assembly import build_dev_orchestrator
from ai_service.audit.masking import HMAC_KEY_ENV_VAR
from ai_service.config.settings import (
    ENV_VAR,
    LLM_MAX_REQUEST_COST_VAR,
    LLM_MONTHLY_VAR,
    LLM_PRICE_IN_VAR,
    LLM_PRICE_OUT_VAR,
    LLM_PROVIDER_VAR,
    LLM_TIMEOUT_VAR,
    OPENAI_KEY_VAR,
    OPENAI_MODEL_VAR,
    TOKEN_VAR,
    ServiceConfigError,
    load_service_settings,
    read_dotenv_keys,
)
from ai_service.llm.budget import BudgetPolicy, ModelPrice
from ai_service.llm.openai_provider import OpenAiProviderError, OpenAiResponsesProvider
from ai_service.llm.provider import ExplainInput, InterpretInput, LlmRequest
from ai_service.http.schemas import Period

PRICE = ModelPrice(input_per_1k=Decimal("0.001"), output_per_1k=Decimal("0.004"))  # precios FICTICIOS
CATALOG = {"caja": "101", "bancos": "104"}
FIGURES = ("1149.60", "1,149.60", "1800", "650.40")


def fake_key() -> str:
    return "sk-test-" + secrets.token_hex(16)


def openai_env(**overrides: str) -> dict[str, str]:
    env = {
        ENV_VAR: "development",
        TOKEN_VAR: secrets.token_hex(32),
        HMAC_KEY_ENV_VAR: secrets.token_hex(32),
        LLM_PROVIDER_VAR: "openai",
        OPENAI_KEY_VAR: fake_key(),
        LLM_PRICE_IN_VAR: "0.001",
        LLM_PRICE_OUT_VAR: "0.004",
    }
    env.update(overrides)
    return env


class FakeOpenAI:
    """Responses API simulada: decide la salida según el esquema solicitado."""

    def __init__(self) -> None:
        self.requests: list[dict] = []
        self.headers: list[httpx.Headers] = []
        self.urls: list[str] = []
        self.interpretation = {"intencion": "consulta_financiera", "cuenta": "101", "indicador": None, "necesita_aclaracion": False}
        self.explanation = "Durante septiembre de 2026, los movimientos de Caja tuvieron un saldo neto de {{c1}}."
        self.override: httpx.Response | Exception | None = None

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)

    def handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        self.headers.append(request.headers)
        self.urls.append(str(request.url))
        if isinstance(self.override, Exception):
            raise self.override
        if self.override is not None:
            return self.override
        schema = body["text"]["format"]["name"]
        output = self.interpretation if schema == "interpretacion" else {"texto": self.explanation}
        properties = body["text"]["format"]["schema"]["properties"]
        if schema == "interpretacion":  # modo estricto: toda clave del esquema está presente
            defaults = {key: (False if spec.get("type") == "boolean" else None) for key, spec in properties.items()}
            output = {**defaults, **output}
        return httpx.Response(200, json=self.response(json.dumps(output, ensure_ascii=False)))

    @staticmethod
    def response(text: str, *, status: str = "completed", content_type: str = "output_text") -> dict:
        part = {"type": content_type, "text": text} if content_type == "output_text" else {"type": "refusal", "refusal": "no"}
        return {
            "id": "resp_ficticia",
            "status": status,
            "model": "gpt-6-luna-ficticio",
            "output": [{"type": "message", "role": "assistant", "content": [part]}],
            "usage": {"input_tokens": 420, "output_tokens": 35},
        }


def interpret_request(message: str = "¿Cuál fue el saldo de caja en septiembre?") -> LlmRequest:
    return LlmRequest(
        id_traza="traza-openai-0001", instrucciones_version="interpretar-v0",
        entrada=InterpretInput(tarea="interpretar", mensaje=message), esquema_salida="interpretar-salida-v0",
        max_tokens_entrada=1500, max_tokens_salida=300, timeout_ms=20000,
    )


def explain_request() -> LlmRequest:
    return LlmRequest(
        id_traza="traza-openai-0001", instrucciones_version="explicar-v0",
        entrada=ExplainInput(tarea="explicar", intencion="consulta_financiera",
                             periodo=Period.model_validate({"desde": "2026-09-01", "hasta": "2026-09-30"}, strict=False),
                             marcadores=["c1", "c2", "c3"]),
        esquema_salida="explicar-salida-v0", max_tokens_entrada=600, max_tokens_salida=400, timeout_ms=20000,
    )


class SettingsTests(GuardedTestCase):
    def test_simulated_provider_is_default(self) -> None:
        env = {ENV_VAR: "development", TOKEN_VAR: secrets.token_hex(32), HMAC_KEY_ENV_VAR: secrets.token_hex(32)}
        settings = load_service_settings(env)
        self.assertEqual((settings.llm_provider, settings.llm), ("simulado", None))

    def test_openai_configuration_hides_the_key(self) -> None:
        env = openai_env()
        settings = load_service_settings(env)
        self.assertEqual((settings.llm.model, settings.llm.monthly_limit, settings.llm.timeout_s), ("gpt-6-luna", Decimal("1.00"), 20))
        for text in (repr(settings), repr(settings.llm)):
            self.assertNotIn(env[OPENAI_KEY_VAR], text)
        self.assertLessEqual(settings.llm.worst_case_request_cost(), Decimal("0.02"))

    def test_dotenv_only_supplies_allowed_keys(self) -> None:
        key = fake_key()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text(
                f"# comentario\nOPENAI_API_KEY='{key}'\nOPENAI_MODEL=gpt-6-luna\n"
                "DATABASE_URL_READONLY=postgresql://x:y@h.invalid/db\n"
                "DATABASE_URL=postgresql://escritura:z@h.invalid/db\nOTRA=valor\n",
                encoding="utf-8",
            )
            # Nunca DATABASE_URL (conexión principal del ERP) ni otras variables.
            self.assertEqual(
                read_dotenv_keys(path),
                {OPENAI_KEY_VAR: key, OPENAI_MODEL_VAR: "gpt-6-luna", "DATABASE_URL_READONLY": "postgresql://x:y@h.invalid/db"},
            )
            env = {k: v for k, v in openai_env().items() if k != OPENAI_KEY_VAR}
            self.assertEqual(load_service_settings(env, dotenv_path=path).llm.api_key, key)
            # El entorno tiene prioridad sobre el archivo.
            other = fake_key()
            self.assertEqual(load_service_settings({**env, OPENAI_KEY_VAR: other}, dotenv_path=path).llm.api_key, other)

    def test_no_dotenv_is_read_unless_given(self) -> None:
        env = {k: v for k, v in openai_env().items() if k != OPENAI_KEY_VAR}
        with self.assertRaises(ServiceConfigError):
            load_service_settings(env)  # el .env real de ai-service no se consulta por defecto

    def test_invalid_configurations_never_echo_the_key(self) -> None:
        cases = {
            "sin-precio": {LLM_PRICE_IN_VAR: ""},
            "precio-negativo": {LLM_PRICE_OUT_VAR: "-1"},
            "clave-invalida": {OPENAI_KEY_VAR: "clave sin formato"},
            "limite-mensual-alto": {LLM_MONTHLY_VAR: "6"},
            "limite-mensual-cero": {LLM_MONTHLY_VAR: "0"},
            "coste-por-consulta": {LLM_PRICE_OUT_VAR: "0.5"},
            "timeout": {LLM_TIMEOUT_VAR: "120"},
            "modelo": {OPENAI_MODEL_VAR: "GPT 6 Luna!"},
            "proveedor": {LLM_PROVIDER_VAR: "anthropic"},
            "tope-por-consulta-bajo": {LLM_MAX_REQUEST_COST_VAR: "0.0001"},
        }
        for name, overrides in cases.items():
            with self.subTest(case=name):
                env = openai_env(**overrides)
                with self.assertRaises(ServiceConfigError) as ctx:
                    load_service_settings(env)
                self.assertNotIn(env[OPENAI_KEY_VAR], str(ctx.exception))


class ProviderTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.api = FakeOpenAI()
        self.key = fake_key()
        self.provider = OpenAiResponsesProvider(
            api_key=self.key, model="gpt-6-luna", price=PRICE, account_catalog=CATALOG, transport=self.api.transport()
        )
        self.addCleanup(self.provider.close)

    def test_interpret_request_and_structured_output(self) -> None:
        response = self.provider.complete(interpret_request())
        self.assertEqual((response.salida.intencion, response.salida.entidades.cuenta), ("consulta_financiera", "101"))
        self.assertEqual((response.tokens_entrada, response.tokens_salida), (420, 35))
        self.assertEqual(response.costo_estimado, PRICE.cost(420, 35))
        body = self.api.requests[0]
        self.assertEqual(self.api.urls[0], "https://api.openai.com/v1/responses")
        self.assertEqual(self.api.headers[0]["authorization"], f"Bearer {self.key}")
        self.assertEqual((body["model"], body["store"], body["max_output_tokens"]), ("gpt-6-luna", False, 300))
        self.assertEqual(body["text"]["format"]["type"], "json_schema")
        self.assertTrue(body["text"]["format"]["strict"])
        self.assertIn("caja=101", body["instructions"])
        self.assertNotIn("tarea", json.loads(body["input"]))
        self.assertNotIn("reasoning", body)

    def test_explain_request_carries_only_markers(self) -> None:
        response = self.provider.complete(explain_request())
        self.assertIn("{{c1}}", response.salida.texto)
        sent = json.loads(self.api.requests[0]["input"])
        # P1 añade el título de la consulta y los significados genéricos de los marcadores (sin cifras).
        self.assertEqual(set(sent), {"intencion", "periodo", "marcadores", "cuenta_nombre", "consulta", "significados"})
        self.assertEqual(sent["marcadores"], ["c1", "c2", "c3"])
        for figure in FIGURES:
            self.assertNotIn(figure, json.dumps(self.api.requests[0]))

    def test_reasoning_effort_is_optional(self) -> None:
        provider = OpenAiResponsesProvider(
            api_key=self.key, model="gpt-6-luna", price=PRICE, account_catalog=CATALOG,
            reasoning_effort="low", transport=self.api.transport(),
        )
        self.addCleanup(provider.close)
        provider.complete(interpret_request())
        self.assertEqual(self.api.requests[-1]["reasoning"], {"effort": "low"})

    def test_errors_are_fixed_codes_without_secrets(self) -> None:
        cases = {
            "INCOMPLETE_RESPONSE": httpx.Response(200, json=FakeOpenAI.response("{}", status="incomplete")),
            "REFUSAL": httpx.Response(200, json=FakeOpenAI.response("", content_type="refusal")),
            "INVALID_STRUCTURED_OUTPUT-json": httpx.Response(200, json=FakeOpenAI.response("no es json")),
            "INVALID_STRUCTURED_OUTPUT-campos": httpx.Response(200, json=FakeOpenAI.response(json.dumps({"intencion": "seguimiento"}))),
            "INVALID_STRUCTURED_OUTPUT-cuenta": httpx.Response(200, json=FakeOpenAI.response(json.dumps(
                {"intencion": "consulta_financiera", "cuenta": "caja", "indicador": None, "necesita_aclaracion": False}))),
            "MISSING_USAGE": httpx.Response(200, json={**FakeOpenAI.response("{}"), "usage": None}),
            "UNAUTHORIZED": httpx.Response(401, json={"error": {"message": "Incorrect API key sk-..."}}),
            "RATE_LIMITED_OR_NO_CREDIT": httpx.Response(429, json={"error": {"message": "quota"}}),
            "MODEL_NOT_FOUND": httpx.Response(404, json={"error": {"message": "model"}}),
            "HTTP_ERROR_STATUS": httpx.Response(500, text="traza interna"),
            "INVALID_RESPONSE": httpx.Response(200, content=b"<html>"),
            "RESPONSE_TOO_LARGE": httpx.Response(200, content=b"x" * (256 * 1024 + 1)),
            "TIMEOUT": httpx.ReadTimeout("lento"),
            "CONNECTION_FAILED": httpx.ConnectError("sin red"),
        }
        for name, override in cases.items():
            with self.subTest(case=name):
                self.api.override = override
                with self.assertRaises(OpenAiProviderError) as ctx:
                    self.provider.complete(interpret_request())
                self.assertEqual(ctx.exception.code, name.split("-")[0])
                self.assertIsNone(ctx.exception.__cause__)
                for secret in (self.key, "caja en septiembre"):
                    self.assertNotIn(secret, str(ctx.exception))
        self.assertNotIn(self.key, repr(self.provider))

    def test_proxy_environment_is_ignored(self) -> None:
        os.environ["HTTPS_PROXY"] = "http://203.0.113.1:3128"
        os.environ["ALL_PROXY"] = "http://203.0.113.1:3128"
        self.assertEqual(self.provider.complete(interpret_request()).salida.entidades.cuenta, "101")


class PipelineTests(GuardedTestCase):
    """Pipeline completo (generador y Executor simulados) con el Modelo 1 OpenAI simulado."""

    def build(self, budget_policy: BudgetPolicy | None = None):
        settings = load_service_settings(openai_env())
        api = FakeOpenAI()
        orchestrator, audit = build_dev_orchestrator(
            settings, clock=lambda: NOW, llm_transport=api.transport(), budget_policy=budget_policy
        )
        return orchestrator, audit, api, settings

    def test_answer_uses_engine_figures_and_never_sends_them(self) -> None:
        orchestrator, _audit, api, settings = self.build()
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual(outcome.body.estado, "respondida")
        self.assertEqual({f.marcador: f.valor for f in outcome.body.cifras},
                         {"c1": Decimal("1149.60"), "c2": Decimal("1800.00"), "c3": Decimal("650.40")})
        self.assertIn("S/ 1,149.60", outcome.body.texto)
        self.assertEqual(outcome.body.versiones["llm"], "openai:gpt-6-luna")
        self.assertEqual([r["text"]["format"]["name"] for r in api.requests], ["interpretacion", "explicacion"])
        explain_input = json.loads(api.requests[1]["input"])
        self.assertEqual((explain_input["marcadores"], explain_input["cuenta_nombre"]), (["c1"], "Caja"))
        self.assertIn("saldo NETO de los movimientos del período", api.requests[1]["instructions"])
        self.assertEqual(outcome.body.texto, "Durante septiembre de 2026, los movimientos de Caja tuvieron un saldo neto de S/ 1,149.60.")
        self.assertEqual([label.marcador for label in outcome.body.detalle.etiquetas], ["c1", "c2", "c3"])
        for request in api.requests:
            serialized = json.dumps(request, ensure_ascii=False)
            for figure in FIGURES:
                self.assertNotIn(figure, serialized)
            self.assertNotIn("SELECT", serialized)

    def test_invented_figures_in_explanation_are_discarded(self) -> None:
        orchestrator, _audit, api, _ = self.build()
        api.explanation = "El saldo neto es S/ 2,000.00 ({{c1}})."
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual(outcome.body.estado, "no_resoluble")
        self.assertIn("UNVERIFIED_QUANTITY", outcome.audit.codigos_rechazo)
        self.assertEqual(outcome.body.cifras, [])

    def test_sensitive_question_never_reaches_openai(self) -> None:
        orchestrator, _audit, api, _ = self.build()
        outcome = orchestrator.handle(payload("Saldo de caja del cliente con DNI 45871236"))
        self.assertEqual(outcome.body.estado, "no_resoluble")
        self.assertEqual(api.requests, [])

    def test_provider_failure_is_503(self) -> None:
        orchestrator, _audit, api, _ = self.build()
        api.override = httpx.Response(429, json={"error": {"message": "quota"}})
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual(outcome.status_code, 503)
        self.assertIn("MODEL_UNAVAILABLE", outcome.audit.codigos_rechazo)

    def test_budget_denial_happens_before_any_call(self) -> None:
        policy = BudgetPolicy(
            monthly_limit=Decimal("0.0001"),
            max_input_tokens={"interpretar": 1500, "explicar": 600},
            max_output_tokens={"interpretar": 300, "explicar": 400},
            require_external_verification=False,
        )
        orchestrator, _audit, api, _ = self.build(policy)
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual(outcome.status_code, 503)
        self.assertEqual(api.requests, [])
