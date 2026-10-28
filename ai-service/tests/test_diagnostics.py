"""P0: errores identificables, traza técnica y log por consulta (sin respuestas preparadas).

Simulados: Modelo 1 (``MockLlmProvider``), servicio de inferencia (``httpx.MockTransport``) y Executor
ficticio. Reales: prefiltro, SQL Validator, motor financiero, auditoría y API FastAPI.
"""

from __future__ import annotations

import json
import secrets
import time

from starlette.testclient import TestClient

from guards import GuardedTestCase
from pipeline_support import build_harness, make_policy, request
from sqlgen_support import build_xiyan, payload

from ai_service.config.settings import DIAGNOSTICS_VAR, IDENTITY_KEY_VAR, ServiceConfigError, load_service_settings
from ai_service.finance.engine import FinanceEngineError
from ai_service.http.app import create_app
from ai_service.http.routes import DIAGNOSTICS_HEADER, TOKEN_HEADER
from ai_service.orchestrator.pipeline import ErrorBody, REASON_TEXTS, TEXTS
from sqlgen_support import xiyan_env
from test_identity import sign

QUESTION = "¿Cuál fue el saldo de caja en septiembre?"
ADAPTER = "xiyansql_v17_json_v10_balanced_full"
REJECTED_SQL = (
    "SELECT aa.code, aa.type, SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit "
    "FROM journal_entry_detail jed JOIN accounting_account aa ON aa.id = jed.account_id "
    "JOIN journal_entry je ON je.id = jed.entry_id JOIN app_user u ON u.id = je.id "
    "WHERE aa.code = '101' GROUP BY aa.code, aa.type"
)
ALL_STAGES = [
    "prefiltro", "interpretacion", "plan", "recuperacion", "generacion_sql", "validacion_sql", "ejecucion_sql",
    "calculo", "explicacion",
]


class TraceTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.orchestrator, self.audit, self.server, self.settings = build_xiyan()

    def test_trace_shows_the_real_model_invocation(self) -> None:
        outcome = self.orchestrator.handle(payload(QUESTION), diagnostics=True)
        self.assertEqual(outcome.body.estado, "respondida")
        trace = outcome.body.diagnostico
        self.assertEqual([s.etapa for s in trace.etapas], ALL_STAGES)
        self.assertTrue(all(s.estado == "ok" for s in trace.etapas))
        # Lo informa el servicio de inferencia en su respuesta, no la configuración local.
        model = trace.modelo_sql
        self.assertEqual((model.adaptador, model.latencia_ms, model.tokens_prompt, model.tokens_salida),
                         (ADAPTER, 1200, 640, 90))
        self.assertEqual(model.base, "XGenerationLab/XiYanSQL-QwenCoder-7B-2504")
        self.assertIn("journal_entry_detail", trace.sql_generado)
        self.assertIn("status", trace.sql_validado)  # filtro P-4 añadido y revalidado
        self.assertEqual((trace.filas, trace.cuenta, str(trace.periodo.desde)), (1, "101", "2026-09-01"))
        self.assertEqual(trace.intencion, "consulta_financiera")

    def test_trace_is_not_attached_unless_requested(self) -> None:
        outcome = self.orchestrator.handle(payload(QUESTION))
        self.assertIsNone(outcome.body.diagnostico)
        self.assertIsNotNone(outcome.trace)  # se calcula igual para el log
        self.assertEqual(outcome.trace.modelo_sql.adaptador, ADAPTER)

    def test_trace_never_contains_prompt_question_or_figures(self) -> None:
        outcome = self.orchestrator.handle(payload(QUESTION), diagnostics=True)
        dumped = outcome.body.diagnostico.model_dump_json()
        for leak in ("〖", "saldo de caja", "1149.60", "1800.00", "650.40", self.settings.sqlgen.token):
            self.assertNotIn(leak, dumped)

    def test_rejected_sql_is_reported_with_its_reasons(self) -> None:
        self.server.text_for = lambda _b: REJECTED_SQL
        outcome = self.orchestrator.handle(payload(QUESTION), diagnostics=True)
        self.assertEqual((outcome.status_code, outcome.body.estado), (200, "no_resoluble"))
        self.assertEqual(outcome.body.texto, REASON_TEXTS["SQL_REJECTED"])
        trace = outcome.body.diagnostico
        self.assertIn("app_user", trace.sql_generado)  # lo que generó el modelo, aunque se rechazara
        self.assertIsNone(trace.sql_validado)
        self.assertTrue(trace.motivos_rechazo)
        self.assertEqual(trace.etapas[-1].etapa, "validacion_sql")
        self.assertEqual((trace.etapas[-1].estado, trace.etapas[-1].codigo), ("fallo", "SQL_REJECTED"))
        self.assertEqual(outcome.body.cifras, [])

    def test_missing_period_and_account_say_what_is_missing(self) -> None:
        outcome = self.orchestrator.handle(payload("¿Cuál fue el saldo de caja?"), diagnostics=True)
        self.assertEqual(outcome.body.estado, "requiere_aclaracion")
        self.assertEqual(outcome.body.texto, REASON_TEXTS["MISSING_PERIOD"])
        self.assertIn("MISSING_PERIOD", outcome.audit.codigos_rechazo)
        self.assertIn("MISSING_ENTITIES", outcome.audit.codigos_rechazo)  # código previo conservado

        outcome = self.orchestrator.handle(payload("¿Cuánto gastamos en septiembre?", trace="traza-xiyan-0002"))
        self.assertEqual(outcome.body.texto, REASON_TEXTS["MISSING_ACCOUNT"])

    def test_generic_text_no_longer_suggests_a_fixed_question(self) -> None:
        self.assertNotIn("saldo de caja en septiembre", TEXTS["no_resoluble"])

    def test_uninterpretable_result_is_not_a_service_outage(self) -> None:
        class BrokenFinance:
            def compute(self, plan, rows):
                raise FinanceEngineError("Tipo de cuenta no reconocido.")

        self.orchestrator._finance = BrokenFinance()
        outcome = self.orchestrator.handle(payload(QUESTION), diagnostics=True)
        self.assertEqual((outcome.status_code, outcome.body.estado), (200, "no_resoluble"))
        self.assertEqual(outcome.body.texto, REASON_TEXTS["RESULT_NOT_INTERPRETABLE"])
        self.assertEqual((outcome.body.cifras, outcome.body.evidencias), ([], []))
        self.assertEqual(outcome.body.diagnostico.filas, 1)  # el SQL sí se ejecutó


