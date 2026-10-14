"""Cliente HTTP del servicio de inferencia: clasificación de errores, *timeouts* y respuestas inválidas.

Transporte ``httpx.MockTransport`` en proceso: no se abre ningún socket. Las barreras de aislamiento
siguen activas y harían fallar cualquier conexión real.
"""

from __future__ import annotations

import secrets

import httpx

from guards import GuardedTestCase
from sqlgen_support import SQLGEN_URL, FakeInferenceServer

from ai_service.config.settings import SqlGenSettings
from ai_service.orchestrator.model_calls import ModelUnavailable
from ai_service.orchestrator.ports import (
    GenerationInputRejected,
    InvalidGeneratorOutput,
    SqlGenerationError,
    SqlGeneratorTimeout,
    SqlGeneratorUnavailable,
)
from ai_service.sqlgen.client import XiYanHttpClient
from ai_service.sqlgen.wire import MAX_RESPONSE_BYTES, TOKEN_HEADER

PROMPT = "PROMPT_FICTICIO_MARCADOR"


class ClientTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.token = secrets.token_hex(32)
        self.server = FakeInferenceServer(self.token)
        self.server.text_for = lambda _body: "SELECT 1;"
        self.config = SqlGenSettings(url=SQLGEN_URL, token=self.token, timeout_s=5)

    def client(self, transport: httpx.BaseTransport | None = None) -> XiYanHttpClient:
        client = XiYanHttpClient(self.config, transport=transport or self.server.transport())
        self.addCleanup(client.close)
        return client

    def assert_error(self, client: XiYanHttpClient, kind: type[SqlGenerationError], code: str) -> None:
        with self.assertRaises(SqlGenerationError) as ctx:
            client.generate(PROMPT)
        self.assertIs(type(ctx.exception), kind)
        self.assertEqual(ctx.exception.code, code)
        self.assertRegex(ctx.exception.code, r"^[A-Z_]{3,40}$")  # válido como código de auditoría
        self.assertNotIsInstance(ctx.exception, ModelUnavailable)  # categorías propias del Modelo 2
        for secret in (self.token, PROMPT, SQLGEN_URL):
            self.assertNotIn(secret, str(ctx.exception))
            self.assertNotIn(secret, repr(ctx.exception))
        self.assertIsNone(ctx.exception.__cause__)  # sin la excepción de httpx encadenada

    def test_success_sends_contract_and_token(self) -> None:
        result = self.client().generate(PROMPT)
        self.assertEqual((result.text, result.finish_reason), ("SELECT 1;", "stop"))
        sent = self.server.requests[0]
        self.assertEqual(
            set(sent), {"contract", "request_id", "profile", "adapter", "user_content", "max_new_tokens"}
        )
        self.assertEqual((sent["contract"], sent["profile"], sent["adapter"]), ("xiyan-sqlgen/1", "xiyan-json-v1.0", self.config.adapter))
        self.assertEqual(self.server.headers[0][TOKEN_HEADER], self.token)
        self.assertRegex(sent["request_id"], r"^[0-9a-f]{32}$")

    def test_timeouts_and_unavailability_are_distinct(self) -> None:
        def raiser(exc: Exception):
            def handler(request: httpx.Request) -> httpx.Response:
                raise exc
            return httpx.MockTransport(handler)

        cases = {
            "READ_TIMEOUT": (SqlGeneratorTimeout, httpx.ReadTimeout("lento")),
            "CONNECT_TIMEOUT": (SqlGeneratorTimeout, httpx.ConnectTimeout("lento")),
            "CONNECTION_FAILED": (SqlGeneratorUnavailable, httpx.ConnectError("rechazada")),
            "CONNECTION_FAILED-protocolo": (SqlGeneratorUnavailable, httpx.RemoteProtocolError("cortada")),
        }
        for name, (kind, exc) in cases.items():
            with self.subTest(case=name):
                self.assert_error(self.client(raiser(exc)), kind, name.split("-")[0])
                self.assertTrue(kind.transient)

    def test_error_statuses(self) -> None:
        cases = {
            "UNAUTHORIZED": (SqlGeneratorUnavailable, 401, {"error": "UNAUTHORIZED"}),
            "MODEL_LOADING": (SqlGeneratorUnavailable, 503, {"error": "MODEL_LOADING"}),
            "BUSY": (SqlGeneratorUnavailable, 503, {"error": "BUSY"}),
            "MODEL_ERROR": (SqlGeneratorUnavailable, 503, {"error": "MODEL_ERROR"}),
            "ADAPTER_MISMATCH": (SqlGeneratorUnavailable, 409, {"error": "ADAPTER_MISMATCH"}),
            "HTTP_ERROR_STATUS": (SqlGeneratorUnavailable, 500, {"detalle": "traza interna"}),
            "HTTP_ERROR_STATUS-redireccion": (SqlGeneratorUnavailable, 302, {}),
            "PROMPT_TOO_LONG": (GenerationInputRejected, 422, {"error": "PROMPT_TOO_LONG"}),
            "INVALID_REQUEST": (GenerationInputRejected, 400, {"error": "INVALID_REQUEST"}),
        }
        for name, (kind, status, body) in cases.items():
            with self.subTest(code=name):
                self.server.respond = lambda _b, s=status, j=body: httpx.Response(s, json=j)
                self.assert_error(self.client(), kind, name.split("-")[0])

    def test_wrong_token_is_rejected_by_server(self) -> None:
        self.server.token = secrets.token_hex(32)
        self.assert_error(self.client(), SqlGeneratorUnavailable, "UNAUTHORIZED")

    def test_invalid_responses_are_not_unavailability(self) -> None:
        cases = {
            "INVALID_RESPONSE-json": (InvalidGeneratorOutput, lambda b: httpx.Response(200, content=b"no es json")),
            "INVALID_RESPONSE-campo-extra": (InvalidGeneratorOutput, lambda b: self.server.ok(b, extra="x")),
            "INVALID_RESPONSE-finish": (InvalidGeneratorOutput, lambda b: self.server.ok(b, finish_reason="eos")),
            "INVALID_RESPONSE-tokens": (InvalidGeneratorOutput, lambda b: self.server.ok(b, output_tokens=-1)),
            "REQUEST_ID_MISMATCH": (InvalidGeneratorOutput, lambda b: self.server.ok(b, request_id=secrets.token_hex(16))),
            "RESPONSE_TOO_LARGE": (InvalidGeneratorOutput, lambda b: httpx.Response(200, content=b"x" * (MAX_RESPONSE_BYTES + 1))),
            "ADAPTER_MISMATCH": (
                SqlGeneratorUnavailable,
                lambda b: self.server.ok(b, adapter="xiyansql_v171_json_v10_semantic_full"),
            ),
        }
        for name, (kind, respond) in cases.items():
            with self.subTest(case=name):
                self.server.respond = respond
                self.assert_error(self.client(), kind, name.split("-")[0])

    def test_invalid_outgoing_request_is_not_sent(self) -> None:
        with self.assertRaises(GenerationInputRejected):
            self.client().generate("x" * 5000)
        self.assertEqual(self.server.requests, [])

    def test_client_ignores_proxy_environment(self) -> None:
        import os

        os.environ["HTTP_PROXY"] = "http://203.0.113.1:3128"  # dirección de documentación (TEST-NET-3)
        os.environ["ALL_PROXY"] = "http://203.0.113.1:3128"
        self.assertEqual(self.client().generate(PROMPT).text, "SELECT 1;")
