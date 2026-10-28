"""Modo evaluación académica (AI_SERVICE_EVAL_MODE=1): modelos reales + Milvus, SOLO Executor ficticio.

Sin red ni modelos: XiYanSQL, OpenAI y Milvus simulados. La API sigue en 127.0.0.1 (el túnel HTTPS
del despliegue llega a ese puerto local) y exige la identidad firmada P-9 en cada solicitud.
"""

from __future__ import annotations

import json
import secrets
import time
from decimal import Decimal

from guards import GuardedTestCase
from sqlgen_support import NOW, FakeInferenceServer, payload, xiyan_env
from starlette.testclient import TestClient
from test_identity import sign
from test_openai_provider import FakeOpenAI, openai_env
from test_semantic_rag import CORPUS, TOKEN as ZILLIZ_TOKEN, FakeE5, FakeMilvus

from ai_service.assembly import build_dev_orchestrator
from ai_service.config.settings import (
    EVAL_MODE_VAR,
    EVAL_REAL_DATA_VAR,
    EVAL_USERS_VAR,
    IDENTITY_KEY_VAR,
    LLM_PROVIDER_VAR,
    LLM_TIMEOUT_VAR,
    RAG_APPROVED_CORPUS_VAR,
    RAG_MODE_VAR,
    READONLY_DSN_VAR,
    SQL_EXECUTOR_VAR,
    SQL_GENERATOR_VAR,
    SQLGEN_TIMEOUT_VAR,
    SQLGEN_TOKEN_VAR,
    ZILLIZ_TOKEN_VAR,
    ZILLIZ_URI_VAR,
    ServiceConfigError,
    load_service_settings,
)
from ai_service.http.app import create_app
from ai_service.http.routes import TOKEN_HEADER
from ai_service.knowledge.corpus import corpus_fingerprint
from ai_service.execution.postgres_readonly import READ_ONLY_CHECK, SESSION_STATEMENTS, PostgresReadOnlyExecutor
from ai_service.sqlgen.dev_fixtures import SaldoFixtureExecutor
from test_postgres_executor import Factory, FakeConnection


def eval_env(**overrides: str) -> dict[str, str]:
    env = {
        **xiyan_env(),
        **{k: v for k, v in openai_env().items() if k.startswith(("AI_LLM", "OPENAI"))},
        EVAL_MODE_VAR: "1",
        SQL_EXECUTOR_VAR: "ficticio",
        RAG_MODE_VAR: "milvus",
        ZILLIZ_URI_VAR: "https://in01-ficticio.zillizcloud.invalid",
        ZILLIZ_TOKEN_VAR: ZILLIZ_TOKEN,
        RAG_APPROVED_CORPUS_VAR: corpus_fingerprint(CORPUS),
        IDENTITY_KEY_VAR: secrets.token_hex(32),
        SQLGEN_TIMEOUT_VAR: "25",
        LLM_TIMEOUT_VAR: "10",
    }
    env.update(overrides)
    return {k: v for k, v in env.items() if v is not None}


