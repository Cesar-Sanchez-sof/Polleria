"""Configuración y capa HTTP propias de agents-service (despliegue en Render): sin red ni base de datos."""

from __future__ import annotations

import json
import secrets
import tempfile
import time
from pathlib import Path

from guards import GuardedTestCase
from starlette.testclient import TestClient
from test_gemini_sql_agent import ALLOWLIST, GOOD_SQL, NAMES, NOW, QUESTION, ROWS, ConfigTests, FakeGemini, as_json
from test_identity import claims, sign
from test_postgres_executor import Factory, FakeConnection, VALIDATOR

from agents_service.auth.identity import IDENTITY_HEADER
from agents_service.config.settings import (
    ALLOWED_HOSTS_VAR,
    ALLOWED_USERS_VAR,
    IDENTITY_KEY_VAR,
    TOKEN_VAR,
    ServiceConfigError,
    load_service_settings,
    read_dotenv_keys,
)
from agents_service.execution.postgres_readonly import PostgresReadOnlyExecutor
from agents_service.gemini_sql.agent import GeminiSqlAgent
from agents_service.gemini_sql.config import GeminiSqlConfigError
from agents_service.http.app import create_app
from agents_service.http.routes import TOKEN_HEADER

GROQ_KEY = "gsk_" + "y" * 40


def base_env(**extra: str) -> dict[str, str]:
    return {
        TOKEN_VAR: secrets.token_hex(32),
        IDENTITY_KEY_VAR: secrets.token_hex(32),
        "AI_GEMINI_SQL": "1",
        "GEMINI_API_KEY": ConfigTests.KEY,
        "DATABASE_URL_READONLY": ConfigTests.DSN,
        **extra,
    }