class PublicErrorCodeTests(GuardedTestCase):
    def test_budget_codes_are_summarised(self) -> None:
        h = build_harness(policy=make_policy(monthly_limit="0"))
        outcome = h.orchestrator.handle(request("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertIsInstance(outcome.body, ErrorBody)
        self.assertEqual(outcome.body.errores, ["USAGE_LIMIT"])
        self.assertIn("BUDGET_EXHAUSTED", outcome.audit.codigos_rechazo)  # el detalle queda en la auditoría


class DiagnosticsApiTests(GuardedTestCase):
    def build(self, **env):
        key_hex = secrets.token_hex(32)
        orchestrator, _audit, server, settings = build_xiyan(**{IDENTITY_KEY_VAR: key_hex, **env})
        client = TestClient(create_app(settings, orchestrator), base_url="http://127.0.0.1")
        self.addCleanup(client.close)
        return client, settings, bytes.fromhex(key_hex), server

    def post(self, client, settings, key, *, trace: str, diagnostics: bool):
        now = int(time.time())
        identity = sign({"iss": "polleria-erp", "aud": "ai-service", "sub": "7", "rol": "contador_demo", "jti": trace,
                         "iat": now - 5, "exp": now + 55}, key=key)
        headers = {TOKEN_HEADER: settings.internal_token, "Content-Type": "application/json", "X-ERP-Identity": identity}
        if diagnostics:
            headers[DIAGNOSTICS_HEADER] = "1"
        raw = json.dumps(payload(QUESTION, trace=trace), ensure_ascii=False)
        return client.post("/v1/queries", content=raw, headers=headers)

    def test_trace_requires_configuration_identity_and_header(self) -> None:
        client, settings, key, _server = self.build()  # sin AI_SERVICE_DIAGNOSTICS
        response = self.post(client, settings, key, trace="traza-diag-0001", diagnostics=True)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("diagnostico", response.json())

        client, settings, key, _server = self.build(**{DIAGNOSTICS_VAR: "1"})
        response = self.post(client, settings, key, trace="traza-diag-0002", diagnostics=False)
        self.assertNotIn("diagnostico", response.json())
        response = self.post(client, settings, key, trace="traza-diag-0003", diagnostics=True)
        trace = response.json()["diagnostico"]
        self.assertEqual(trace["modelo_sql"]["adaptador"], ADAPTER)
        self.assertIn("journal_entry_detail", trace["sql_validado"])

    def test_every_query_leaves_a_json_log_line_without_literals(self) -> None:
        client, settings, key, _server = self.build()
        with self.assertLogs("ai_service.trace", level="INFO") as logs:
            self.post(client, settings, key, trace="traza-diag-0004", diagnostics=False)
        entry = json.loads(logs.records[-1].getMessage())
        self.assertEqual((entry["id_traza"], entry["estado"], entry["filas"]), ("traza-diag-0004", "respondida", 1))
        self.assertEqual(entry["modelo_sql"]["adaptador"], ADAPTER)
        self.assertEqual([s["etapa"] for s in entry["etapas"]], ALL_STAGES)
        line = logs.records[-1].getMessage()
        for leak in ("saldo de caja", "'101'", "2026-09-01", "1149.60", settings.internal_token):
            self.assertNotIn(leak, line)

    def test_diagnostics_setting_requires_verified_identity(self) -> None:
        with self.assertRaises(ServiceConfigError):
            load_service_settings(xiyan_env(**{DIAGNOSTICS_VAR: "1"}))
        with self.assertRaises(ServiceConfigError):
            load_service_settings(xiyan_env(**{DIAGNOSTICS_VAR: "si", IDENTITY_KEY_VAR: secrets.token_hex(32)}))