class EvalSettingsTests(GuardedTestCase):
    def test_valid_profile_uses_real_models_milvus_and_fictitious_executor(self) -> None:
        settings = load_service_settings(eval_env())
        self.assertTrue(settings.eval_mode)
        self.assertEqual(
            (settings.sql_generator, settings.llm_provider, settings.rag.mode, settings.sql_executor),
            ("xiyansql", "openai", "milvus", "ficticio"),
        )
        self.assertIsNone(settings.readonly_dsn)
        self.assertIsNotNone(settings.identity_key)
        self.assertFalse(load_service_settings(xiyan_env()).eval_mode)  # por defecto, desactivado

    def test_erp_session_secret_is_neither_required_nor_read(self) -> None:
        # SESSION_SECRET es del login del ERP (Next.js); el servicio usa solo sus propias credenciales.
        marker = "secreto-de-sesion-del-erp-ficticio-0123456789"
        settings = load_service_settings(eval_env(SESSION_SECRET=marker))
        self.assertNotIn(marker, repr(settings))
        self.assertNotIn(marker, json.dumps({k: str(v) for k, v in vars(settings).items()}))

    def test_any_attempt_to_use_real_financial_data_fails_closed(self) -> None:
        dsn = "postgresql://lector:secreto-ficticio@db.invalid/erp"
        cases = {
            "executor real": {SQL_EXECUTOR_VAR: "postgres_readonly", READONLY_DSN_VAR: dsn},
            "executor no explícito": {SQL_EXECUTOR_VAR: None},
            "DSN en el entorno": {READONLY_DSN_VAR: dsn},
        }
        for name, overrides in cases.items():
            with self.subTest(caso=name), self.assertRaises(ServiceConfigError) as ctx:
                load_service_settings(eval_env(**overrides))
            self.assertNotIn("secreto-ficticio", str(ctx.exception))

    def test_profile_requires_real_models_milvus_identity_and_short_timeouts(self) -> None:
        cases = {
            "generador simulado": {SQL_GENERATOR_VAR: "simulado"},
            "Modelo 1 simulado": {LLM_PROVIDER_VAR: "simulado"},
            "RAG léxico": {RAG_MODE_VAR: "lexico"},
            "sin identidad P-9": {IDENTITY_KEY_VAR: None},
            "espera excesiva": {SQLGEN_TIMEOUT_VAR: "40"},
            "valor no reconocido": {EVAL_MODE_VAR: "true"},
        }
        for name, overrides in cases.items():
            with self.subTest(caso=name), self.assertRaises(ServiceConfigError) as ctx:
                load_service_settings(eval_env(**overrides))
            self.assertNotIn(ZILLIZ_TOKEN, str(ctx.exception))


class EvalAssemblyTests(GuardedTestCase):
    def build(self, env: dict[str, str]):
        settings = load_service_settings(env)
        openai, xiyan = FakeOpenAI(), FakeInferenceServer(env[SQLGEN_TOKEN_VAR])
        milvus = FakeMilvus()
        orchestrator, _audit = build_dev_orchestrator(
            settings,
            clock=lambda: NOW,
            sqlgen_transport=xiyan.transport(),
            llm_transport=openai.transport(),
            rag_embedder=FakeE5(),
            milvus_client_factory=lambda: milvus,
        )
        return settings, orchestrator, openai, xiyan

    def test_assembly_never_builds_the_real_executor(self) -> None:
        _settings, orchestrator, _openai, _xiyan = self.build(eval_env())
        self.assertIsInstance(orchestrator._executor, SaldoFixtureExecutor)
        with self.assertRaises(ValueError):
            build_dev_orchestrator(load_service_settings(eval_env()), readonly_connection_factory=lambda: None)

    def test_http_flow_requires_signed_identity_and_answers_with_fictitious_data(self) -> None:
        env = eval_env()
        settings, orchestrator, openai, xiyan = self.build(env)
        client = TestClient(create_app(settings, orchestrator), base_url="http://127.0.0.1", raise_server_exceptions=False)
        self.addCleanup(client.close)
        body = payload("¿Cuál fue el saldo de caja en septiembre?", trace="traza-eval-0001")
        headers = {TOKEN_HEADER: settings.internal_token, "Content-Type": "application/json"}
        raw = json.dumps(body, ensure_ascii=False)

        # Sin identidad firmada (P-9): 401 y ningún modelo se invoca.
        self.assertEqual(client.post("/v1/queries", content=raw, headers=headers).status_code, 401)
        self.assertEqual((len(openai.requests), len(xiyan.requests)), (0, 0))

        now = int(time.time())
        identity = sign(
            {"iss": "polleria-erp", "aud": "ai-service", "sub": "7", "rol": "contador_demo", "jti": "traza-eval-0001",
             "iat": now - 5, "exp": now + 55},
            key=bytes.fromhex(env[IDENTITY_KEY_VAR]),
        )
        response = client.post("/v1/queries", content=raw, headers={**headers, "X-ERP-Identity": identity})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["estado"], "respondida")
        figures = {f["marcador"]: Decimal(f["valor"]) for f in data["cifras"]}
        self.assertEqual(figures["c1"], Decimal("1149.60"))  # dataset ficticio
        self.assertNotIn("executor", data["versiones"])  # sin "postgres-readonly"
        self.assertEqual((len(xiyan.requests), [r["text"]["format"]["name"] for r in openai.requests]),
                         (1, ["interpretacion", "explicacion"]))