class SettingsTests(GuardedTestCase):
    def test_render_defaults(self) -> None:
        settings = load_service_settings(base_env(PORT="10000"))
        self.assertEqual((settings.host, settings.port), ("0.0.0.0", 10000))  # dentro del contenedor
        self.assertIsNotNone(settings.gemini)
        self.assertIsNone(settings.groq)
        self.assertIsNone(settings.allowed_hosts)
        self.assertIsNone(settings.eval_allowed_user_ids)

    def test_both_agents_and_optional_restrictions(self) -> None:
        env = base_env(
            AI_GROQ_SQL="1", GROQ_API_KEY=GROQ_KEY, **{ALLOWED_HOSTS_VAR: "a.onrender.com, *.example.com", ALLOWED_USERS_VAR: "1, 2"}
        )
        settings = load_service_settings(env)
        self.assertIsNotNone(settings.groq)
        self.assertEqual(settings.allowed_hosts, ("a.onrender.com", "*.example.com"))
        self.assertEqual(settings.eval_allowed_user_ids, frozenset({1, 2}))

    def test_secrets_never_appear_in_repr(self) -> None:
        env = base_env()
        text = repr(load_service_settings(env))
        for secret in (env[TOKEN_VAR], env[IDENTITY_KEY_VAR], ConfigTests.KEY, "clave_ficticia", "db-ficticia"):
            self.assertNotIn(secret, text)

    def test_fail_closed(self) -> None:
        shared = secrets.token_hex(32)
        no_agent = {k: v for k, v in base_env().items() if k != "AI_GEMINI_SQL"}
        cases = {
            "sin-token": {k: v for k, v in base_env().items() if k != TOKEN_VAR},
            "token-corto": base_env(**{TOKEN_VAR: secrets.token_hex(8)}),
            "token-no-hex": base_env(**{TOKEN_VAR: "zz" * 32}),
            "sin-identidad": {k: v for k, v in base_env().items() if k != IDENTITY_KEY_VAR},
            "identidad-corta": base_env(**{IDENTITY_KEY_VAR: secrets.token_hex(8)}),
            "identidad-igual-al-token": base_env(**{TOKEN_VAR: shared, IDENTITY_KEY_VAR: shared}),
            "ningun-agente": no_agent,
            "puerto-invalido": base_env(PORT="99999"),
            "host-invalido": base_env(AGENTS_SERVICE_HOST="a b"),
            "hosts-invalidos": base_env(**{ALLOWED_HOSTS_VAR: "http://x"}),
            "usuarios-invalidos": base_env(**{ALLOWED_USERS_VAR: "uno"}),
        }
        for name, env in cases.items():
            with self.subTest(case=name), self.assertRaises((ServiceConfigError, GeminiSqlConfigError)) as ctx:
                load_service_settings(env)
            for secret in (env.get(TOKEN_VAR), env.get(IDENTITY_KEY_VAR), ConfigTests.KEY):
                if secret:
                    self.assertNotIn(secret, str(ctx.exception))

    def test_agent_enabled_without_its_key_or_database_fails(self) -> None:
        for name, env in {
            "gemini-sin-clave": {k: v for k, v in base_env().items() if k != "GEMINI_API_KEY"},
            "gemini-sin-bd": {k: v for k, v in base_env().items() if k != "DATABASE_URL_READONLY"},
            "groq-sin-clave": base_env(AI_GROQ_SQL="1"),
        }.items():
            with self.subTest(case=name), self.assertRaises(GeminiSqlConfigError):
                load_service_settings(env)

    def test_dotenv_is_limited_to_known_keys_and_the_environment_wins(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".env"
            path.write_text(
                "\n".join(
                    [
                        "# comentario",
                        f'{TOKEN_VAR}="{secrets.token_hex(32)}"',
                        f"{IDENTITY_KEY_VAR}={secrets.token_hex(32)}",
                        f"GEMINI_API_KEY={ConfigTests.KEY}",
                        f"DATABASE_URL_READONLY={ConfigTests.DSN}",
                        "DATABASE_URL=postgresql://no-debe-leerse",
                        "OTRA=valor",
                    ]
                ),
                encoding="utf-8",
            )
            keys = read_dotenv_keys(path)
            self.assertNotIn("DATABASE_URL", keys)
            self.assertNotIn("OTRA", keys)
            settings = load_service_settings({"AI_GEMINI_SQL": "1"}, dotenv_path=path)
            self.assertIsNotNone(settings.gemini)
            other = secrets.token_hex(32)
            self.assertEqual(load_service_settings({"AI_GEMINI_SQL": "1", TOKEN_VAR: other}, dotenv_path=path).internal_token, other)


class ServiceHttpTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.env = base_env(AI_GROQ_SQL="1", GROQ_API_KEY=GROQ_KEY)
        self.settings = load_service_settings(self.env)
        self.gemini = FakeGemini(as_json(GOOD_SQL))
        executor = PostgresReadOnlyExecutor(
            Factory(FakeConnection(rows=ROWS, names=NAMES)), VALIDATOR, accepted_origins=frozenset({"erp-session"})
        )
        self.agent = GeminiSqlAgent(self.gemini, ALLOWLIST, VALIDATOR, executor, clock=lambda: NOW)

    def client(self, settings=None, **kwargs) -> TestClient:
        client = TestClient(create_app(settings or self.settings, self.agent), raise_server_exceptions=False, **kwargs)
        self.addCleanup(client.close)
        return client

    def post(self, client: TestClient, *, user_id: int = 7, key_hex: str | None = None):
        now = int(time.time())
        body = {"id_traza": "erp-0123456789abcdef", "usuario": {"id": user_id, "rol": "contador_demo"}, "mensaje": QUESTION,
                "contexto": None, "historial": [], "fecha_referencia_lima": "2026-10-26"}
        identity = sign(claims(iat=now, exp=now + 60, sub=str(user_id), jti="erp-0123456789abcdef"), key=bytes.fromhex(key_hex or self.env[IDENTITY_KEY_VAR]))
        headers = {"Content-Type": "application/json", TOKEN_HEADER: self.settings.internal_token, IDENTITY_HEADER: identity}
        return client.post("/v1/agent/queries", content=json.dumps(body), headers=headers)

    def test_health_is_public_and_minimal(self) -> None:
        response = self.client().get("/v1/health")
        self.assertEqual((response.status_code, response.json()), (200, {"estado": "ok"}))
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")

    def test_works_from_any_host_when_hosts_are_not_restricted(self) -> None:
        # En Render la cabecera Host es el dominio público del servicio, no 127.0.0.1.
        client = self.client(base_url="https://polleria-agents.onrender.com")
        response = self.post(client)
        self.assertEqual((response.status_code, response.json()["estado"]), (200, "respondida"))

    def test_allowed_hosts_restricts_the_host_header(self) -> None:
        settings = load_service_settings({**self.env, ALLOWED_HOSTS_VAR: "polleria-agents.onrender.com"})
        good = self.client(settings, base_url="https://polleria-agents.onrender.com")
        bad = self.client(settings, base_url="https://otro.example.com")
        self.assertEqual(good.get("/v1/health").status_code, 200)
        response = bad.get("/v1/health")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_wrong_identity_key_is_rejected(self) -> None:
        response = self.post(self.client(), key_hex=secrets.token_hex(32))
        self.assertEqual((response.status_code, response.json()), (401, {"error": "No autorizado.", "errores": []}))
        self.assertEqual(self.gemini.calls, [])

    def test_allowed_user_ids_return_403_for_other_accounts(self) -> None:
        settings = load_service_settings({**self.env, ALLOWED_USERS_VAR: "7"})
        client = self.client(settings)
        self.assertEqual(self.post(client, user_id=7).status_code, 200)
        denied = self.post(client, user_id=8)
        self.assertEqual((denied.status_code, denied.json()["error"]), (403, "Acceso no permitido."))

    def test_oversized_and_non_json_bodies(self) -> None:
        client = self.client()
        headers = {TOKEN_HEADER: self.settings.internal_token}
        self.assertEqual(client.post("/v1/agent/queries", content="x", headers={**headers, "Content-Type": "text/plain"}).status_code, 415)
        big = json.dumps({"x": "a" * (self.settings.max_body_bytes + 1)})
        self.assertEqual(client.post("/v1/agent/queries", content=big, headers={**headers, "Content-Type": "application/json"}).status_code, 413)
        self.assertEqual(client.post("/v1/agent/queries", content="{no json", headers={**headers, "Content-Type": "application/json"}).status_code, 400)

    def test_docs_and_unknown_routes_are_hidden(self) -> None:
        client = self.client()
        for path in ("/docs", "/redoc", "/openapi.json", "/v1/queries", "/"):
            with self.subTest(path=path):
                response = client.get(path)
                self.assertEqual((response.status_code, response.json()["error"]), (404, "Recurso no encontrado."))
        self.assertEqual(client.post("/v1/queries", content="{}", headers={"Content-Type": "application/json"}).status_code, 404)
        self.assertEqual(client.post("/v1/health").status_code, 405)
