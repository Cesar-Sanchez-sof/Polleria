"""Flujo integral del MVP con AMBOS proveedores simulados (sin red, sin GPU, sin créditos).

GPT-6 Luna (simulado) → QueryPlan → RAG → XiYanSQL (simulado, con el SQL que generó el modelo real
el 2026-10-13) → SQL Validator → Executor ficticio por AST → motor financiero → GPT-6 Luna (simulado).
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from guards import GuardedTestCase
from sqlgen_support import NOW, FakeInferenceServer, payload, question_of, xiyan_env
from test_openai_provider import FakeOpenAI, openai_env

from ai_service.assembly import build_dev_orchestrator
from ai_service.config.settings import SQLGEN_TOKEN_VAR, load_service_settings
from ai_service.simulation.components import ExecutorRefused
from ai_service.sqlgen.dev_fixtures import REFERENCE_SALDO_SQL, FixtureMiss, SaldoFixtureExecutor
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator, Verdict

ROOT = Path(__file__).resolve().parents[1]
DATASET = json.loads((ROOT / "fixtures" / "dev_dataset_erp.json").read_text(encoding="utf-8"))["dataset"]
VALIDATOR = SqlValidator(load_allowlist(ROOT / "knowledge" / "allowlist.dev_erp.json"))
# Forma exacta del SQL generado por XiYanSQL + QLoRA v17 en la primera inferencia real.
XIYAN_REAL_SQL = (
    "SELECT aa.id AS account_id, aa.code AS account_code, aa.name AS account_name, aa.type AS account_type, "
    "SUM(jed.debit) AS total_debit, SUM(jed.credit) AS total_credit FROM journal_entry_detail AS jed "
    "JOIN accounting_account AS aa ON aa.id = jed.account_id JOIN journal_entry AS je ON je.id = jed.entry_id "
    "WHERE je.entry_date >= DATE '{start}' AND je.entry_date < DATE '{end}' AND aa.code = '{cuenta}' "
    "GROUP BY aa.id, aa.code, aa.name, aa.type ORDER BY aa.code;"
)
BASE = (
    "SELECT aa.code AS c, aa.type AS t, SUM(jed.debit) AS d, SUM(jed.credit) AS h FROM journal_entry_detail jed "
    "JOIN accounting_account aa ON aa.id = jed.account_id JOIN journal_entry je ON je.id = jed.entry_id "
    "WHERE {where} GROUP BY aa.code, aa.type"
)
SEPT = "aa.code = '101' AND je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01'"


def verdict(sql: str) -> Verdict:
    result = VALIDATOR.validate(sql, "contador_demo")
    assert result.approved, result.reasons
    return result


class SaldoFixtureExecutorTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.executor = SaldoFixtureExecutor(DATASET)

    def test_equivalent_sql_variants_return_the_same_fixture_rows(self) -> None:
        variants = {
            "referencia": REFERENCE_SALDO_SQL.format(cuenta="101", start="2026-09-01", end="2026-10-01"),
            "xiyan-real": XIYAN_REAL_SQL.format(cuenta="101", start="2026-09-01", end="2026-10-01"),
            "between": BASE.format(where="aa.code = '101' AND je.entry_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30'"),
            "menor-o-igual": BASE.format(where="je.entry_date <= '2026-09-30' AND aa.code = '101' AND je.entry_date >= '2026-09-01'"),
            "operandos-invertidos": BASE.format(where=SEPT).replace("aa.id = jed.account_id", "jed.account_id = aa.id"),
        }
        for name, sql in variants.items():
            with self.subTest(variant=name):
                rows = self.executor.execute(verdict(sql))
                self.assertEqual(len(rows), 1)
                self.assertLessEqual({"101", "Activo", "1800.00", "650.40"}, set(rows[0].values()))

    def test_rows_use_the_aliases_chosen_by_the_sql(self) -> None:
        rows = self.executor.execute(verdict(XIYAN_REAL_SQL.format(cuenta="421", start="2026-09-01", end="2026-10-01")))
        self.assertEqual(
            rows,
            [{"account_id": 3, "account_code": "421", "account_name": "Proveedores demo", "account_type": "Pasivo",
              "total_debit": "300.00", "total_credit": "990.00"}],
        )

    def test_known_empty_period_is_no_data(self) -> None:
        self.assertEqual(self.executor.execute(verdict(BASE.format(where=SEPT.replace("09-01", "07-01").replace("10-01", "08-01")))), [])

    def test_unsupported_or_unknown_queries_never_invent_results(self) -> None:
        cases = {
            "periodo-sin-datos": BASE.format(where=SEPT.replace("2026-09-01", "2026-10-01").replace("2026-10-01'", "2026-11-01'")),
            "sin-codigo": BASE.format(where="je.entry_date >= DATE '2026-09-01' AND je.entry_date < DATE '2026-10-01'"),
            "sin-limite-superior": BASE.format(where="aa.code = '101' AND je.entry_date >= DATE '2026-09-01'"),
            "or": BASE.format(where=f"({SEPT}) OR aa.code = '104'"),
            "filtro-extra": BASE.format(where=f"{SEPT} AND je.book = 'diario'"),
            "codigo-in": BASE.format(where=SEPT.replace("aa.code = '101'", "aa.code IN ('101', '104')")),
            "conteo": BASE.format(where=SEPT).replace("SUM(jed.credit) AS h", "COUNT(jed.id) AS h"),
            "maximo": BASE.format(where=SEPT).replace("SUM(jed.debit)", "MAX(jed.debit)"),
            "columna-extra": BASE.format(where=SEPT).replace("aa.type AS t,", "aa.type AS t, je.book AS b,").replace("GROUP BY aa.code, aa.type", "GROUP BY aa.code, aa.type, je.book"),
            "union-incorrecta": BASE.format(where=SEPT).replace("aa.id = jed.account_id", "aa.id = jed.entry_id"),
            "left-join": BASE.format(where=SEPT).replace("JOIN accounting_account", "LEFT JOIN accounting_account"),
            "sin-group-by": "SELECT SUM(jed.debit) AS d FROM journal_entry_detail jed JOIN accounting_account aa ON aa.id = jed.account_id "
                            "JOIN journal_entry je ON je.id = jed.entry_id WHERE " + SEPT,
        }
        for name, sql in cases.items():
            with self.subTest(case=name), self.assertRaises(FixtureMiss):
                self.executor.execute(verdict(sql))

    def test_only_approved_verdicts(self) -> None:
        with self.assertRaises(ExecutorRefused):
            self.executor.execute(Verdict(False, ("X",)))
        with self.assertRaises(ExecutorRefused):
            self.executor.execute("SELECT 1")  # type: ignore[arg-type]


class FullFlowTests(GuardedTestCase):
    """Ambos proveedores simulados, configurados como en la demostración real."""

    def build(self):
        env = {**xiyan_env(), **{k: v for k, v in openai_env().items() if k.startswith(("AI_LLM", "OPENAI"))}}
        settings = load_service_settings(env)
        openai, xiyan = FakeOpenAI(), FakeInferenceServer(env[SQLGEN_TOKEN_VAR])

        def real_shape(body):
            request = question_of(body["user_content"])
            return XIYAN_REAL_SQL.format(
                cuenta=request["filters"][0]["value"], start=request["time"]["start"], end=request["time"]["end_exclusive"]
            )

        xiyan.text_for = real_shape
        orchestrator, audit = build_dev_orchestrator(
            settings, clock=lambda: NOW, sqlgen_transport=xiyan.transport(), llm_transport=openai.transport()
        )
        return orchestrator, audit, openai, xiyan

    def test_complete_flow_with_xiyan_real_sql(self) -> None:
        orchestrator, audit, openai, xiyan = self.build()
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual((outcome.status_code, outcome.body.estado), (200, "respondida"))
        self.assertEqual({f.marcador: f.valor for f in outcome.body.cifras},
                         {"c1": Decimal("1149.60"), "c2": Decimal("1800.00"), "c3": Decimal("650.40")})
        self.assertIn("S/ 1,149.60", outcome.body.texto)
        self.assertEqual(outcome.audit.codigos_rechazo, [])
        versions = outcome.body.versiones
        self.assertEqual((versions["llm"], versions["sqlgen"]), ("openai:gpt-6-luna", "xiyansql:xiyansql_v17_json_v10_balanced_full"))
        self.assertEqual([r["text"]["format"]["name"] for r in openai.requests], ["interpretacion", "explicacion"])
        self.assertEqual(len(xiyan.requests), 1)
        outbound = json.dumps([*openai.requests, *xiyan.requests], ensure_ascii=False)
        for secret in ("1149.60", "1,149.60", "1800.00", "650.40", "Caja demo"):
            self.assertNotIn(secret, outbound)  # ningún proveedor recibe cifras ni filas

    def test_other_accounts_and_no_data(self) -> None:
        orchestrator, _audit, openai, _xiyan = self.build()
        openai.interpretation = {**openai.interpretation, "cuenta": "421"}
        outcome = orchestrator.handle(payload("Saldo de proveedores en septiembre", trace="traza-flujo-0002"))
        self.assertEqual({f.marcador: f.valor for f in outcome.body.cifras},
                         {"c1": Decimal("690.00"), "c2": Decimal("300.00"), "c3": Decimal("990.00")})
        openai.interpretation = {**openai.interpretation, "cuenta": "101"}
        outcome = orchestrator.handle(payload("Saldo de caja en julio", trace="traza-flujo-0003"))
        self.assertEqual((outcome.body.estado, outcome.body.cifras), ("sin_datos", []))

    def test_period_without_fictitious_data_is_controlled(self) -> None:
        orchestrator, _audit, _openai, _xiyan = self.build()
        outcome = orchestrator.handle(payload("Saldo de caja en octubre", trace="traza-flujo-0004"))
        self.assertEqual(outcome.status_code, 503)
        self.assertIn("COMPONENT_FAILURE", outcome.audit.codigos_rechazo)