FAKE_DSN = "postgresql://lector_ficticio:clave-ficticia-eval@db.invalid/erp"
EVALUATOR_ID = 7  # el usuario de payload() en las pruebas


def real_env(**overrides: str) -> dict[str, str]:
    return eval_env(**{
        EVAL_REAL_DATA_VAR: "1",
        SQL_EXECUTOR_VAR: "postgres_readonly",
        READONLY_DSN_VAR: FAKE_DSN,
        EVAL_USERS_VAR: str(EVALUATOR_ID),
        SQLGEN_TIMEOUT_VAR: "20",
        LLM_TIMEOUT_VAR: "12",
        **overrides,
    })


def identity_for(env: dict[str, str], *, user_id: int, trace: str) -> str:
    now = int(time.time())
    return sign(
        {"iss": "polleria-erp", "aud": "ai-service", "sub": str(user_id), "rol": "contador_demo", "jti": trace,
         "iat": now - 5, "exp": now + 55},
        key=bytes.fromhex(env[IDENTITY_KEY_VAR]),
    )


class EvalRealDataSettingsTests(GuardedTestCase):
    def test_explicit_authorization_enables_the_readonly_executor(self) -> None:
        settings = load_service_settings(real_env(**{EVAL_USERS_VAR: "7, 12"}))
        self.assertEqual((settings.eval_mode, settings.eval_real_data, settings.sql_executor), (True, True, "postgres_readonly"))
        self.assertEqual(settings.eval_allowed_user_ids, frozenset({7, 12}))
        self.assertEqual(settings.readonly_dsn, FAKE_DSN)
        self.assertNotIn("clave-ficticia-eval", repr(settings))

    def test_real_data_is_closed_by_default_and_every_partial_combination_fails(self) -> None:
        cases = {
            "executor real sin autorización": {EVAL_REAL_DATA_VAR: None},
            "autorización con executor ficticio": {SQL_EXECUTOR_VAR: "ficticio", READONLY_DSN_VAR: None},
            "autorización sin cuentas evaluadoras": {EVAL_USERS_VAR: None},
            "cuentas evaluadoras inválidas": {EVAL_USERS_VAR: "admin"},
            "autorización fuera del modo evaluación": {EVAL_MODE_VAR: None},
            "sin conexión de solo lectura": {READONLY_DSN_VAR: None},
            "misma conexión que el ERP": {"DATABASE_URL": FAKE_DSN},
            "sin identidad P-9": {IDENTITY_KEY_VAR: None},
            "espera excesiva con la base": {SQLGEN_TIMEOUT_VAR: "25", LLM_TIMEOUT_VAR: "11"},
            "bandera no reconocida": {EVAL_REAL_DATA_VAR: "true"},
        }
        for name, overrides in cases.items():
            with self.subTest(caso=name), self.assertRaises(ServiceConfigError) as ctx:
                load_service_settings(real_env(**overrides))
            self.assertNotIn("clave-ficticia-eval", str(ctx.exception))

    def test_assembly_uses_the_readonly_executor_only_when_authorized(self) -> None:
        env = real_env()
        orchestrator, _audit = build_dev_orchestrator(
            load_service_settings(env), clock=lambda: NOW,
            sqlgen_transport=FakeInferenceServer(env[SQLGEN_TOKEN_VAR]).transport(),
            llm_transport=FakeOpenAI().transport(), rag_embedder=FakeE5(), milvus_client_factory=lambda: FakeMilvus(),
            readonly_connection_factory=Factory(),
        )
        self.assertIsInstance(orchestrator._executor, PostgresReadOnlyExecutor)


class EvalRealDataHttpTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.env = real_env()
        self.settings = load_service_settings(self.env)
        self.openai, self.xiyan = FakeOpenAI(), FakeInferenceServer(self.env[SQLGEN_TOKEN_VAR])
        self.connection = FakeConnection()
        self.factory = Factory(self.connection)
        orchestrator, _audit = build_dev_orchestrator(
            self.settings, clock=lambda: NOW, sqlgen_transport=self.xiyan.transport(),
            llm_transport=self.openai.transport(), rag_embedder=FakeE5(), milvus_client_factory=lambda: FakeMilvus(),
            readonly_connection_factory=self.factory,
        )
        self.client = TestClient(create_app(self.settings, orchestrator), base_url="http://127.0.0.1", raise_server_exceptions=False)
        self.addCleanup(self.client.close)

    def ask(self, *, user_id: int, trace: str, identity: bool = True):
        body = payload("¿Cuál fue el saldo de caja en septiembre?", trace=trace)
        body["usuario"]["id"] = user_id
        headers = {TOKEN_HEADER: self.settings.internal_token, "Content-Type": "application/json"}
        if identity:
            headers["X-ERP-Identity"] = identity_for(self.env, user_id=user_id, trace=trace)
        return self.client.post("/v1/queries", content=json.dumps(body, ensure_ascii=False), headers=headers)

    def test_evaluator_queries_through_readonly_transaction_with_p4(self) -> None:
        response = self.ask(user_id=EVALUATOR_ID, trace="traza-real-0001")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["estado"], "respondida")
        self.assertEqual(data["versiones"]["executor"], "postgres-readonly")
        self.assertEqual(self.connection.statements[: len(SESSION_STATEMENTS) + 1], [*SESSION_STATEMENTS, READ_ONLY_CHECK])
        executed = self.connection.statements[-1]
        self.assertTrue(executed.startswith("SELECT"))
        self.assertIn("je.status = TRUE", executed)  # P-4
        self.assertIn("LIMIT", executed)
        # La respuesta solo trae cifras verificadas y el detalle del cálculo, nunca filas ni columnas.
        self.assertEqual(sorted(f["marcador"] for f in data["cifras"]), ["c1", "c2", "c3"])
        for column in ("account_type", "total_debit", "description", "status"):
            self.assertNotIn(column, json.dumps({k: v for k, v in data.items() if k != "evidencias"}))

    def test_other_users_and_unsigned_requests_never_reach_models_or_database(self) -> None:
        self.assertEqual(self.ask(user_id=99, trace="traza-real-0002").status_code, 403)  # ADMIN no evaluador
        self.assertEqual(self.ask(user_id=EVALUATOR_ID, trace="traza-real-0003", identity=False).status_code, 401)
        self.assertEqual((len(self.openai.requests), len(self.xiyan.requests), self.factory.calls), (0, 0, 0))

    def test_unauthorized_sql_from_the_model_never_reaches_the_database(self) -> None:
        for name, sql in {
            "escritura": "DELETE FROM journal_entry_detail;",
            "DDL": "DROP TABLE journal_entry;",
            "tabla fuera de la allowlist": "SELECT username, password FROM app_user;",
            "varias sentencias": "SELECT 1; UPDATE journal_entry SET status = FALSE;",
        }.items():
            with self.subTest(caso=name):
                self.xiyan.text_for = lambda _body, sql=sql: sql
                response = self.ask(user_id=EVALUATOR_ID, trace=f"traza-real-{abs(hash(name)) % 10000:04d}")
                self.assertIn(response.status_code, (200, 503))
                self.assertNotEqual(response.json().get("estado"), "respondida")
        self.assertEqual(self.factory.calls, 0)
