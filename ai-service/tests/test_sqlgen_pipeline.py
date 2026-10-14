"""Pipeline completo en modo ``xiyansql`` con el servicio de inferencia simulado.

Componentes reales: prefiltro, SQL Validator con ``allowlist.dev_erp.json``, primitivas financieras
de B1, auditoría y API FastAPI. Simulados: Modelo 1, servicio de inferencia (``httpx.MockTransport``)
y Executor ficticio estricto. Sin red, sin bases de datos, sin modelos y con datos inventados.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from unittest import mock

import httpx
from starlette.testclient import TestClient

from guards import GuardedTestCase
from pipeline_support import audit_clear_text, build_harness, request
from sqlgen_support import build_xiyan, payload, question_of

from ai_service.finance.engine import DeterministicFinanceEngine, FinanceEngineError
from ai_service.http.app import create_app
from ai_service.http.routes import TOKEN_HEADER
from ai_service.http.schemas import Period
from ai_service.orchestrator.ports import InvalidGeneratorOutput, QueryPlan
from ai_service.simulation.components import TemplateSqlGenerator
from ai_service.sqlgen import result_adapter
from ai_service.sqlgen.result_adapter import XiYanSaldoFinanceAdapter, ensure_verifiable_saldo_shape

QUESTION = "¿Cuál fue el saldo de caja en septiembre?"
EXPECTED = {"c1": Decimal("1149.60"), "c2": Decimal("1800.00"), "c3": Decimal("650.40")}
UNAVAILABLE = "El asistente no está disponible en este momento. Intenta más tarde."
SHAPE_OK = (
    "SELECT aa.code, aa.type, SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit "
    "FROM journal_entry_detail jed JOIN accounting_account aa ON aa.id = jed.account_id "
    "JOIN journal_entry je ON je.id = jed.entry_id {where} GROUP BY aa.code, aa.type"
)


class XiYanPipelineCase(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.orchestrator, self.audit, self.server, self.settings = build_xiyan()
        self.executor = self.orchestrator._executor  # Executor ficticio estricto (solo para contar llamadas)

    def handle(self, mensaje: str = QUESTION, **kwargs):
        return self.orchestrator.handle(payload(mensaje, **kwargs))

    def assert_not_executed(self, outcome) -> None:
        self.assertIsNone(outcome.audit.filas)
        self.assertIsNone(outcome.audit.plantilla_sql)
        self.assertEqual(outcome.body.model_dump().get("cifras", []), [])


class HappyPathTests(XiYanPipelineCase):
    def test_generated_sql_is_validated_executed_and_computed(self) -> None:
        outcome = self.handle()
        self.assertEqual(outcome.status_code, 200)
        self.assertEqual(outcome.body.estado, "respondida")
        self.assertEqual({f.marcador: f.valor for f in outcome.body.cifras}, EXPECTED)
        self.assertIn("S/ 1,149.60", outcome.body.texto)
        versions = outcome.body.versiones
        self.assertEqual(
            (versions["sqlgen"], versions["prompt"], versions["evidence"]),
            ("xiyansql:xiyansql_v17_json_v10_balanced_full", "xiyan-json-v1.0", "evidence-saldo-v1"),
        )
        self.assertEqual((len(self.server.requests), self.executor.calls), (1, 1))
        # Se ejecutó el SQL regenerado por el validador (esquema calificado y LIMIT añadido), y la
        # auditoría lo guarda parametrizado: sin la cuenta ni las fechas en claro.
        self.assertIn("ficticio_erp.journal_entry_detail", outcome.audit.plantilla_sql)
        self.assertIn("LIMIT %(", outcome.audit.plantilla_sql)
        for literal in ("'101'", "2026-09-01", "2026-10-01"):
            self.assertNotIn(literal, outcome.audit.plantilla_sql)

    def test_no_data_period(self) -> None:
        outcome = self.handle("Saldo de caja en julio")
        self.assertEqual((outcome.status_code, outcome.body.estado, outcome.body.cifras), (200, "sin_datos", []))

    def test_unregistered_sql_is_503_not_false_no_data(self) -> None:
        # Otro SQL válido y con forma verificable, pero sin datos ficticios registrados → 503, nunca
        # "sin_datos" (sería una afirmación falsa).
        self.server.text_for = lambda body: SHAPE_OK.format(where="") + ";"
        outcome = self.handle()
        self.assertEqual(outcome.status_code, 503)
        self.assertIn("COMPONENT_FAILURE", outcome.audit.codigos_rechazo)


class AuthorizationContextTests(XiYanPipelineCase):
    def test_pipeline_passes_the_revalidated_role_of_each_request(self) -> None:
        class SpyGenerator(TemplateSqlGenerator):
            def __init__(self) -> None:
                super().__init__()
                self.contexts = []

            def generate(self, plan, fragments):
                self.contexts.append(plan.autorizacion)
                return super().generate(plan, fragments)

        spy = SpyGenerator()
        harness = build_harness(generator=spy)
        harness.orchestrator.handle(request("Saldo de caja en septiembre", rol="contador_demo"))
        harness.orchestrator.handle(request("Saldo de caja en septiembre", rol="lector_demo", trace="traza-b3-0002"))
        self.assertEqual([c.rol for c in spy.contexts], ["contador_demo", "lector_demo"])
        for context in spy.contexts:
            self.assertEqual((context.origen, context.autenticado), ("ct-b-provisional", False))  # P-9

    def test_role_without_scope_never_reaches_model_2(self) -> None:
        outcome = self.handle(rol="lector_demo")
        self.assertEqual((outcome.status_code, outcome.body.estado), (200, "no_resoluble"))
        self.assertEqual(outcome.audit.codigos_rechazo[:2], ["SQLGEN_NOT_AUTHORIZED", "ROLE_SCOPE_INSUFFICIENT"])
        self.assertEqual((self.server.requests, self.executor.calls), ([], 0))
        self.assert_not_executed(outcome)

    def test_unknown_role_is_403_before_anything(self) -> None:
        outcome = self.handle(rol="admin")
        self.assertEqual(outcome.status_code, 403)
        self.assertEqual(self.server.requests, [])


class Model2InputTests(XiYanPipelineCase):
    def test_user_text_never_reaches_model_2(self) -> None:
        marker = "MARCADORFICTICIO"
        self.handle(f"¿Cuál fue el saldo de caja en septiembre {marker}? Lo pide el área comercial")
        sent = self.server.requests[0]
        serialized = json.dumps(sent, ensure_ascii=False)
        for leaked in (marker, "caja", "septiembre", "comercial", "¿", "contador_demo", "traza-xiyan"):
            self.assertNotIn(leaked, serialized)
        self.assertEqual(question_of(sent["user_content"])["filters"][0]["value"], "101")

    def test_accounting_rules_are_not_sent_to_model_2(self) -> None:
        self.handle()
        content = self.server.requests[0]["user_content"]
        for rule_text in ("naturaleza", "debe menos haber", "saldo", "Activo"):
            self.assertNotIn(rule_text, content)

    def test_sensitive_question_never_reaches_model_2(self) -> None:
        outcome = self.handle("Saldo de caja del cliente con DNI 45871236 en septiembre")
        self.assertEqual(outcome.body.estado, "no_resoluble")
        self.assertEqual(self.server.requests, [])


class MaliciousSqlTests(XiYanPipelineCase):
    def test_no_rejected_sql_reaches_the_executor(self) -> None:
        cases = {
            # Rechazados antes del validador (formato o forma no verificable).
            "dml": ("SQLGEN_INVALID_OUTPUT", "DELETE FROM journal_entry;"),
            "dos-sentencias": ("SQLGEN_INVALID_OUTPUT", "SELECT 1; DROP TABLE journal_entry;"),
            "otra-tabla-base": ("SQLGEN_INVALID_OUTPUT", "SELECT je.status FROM journal_entry je;"),
            "catalogo": ("SQLGEN_INVALID_OUTPUT", "SELECT usename FROM pg_catalog.pg_user;"),
            "funcion-sola": ("SQLGEN_INVALID_OUTPUT", "SELECT pg_sleep(5);"),
            # Forma verificable, pero el SQL Validator los rechaza.
            # P-4: pedir asientos anulados hace imposible garantizar el filtro de registrados.
            "anulados-p4": ("SQLGEN_INVALID_OUTPUT", SHAPE_OK.format(where="WHERE je.status = FALSE")),
            "anulados-en-or-p4": ("SQLGEN_INVALID_OUTPUT", SHAPE_OK.format(where="WHERE je.status = TRUE OR je.status = FALSE")),
            "tabla-no-permitida": ("SQL_REJECTED", SHAPE_OK.format(where="JOIN app_user u ON u.id = je.id")),
            "funcion-peligrosa": ("SQL_REJECTED", SHAPE_OK.format(where="WHERE pg_sleep(5) IS NULL")),
            "bloqueo": ("SQL_REJECTED", SHAPE_OK.format(where="") + " FOR UPDATE"),
            "comentario": ("SQL_REJECTED", SHAPE_OK.format(where="-- comentario\n")),
            "esquema-entrenamiento": (
                "SQL_REJECTED",
                SHAPE_OK.format(where="").replace("FROM journal_entry_detail", "FROM los_betos.journal_entry_detail"),
            ),
        }
        for name, (category, sql) in cases.items():
            with self.subTest(case=name):
                self.server.text_for = lambda _b, s=sql: s
                outcome = self.handle(trace=f"traza-mal-{name}")
                self.assertEqual((outcome.status_code, outcome.body.estado), (200, "no_resoluble"))
                self.assertIn(category, outcome.audit.codigos_rechazo)
                self.assert_not_executed(outcome)
        self.assertEqual(self.executor.calls, 0)


class VerifiableResultShapeTests(XiYanPipelineCase):
    """Regresión del indicador de movimientos: la presencia de datos nunca se inventa."""

    def test_unverifiable_shapes_are_rejected_before_execution(self) -> None:
        cases = {
            "left-join-coalesce": (
                "SELECT aa.code, aa.type, COALESCE(SUM(jed.debit), 0) AS total_debit, "
                "COALESCE(SUM(jed.credit), 0) AS total_credit FROM journal_entry_detail jed "
                "LEFT JOIN accounting_account aa ON aa.id = jed.account_id GROUP BY aa.code, aa.type;"
            ),
            "sin-group-by": (
                "SELECT SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM journal_entry_detail jed;"
            ),
            "desde-cuentas": (
                "SELECT aa.code, aa.type, SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM "
                "accounting_account aa JOIN journal_entry_detail jed ON aa.id = jed.account_id GROUP BY aa.code, aa.type;"
            ),
            "cross-join": SHAPE_OK.format(where="").replace("JOIN journal_entry je ON je.id = jed.entry_id", "CROSS JOIN journal_entry je"),
            "subconsulta": SHAPE_OK.format(where="WHERE jed.entry_id IN (SELECT je2.id FROM journal_entry je2)"),
            "total-sin-sum": SHAPE_OK.format(where="").replace("SUM(jed.debit)", "MAX(jed.debit)"),
        }
        for name, sql in cases.items():
            with self.subTest(case=name):
                self.server.text_for = lambda _b, s=sql: s
                outcome = self.handle(trace=f"traza-forma-{name}")
                self.assertEqual(outcome.body.estado, "no_resoluble")
                self.assertEqual(outcome.audit.codigos_rechazo[:2], ["SQLGEN_INVALID_OUTPUT", "UNVERIFIABLE_RESULT_SHAPE"])
                self.assert_not_executed(outcome)
        self.assertEqual(self.executor.calls, 0)

    def test_training_shapes_are_verifiable(self) -> None:
        for sql in (
            SHAPE_OK.format(where="WHERE aa.code = '101'"),
            SHAPE_OK.format(where="").replace("JOIN accounting_account", "INNER JOIN accounting_account"),
        ):
            with self.subTest(sql=sql[:40]):
                ensure_verifiable_saldo_shape(sql)


class ErrorClassificationTests(XiYanPipelineCase):
    def test_categories(self) -> None:
        cases = {
            "conexion": (503, "SQLGEN_UNAVAILABLE", "CONNECTION_FAILED", lambda b: (_ for _ in ()).throw(httpx.ConnectError("x"))),
            "timeout": (503, "SQLGEN_TIMEOUT", "READ_TIMEOUT", lambda b: (_ for _ in ()).throw(httpx.ReadTimeout("x"))),
            "cargando": (503, "SQLGEN_UNAVAILABLE", "MODEL_LOADING", lambda b: httpx.Response(503, json={"error": "MODEL_LOADING"})),
            "ocupado": (503, "SQLGEN_UNAVAILABLE", "BUSY", lambda b: httpx.Response(503, json={"error": "BUSY"})),
            "error-http": (503, "SQLGEN_UNAVAILABLE", "HTTP_ERROR_STATUS", lambda b: httpx.Response(500, text="traza")),
            "truncado": (200, "SQLGEN_INVALID_OUTPUT", "TRUNCATED_OUTPUT", lambda b: self.server.ok(b, finish_reason="length")),
            "respuesta-rota": (200, "SQLGEN_INVALID_OUTPUT", "INVALID_RESPONSE", lambda b: httpx.Response(200, content=b"{")),
            "prosa": (200, "SQLGEN_INVALID_OUTPUT", "NOT_A_QUERY", lambda b: self.server.ok(b, text="No puedo responder.")),
            "prompt-largo": (200, "SQLGEN_INPUT_REJECTED", "PROMPT_TOO_LONG", lambda b: httpx.Response(422, json={"error": "PROMPT_TOO_LONG"})),
        }
        for name, (status, category, code, respond) in cases.items():
            with self.subTest(case=name):
                self.server.respond = respond
                outcome = self.handle(trace=f"traza-error-{name}")
                self.assertEqual(outcome.status_code, status)
                self.assertEqual(outcome.audit.codigos_rechazo[:2], [category, code])
                self.assertNotIn("MODEL_UNAVAILABLE", outcome.audit.codigos_rechazo)  # reservado al Modelo 1
                if status == 503:
                    self.assertEqual(outcome.body.error, UNAVAILABLE)
                else:
                    self.assertEqual(outcome.body.estado, "no_resoluble")
                self.assert_not_executed(outcome)
        self.assertEqual(self.executor.calls, 0)
        self.assertEqual(len(self.server.requests), len(cases))  # un intento por consulta, sin reintentos
        self.assertNotIsInstance(self.orchestrator._generator, TemplateSqlGenerator)  # sin sustituto simulado

    def test_http_api_errors_are_generic(self) -> None:
        client = TestClient(create_app(self.settings, self.orchestrator), base_url="http://127.0.0.1", raise_server_exceptions=False)
        self.addCleanup(client.close)

        def post(trace: str):  # cada petición con su propia traza (el control de consumo no admite duplicadas)
            return client.post(
                "/v1/queries",
                content=json.dumps(payload(QUESTION, trace=trace), ensure_ascii=False),
                headers={TOKEN_HEADER: self.settings.internal_token, "Content-Type": "application/json"},
            )

        self.server.respond = lambda b: (_ for _ in ()).throw(httpx.ConnectError("rechazada"))
        unavailable = post("traza-http-caida")
        self.assertEqual((unavailable.status_code, unavailable.json()), (503, {"error": UNAVAILABLE, "errores": []}))

        secret_sql = "DELETE FROM journal_entry WHERE id = 424242;"
        self.server.respond = self.server.ok
        self.server.text_for = lambda _b: secret_sql
        invalid = post("traza-http-invalida")
        self.assertEqual((invalid.status_code, invalid.json()["estado"]), (200, "no_resoluble"))
        for response in (unavailable, invalid):
            for leak in ("127.0.0.1:8011", "CONNECTION", "SQLGEN", "424242", "DELETE", "〖", self.settings.sqlgen.token):
                self.assertNotIn(leak, response.text)

    def test_audit_has_no_model_input_or_secrets(self) -> None:
        self.server.text_for = lambda _b: "DELETE FROM journal_entry WHERE id = 424242;"
        self.handle()
        self.server.text_for = lambda body: SHAPE_OK.format(where="") + ";"
        self.handle(trace="traza-xiyan-0002")
        for record in self.audit.records:
            clear = audit_clear_text(record)
            for secret in ("caja", "septiembre", "424242", "DELETE", self.settings.sqlgen.token, "〖"):
                self.assertNotIn(secret, clear)


class ResultAdapterTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.plan = QueryPlan(kind="saldo_cuenta", cuenta="101", periodo=Period(desde=date(2026, 9, 1), hasta=date(2026, 9, 30)))
        self.adapter = XiYanSaldoFinanceAdapter()

    def row(self, **overrides):
        row = {"code": "101", "type": "Activo", "total_debit": "1800.00", "total_credit": "650.40"}
        row.update(overrides)
        return {k: v for k, v in row.items() if v is not ...}

    def test_no_fabricated_movement_indicator(self) -> None:
        # El adaptador no rellena ``movimientos`` ni delega en el motor de B3 con filas inventadas:
        # funciona aunque ese motor esté inutilizado.
        self.assertFalse(hasattr(result_adapter, "GROUP_PRESENCE"))
        with mock.patch.object(DeterministicFinanceEngine, "compute", side_effect=AssertionError("no debe usarse")):
            figures = {f.marcador: f.valor for f in self.adapter.compute(self.plan, [self.row()]).figures}
        self.assertEqual(figures, EXPECTED)
        self.assertEqual({f.origen for f in self.adapter.compute(self.plan, [self.row()]).figures}, {"motor", "executor"})

    def test_maps_training_aliases(self) -> None:
        for row in (self.row(), {"account_code": "101", "account_type": "Activo", "total_debit": "1800.00", "total_credit": "650.40"}):
            with self.subTest(row=sorted(row)):
                figures = {f.marcador: f.valor for f in self.adapter.compute(self.plan, [row]).figures}
                self.assertEqual(figures, EXPECTED)

    def test_parity_with_b1_engine_on_verified_values(self) -> None:
        cases = [("Activo", "1800.00", "650.40"), ("Pasivo", "300.00", "990.00"), ("Ingreso", "0", "5420.80"), ("Gasto", "2.675", "1.005")]
        for account_type, debit, credit in cases:
            with self.subTest(tipo=account_type):
                ours = self.adapter.compute(self.plan, [self.row(type=account_type, total_debit=debit, total_credit=credit)])
                b1 = DeterministicFinanceEngine().compute(
                    self.plan, [{"tipo": account_type, "debe": debit, "haber": credit, "movimientos": 3}]  # conteo real de B1
                )
                self.assertEqual(ours.figures, b1.figures)

    def test_no_data_only_when_no_rows(self) -> None:
        self.assertTrue(self.adapter.compute(self.plan, []).no_data)

    def test_missing_required_data_is_controlled_failure(self) -> None:
        cases = {
            "totales-nulos": [self.row(total_debit=None, total_credit=None)],
            "total-incompleto": [self.row(total_credit=None)],
            "sin-totales": [{"code": "101", "type": "Activo"}],
            "otra-cuenta": [self.row(code="104")],
            "varias-filas": [self.row(), self.row()],
            "tipo-desconocido": [self.row(type="ASSET")],
            "tipo-nulo": [self.row(type=None)],
            "sin-codigo": [self.row(code=...)],
            "alias-ambiguo": [{**self.row(), "account_code": "101"}],
            "float": [self.row(total_debit=1800.0)],
        }
        for name, rows in cases.items():
            with self.subTest(case=name), self.assertRaises((FinanceEngineError, TypeError, ValueError)):
                self.adapter.compute(self.plan, rows)

    def test_shape_errors_are_invalid_output_not_unavailability(self) -> None:
        with self.assertRaises(InvalidGeneratorOutput) as ctx:
            ensure_verifiable_saldo_shape("SELECT (")
        self.assertFalse(ctx.exception.transient)
