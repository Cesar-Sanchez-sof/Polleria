"""P1: familias de consulta entrenadas (catálogo, prompt fiel al entrenamiento y pipeline completo).

TODAS estas pruebas son SIMULADAS: Modelo 1 simulado (reglas deterministas), servicio de inferencia
simulado que responde con el SQL del ejemplo de entrenamiento adaptado al período pedido
(``fixtures/query_family_sql_v1.json``) y conexión PostgreSQL simulada. Reales: prefiltro, catálogo,
constructor del prompt, SQL Validator con ``allowlist.readonly_erp.json``, filtro P-4, Executor de solo
lectura (sobre la conexión simulada), adaptador de resultados y auditoría.

No prueban la calidad del modelo real: eso exige el servicio de inferencia con el adaptador (ver el
reporte de verificación con modelos y datos reales).
"""

from __future__ import annotations

import json
import re
from datetime import date
from decimal import Decimal
from pathlib import Path

from guards import GuardedTestCase
from sqlgen_support import FakeInferenceServer, NOW, payload, question_of, training_style_sql, xiyan_env
from test_postgres_executor import REAL_ENV, VERIFIED, Factory, FakeConnection

from ai_service.assembly import build_dev_orchestrator
from ai_service.config.settings import SQLGEN_TOKEN_VAR, load_service_settings
from ai_service.explanation.markers import MarkerValidationError, render_verified
from ai_service.http.schemas import Figure, Period
from ai_service.llm.openai_provider import OpenAiResponsesProvider, interpret_schema
from ai_service.orchestrator.periods import month_to_date, period_text, resolve_months, resolve_period
from ai_service.orchestrator.pipeline import REASON_TEXTS
from ai_service.orchestrator.ports import AuthorizationContext, QueryPlan
from ai_service.policies.registered_entries import has_registered_entries_filter
from ai_service.sqlgen.families import load_family_catalog
from ai_service.sqlgen.family_result import FamilyResultAdapter
from ai_service.sqlgen.prompt import is_xiyan_user_content
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator

ROOT = Path(__file__).resolve().parents[1]
CATALOG = load_family_catalog(ROOT / "knowledge" / "query_families_v1.json")
TRAINING = json.loads((ROOT / "tests" / "fixtures" / "query_family_sql_v1.json").read_text(encoding="utf-8"))["ejemplos"]
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.readonly_erp.json")
GRANTS = ALLOWLIST.roles["contador_demo"]
REFERENCE = date(2026, 10, 12)  # fecha_referencia_lima de sqlgen_support.payload


def family_of(request: dict) -> str:
    """Familia cuya solicitud del entrenamiento coincide (salvo el período) con ``request``."""
    for family in CATALOG:
        if {**family.solicitud, "time": None} == {**request, "time": None}:
            return family.id
    raise AssertionError("Solicitud fuera del catálogo")


def training_sql_for(body: dict) -> str:
    """Lo que respondería el adaptador: el SQL del entrenamiento con las fechas pedidas."""
    request = question_of(body["user_content"])
    if request["filters"] and request["filters"][0]["field"] == "account_code":
        return training_style_sql(request)  # saldo de una cuenta (flujo previo a P1)
    example = TRAINING[family_of(request)]
    return (example["sql"].replace(example["start"], request["time"]["start"])
            .replace(example["end_exclusive"], request["time"]["end_exclusive"]))


ROWS = {  # filas SIMULADAS con los nombres de columna del SQL de entrenamiento
    "ventas_cobradas_total": (("sales_payments_total",), [(Decimal("18450.50"),)]),
    "ventas_cobradas_por_dia": (("payment_day", "sales_payments_total"),
                                [(date(2026, 9, 1), Decimal("610.00")), (date(2026, 9, 2), Decimal("980.40")),
                                 (date(2026, 9, 3), Decimal("455.10"))]),
    "platos_mayores_ingresos": (("dish_id", "dish_name", "dish_sales_amount"),
                                [(4, "Pollo a la brasa", Decimal("9200.00")), (2, "Chaufa", Decimal("3100.50")),
                                 (7, "Anticucho", Decimal("1200.00"))]),
    "comprobantes_venta_cantidad": (("sales_invoice_count",), [(37,)]),
    "compras_por_proveedor": (("supplier_id", "business_name", "purchase_invoiced_total"),
                              [(1, "Avícola Norte SAC", Decimal("5400.00")), (3, "Mercado Central", Decimal("880.20"))]),
    "compras_por_comprobante": (("voucher_type", "purchase_invoice_count", "purchase_invoiced_total"),
                                [("Factura", 6, Decimal("6100.00")), ("Boleta", 2, Decimal("180.20"))]),
    "ventas_vs_compras_facturadas": (("invoiced_sales_total", "purchase_invoiced_total"),
                                     [(Decimal("20100.00"), Decimal("6280.20"))]),
    "ventas_facturadas_por_comprobante": (("voucher_type", "invoiced_sales_total"),
                                          [("Boleta", Decimal("15200.00")), ("Factura", Decimal("4900.00"))]),
    "pagos_proveedores_total": (("purchase_payments_total",), [(Decimal("5880.00"),)]),
}


def build(connection: FakeConnection | None = None):
    env = {**xiyan_env(), **REAL_ENV}
    settings = load_service_settings(env)
    server = FakeInferenceServer(env[SQLGEN_TOKEN_VAR])
    server.text_for = training_sql_for
    factory = Factory(connection or FakeConnection())
    orchestrator, audit = build_dev_orchestrator(
        settings, clock=lambda: NOW, sqlgen_transport=server.transport(), readonly_connection_factory=factory
    )
    return orchestrator, server, factory, audit


class CatalogTests(GuardedTestCase):
    def test_catalog_is_versioned_and_anchored_in_the_training_dataset(self) -> None:
        data = json.loads((ROOT / "knowledge" / "query_families_v1.json").read_text(encoding="utf-8"))
        self.assertEqual(data["dataset_sha256"], "081394f7ff24b07e7ddc445ebf900f6daaba265bd94d237467ef3bf9a3cb19c9")
        self.assertEqual(len(CATALOG), 19)
        for family in CATALOG:
            self.assertGreaterEqual(data["familias"][CATALOG.ids.index(family.id)]["entrenamiento"]["ejemplos"], 3)
            self.assertNotIn("sql", json.dumps(data["familias"][CATALOG.ids.index(family.id)]).lower().replace("postgresql", ""))

    def test_prompt_reproduces_the_training_prompt_except_for_excluded_columns(self) -> None:
        """Con el período del ejemplo anclado, el prompt es idéntico byte a byte al del entrenamiento;
        solo difiere al quitar las columnas excluidas de la allowlist (RUC, responsable, observación)."""
        orchestrator, _server, _factory, _audit = build()
        excluded = {"(ruc:VARCHAR(11)),", "(responsible:VARCHAR(100), Nullable),", "(observation:VARCHAR(200), Nullable)"}
        differing = set()
        for family in CATALOG:
            example = TRAINING[family.id]
            period = Period(desde=date.fromisoformat(example["start"]),
                            hasta=date.fromordinal(date.fromisoformat(example["end_exclusive"]).toordinal() - 1))
            plan = QueryPlan(kind="familia", cuenta="", periodo=period, autorizacion=VERIFIED, familia=family.id)
            prompt = orchestrator._generator.build_prompt(plan, [])
            with self.subTest(family=family.id):
                self.assertTrue(is_xiyan_user_content(prompt))
                if prompt != example["user_content"]:
                    differing.add(family.id)
                    # Solo se quitan columnas excluidas (sin contar la coma final que se reajusta).
                    original = {line.rstrip(",") for line in example["user_content"].splitlines()}
                    built = {line.rstrip(",") for line in prompt.splitlines()}
                    self.assertLessEqual(original - built, {line.rstrip(",") for line in excluded})
                    self.assertEqual(built - original, set())
                for hidden in ("(ruc:", "(responsible:", "(observation:"):
                    self.assertNotIn(hidden, prompt)
        self.assertEqual(differing, {"compras_por_proveedor", "debe_haber_por_cuenta", "debe_haber_por_dia"})

    def test_every_family_training_sql_passes_the_real_validator(self) -> None:
        validator = SqlValidator(ALLOWLIST)
        from ai_service.policies.registered_entries import apply_registered_entries_filter

        for family in CATALOG:
            sql = family.to_real_schema(TRAINING[family.id]["sql"].rstrip().rstrip(";"))
            if family.contable:
                sql = apply_registered_entries_filter(sql)
            verdict = validator.validate(sql, "contador_demo")
            with self.subTest(family=family.id):
                self.assertTrue(verdict.approved, verdict.reasons)
                self.assertTrue(has_registered_entries_filter(verdict.normalized_sql))

    def test_unknown_family_or_role_without_tables_never_reaches_the_model(self) -> None:
        orchestrator, server, _factory, _audit = build()
        plan = QueryPlan(kind="familia", cuenta="", periodo=month_to_date(REFERENCE), autorizacion=VERIFIED,
                         familia="inventada")
        with self.assertRaises(Exception):
            orchestrator._generator.generate(plan, [])
        lector = AuthorizationContext(rol="lector_demo", origen="erp-session", autenticado=True)
        plan = QueryPlan(kind="familia", cuenta="", periodo=month_to_date(REFERENCE), autorizacion=lector,
                         familia="ventas_cobradas_total")
        with self.assertRaises(Exception):
            orchestrator._generator.generate(plan, [])
        self.assertEqual(server.requests, [])


class EvaluationBatteryTests(GuardedTestCase):
    """Las 10 preguntas de la evaluación (SIMULADO): cada una debe llegar a XiYanSQL con su propia
    solicitud y terminar en un estado identificable, nunca en un texto genérico repetido."""

    QUESTIONS = {
        "¿Cuánto vendimos durante el último mes?": ("ventas_facturadas_por_comprobante", "2026-09-01"),
        "¿Cuáles fueron los gastos totales de septiembre?": ("compras_por_comprobante", "2026-09-01"),
        "¿Estamos generando ganancias o pérdidas?": ("ventas_vs_compras_facturadas", "2026-10-01"),
        "¿Qué productos generan mayores ingresos?": ("platos_mayores_ingresos", "2026-10-01"),
        "¿Cuáles son los gastos más elevados?": ("compras_por_proveedor", "2026-10-01"),
        "Compara los ingresos de agosto y septiembre.": ("ventas_facturadas_por_comprobante", "2026-08-01"),
        "¿Cuál es la situación financiera actual del restaurante?": ("ventas_vs_compras_facturadas", "2026-10-01"),
        "¿Cuántas ventas se registraron ayer?": ("comprobantes_venta_cantidad", "2026-10-11"),
        "¿Qué día tuvimos mayores ingresos?": ("ventas_cobradas_por_dia", "2026-10-01"),
        "¿Cuáles son las compras más recientes?": ("compras_por_proveedor", "2026-10-01"),
    }

    def test_every_question_reaches_xiyansql_with_a_dynamic_request(self) -> None:
        connection = FakeConnection()
        orchestrator, server, _factory, _audit = build(connection)
        executed: list[str] = []
        for index, (question, (family, start)) in enumerate(self.QUESTIONS.items()):
            connection.names, connection.rows = ROWS[family][0], list(ROWS[family][1])
            before = len(server.requests)
            outcome = orchestrator.handle(payload(question, trace=f"traza-bateria-{index:04d}"), authorization=VERIFIED,
                                          diagnostics=True)
            with self.subTest(question=question):
                self.assertEqual(outcome.status_code, 200)
                self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)
                self.assertGreater(len(server.requests), before)  # XiYanSQL invocado
                request = question_of(server.requests[before]["user_content"])
                self.assertEqual((family_of(request), request["time"]["start"]), (family, start))
                trace = outcome.body.diagnostico
                self.assertEqual(trace.consulta, family)
                self.assertEqual(trace.modelo_sql.adaptador, "xiyansql_v17_json_v10_balanced_full")
                self.assertTrue(trace.sql_validado)
                self.assertTrue(outcome.body.cifras)
                self.assertEqual(outcome.body.detalle.tipo, "consulta")
                for text in REASON_TEXTS.values():
                    self.assertNotEqual(outcome.body.texto, text)
                executed.append(connection.statements[-1])
        self.assertGreaterEqual(len(set(executed)), 7)  # SQL distinto según la pregunta (no un catálogo de respuestas)

    def test_period_comparison_runs_two_generations_and_computes_the_difference(self) -> None:
        connection = FakeConnection(rows=[(Decimal("15000.00"),)], names=("sales_payments_total",))
        orchestrator, server, _factory, _audit = build(connection)
        outcome = orchestrator.handle(payload("Compara los cobros de agosto y septiembre."), authorization=VERIFIED,
                                      diagnostics=True)
        self.assertEqual(outcome.body.estado, "respondida")
        starts = [question_of(r["user_content"])["time"]["start"] for r in server.requests]
        self.assertEqual(starts, ["2026-08-01", "2026-09-01"])
        figures = {f.marcador: (f.valor, f.origen) for f in outcome.body.cifras}
        self.assertEqual(figures["c3"], (Decimal("0.00"), "motor"))
        self.assertIn("agosto de 2026", outcome.body.texto)
        self.assertEqual([s.etapa for s in outcome.body.diagnostico.etapas].count("generacion_sql"), 2)

    def test_grouped_comparison_treats_an_empty_month_as_zero(self) -> None:
        class MonthConnection(FakeConnection):
            def execute(self, sql, params=None):  # agosto sin comprobantes, septiembre con dos
                self.rows = [] if "2026-08-01" in sql else list(ROWS["ventas_facturadas_por_comprobante"][1])
                return super().execute(sql, params)

        connection = MonthConnection(rows=[], names=ROWS["ventas_facturadas_por_comprobante"][0])
        orchestrator, server, _factory, _audit = build(connection)
        outcome = orchestrator.handle(payload("Compara las ventas de agosto y septiembre."), authorization=VERIFIED)
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)
        self.assertEqual(len(server.requests), 2)
        figures = {f.marcador: f.valor for f in outcome.body.cifras}
        self.assertEqual((figures["c1"], figures["c2"], figures["c3"]), (Decimal("0"), Decimal("20100.00"), Decimal("20100.00")))

    def test_zero_rows_is_a_successful_query_without_data_not_a_failure(self) -> None:
        connection = FakeConnection(rows=[], names=ROWS["platos_mayores_ingresos"][0])
        orchestrator, server, _factory, _audit = build(connection)
        outcome = orchestrator.handle(payload("¿Qué productos generan mayores ingresos?"), authorization=VERIFIED,
                                      diagnostics=True)
        self.assertEqual((outcome.status_code, outcome.body.estado), (200, "sin_datos"))
        self.assertEqual(outcome.body.texto, REASON_TEXTS["NO_ROWS"])
        self.assertEqual(outcome.body.diagnostico.filas, 0)
        self.assertTrue(outcome.body.diagnostico.sql_validado)
        self.assertEqual(len(server.requests), 1)

    def test_account_balance_questions_keep_the_saldo_flow(self) -> None:
        orchestrator, server, _factory, _audit = build()
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"), authorization=VERIFIED)
        self.assertEqual(outcome.body.estado, "respondida")
        self.assertEqual(question_of(server.requests[0]["user_content"])["filters"][0]["value"], "101")
        self.assertEqual(outcome.body.detalle.tipo, "saldo_cuenta")

    def test_rows_and_names_never_reach_the_explanation_provider(self) -> None:
        connection = FakeConnection(rows=ROWS["platos_mayores_ingresos"][1], names=ROWS["platos_mayores_ingresos"][0])
        orchestrator, _server, _factory, _audit = build(connection)
        provider = orchestrator._interpreter._gateway._provider
        outcome = orchestrator.handle(payload("¿Qué productos generan mayores ingresos?"), authorization=VERIFIED)
        self.assertIn("Pollo a la brasa", outcome.body.texto)  # insertado por el backend (marcador e1)
        sent = json.dumps([call.entrada.model_dump(mode="json") for call in provider.calls], ensure_ascii=False)
        for leak in ("Pollo a la brasa", "9200", "Chaufa"):
            self.assertNotIn(leak, sent)


class PeriodTests(GuardedTestCase):
    def test_relative_expressions(self) -> None:
        cases = {
            "durante el último mes": ("2026-09-01", "2026-09-30"),
            "ventas de ayer": ("2026-10-11", "2026-10-11"),
            "hoy": ("2026-10-12", "2026-10-12"),
            "esta semana": ("2026-10-12", "2026-10-12"),
            "la semana pasada": ("2026-10-05", "2026-10-11"),
            "los últimos 7 días": ("2026-10-06", "2026-10-12"),
            "este año": ("2026-01-01", "2026-10-12"),
            "el año pasado": ("2025-01-01", "2025-12-31"),
            "del 01/09/2026 al 15/09/2026": ("2026-09-01", "2026-09-15"),
            "el 14/09/2026": ("2026-09-14", "2026-09-14"),
        }
        for text, (start, end) in cases.items():
            with self.subTest(text=text):
                period = resolve_period(text, REFERENCE)
                self.assertEqual((period.desde.isoformat(), period.hasta.isoformat()), (start, end))
        self.assertIsNone(resolve_period("del 31/02/2026 al 01/03/2026", REFERENCE))

    def test_two_months_and_texts(self) -> None:
        months = resolve_months("compara agosto y septiembre", REFERENCE)
        self.assertEqual([period_text(p) for p in months], ["agosto de 2026", "septiembre de 2026"])
        self.assertEqual(period_text(month_to_date(REFERENCE)), "del 01/10/2026 al 12/10/2026")


class ResultAdapterTests(GuardedTestCase):
    def compute(self, family: str, rows: list[dict]):
        plan = QueryPlan(kind="familia", cuenta="", periodo=month_to_date(REFERENCE), familia=family)
        return FamilyResultAdapter(CATALOG).compute(plan, rows)

    def test_series_picks_the_best_day_and_total(self) -> None:
        names, rows = ROWS["ventas_cobradas_por_dia"]
        result = self.compute("ventas_cobradas_por_dia", [dict(zip(names, r)) for r in rows])
        self.assertEqual(result.figures[0].valor, Decimal("980.40"))
        self.assertEqual(result.text_labels["e1"], "02/09/2026")
        self.assertEqual(result.figures[1].valor, Decimal("2045.50"))  # total con todas las filas
        self.assertEqual(result.figures[1].origen, "motor")

    def test_comparison_difference_and_counts(self) -> None:
        names, rows = ROWS["ventas_vs_compras_facturadas"]
        result = self.compute("ventas_vs_compras_facturadas", [dict(zip(names, r)) for r in rows])
        self.assertEqual([f.valor for f in result.figures], [Decimal("20100.00"), Decimal("6280.20"), Decimal("13819.80")])
        count = self.compute("comprobantes_venta_cantidad", [{"sales_invoice_count": 37}])
        self.assertEqual((count.figures[0].valor, count.figures[0].unidad), (Decimal("37"), "N"))

    def test_many_rows_are_capped_with_a_note(self) -> None:
        rows = [{"voucher_type": f"T{i}", "purchase_invoice_count": 1, "purchase_invoiced_total": Decimal("10.00")}
                for i in range(30)]
        result = self.compute("compras_por_comprobante", rows)
        self.assertLessEqual(len(result.figures), 20)
        self.assertIn("de 30 filas", result.notes[0])
        self.assertEqual(result.figures[0].valor, Decimal("300.00"))

    def test_unexpected_columns_are_not_guessed(self) -> None:
        from ai_service.finance.engine import FinanceEngineError

        with self.assertRaises(FinanceEngineError):
            self.compute("ventas_cobradas_total", [{"otra_columna": Decimal("1")}])


class SchemaEquivalenceTests(GuardedTestCase):
    """El adaptador aprendió ``dish``/``order_item.dish_id``; Neon tiene ``product``/``product_id``
    (verificado en su catálogo). El modelo ve el esquema del entrenamiento y el SQL se traduce."""

    def test_model_sees_training_names_and_sql_is_rewritten_for_the_real_database(self) -> None:
        orchestrator, _server, _factory, _audit = build()
        plan = QueryPlan(kind="familia", cuenta="", periodo=month_to_date(REFERENCE), autorizacion=VERIFIED,
                         familia="platos_mayores_ingresos")
        prompt = orchestrator._generator.build_prompt(plan, [])
        self.assertIn("# Table: dish", prompt)
        self.assertIn("order_item.dish_id=dish.id", prompt)
        self.assertNotIn("product", prompt)
        family = CATALOG.get("platos_mayores_ingresos")
        rewritten = family.to_real_schema(
            "SELECT d.name AS dish_name, SUM(oi.subtotal) AS dish_sales_amount FROM sales_order so "
            "JOIN order_item oi ON oi.order_id = so.id JOIN dish d ON d.id = oi.dish_id GROUP BY d.name"
        )
        self.assertIn("JOIN product AS d ON d.id = oi.product_id", rewritten)
        unaliased = family.to_real_schema("SELECT dish.name FROM order_item JOIN dish ON dish.id = order_item.dish_id")
        self.assertIn("JOIN product AS dish ON dish.id = order_item.product_id", unaliased)
        self.assertEqual(family.real_tables, ("sales_order", "order_item", "product"))

    def test_families_without_renamed_tables_are_untouched(self) -> None:
        sql = "SELECT COALESCE(SUM(sp.amount), 0) AS sales_payments_total FROM sales_payment AS sp"
        self.assertEqual(CATALOG.get("ventas_cobradas_total").to_real_schema(sql), sql)

    def test_date_function_used_by_the_real_model_is_accepted(self) -> None:
        # Salida REAL de XiYanSQL v1.7 para ventas por día (prueba con el modelo del 2026-10-24).
        sql = ("SELECT DATE(sp.paid_at) AS payment_day, SUM(sp.amount) AS sales_payments_total FROM sales_payment AS sp "
               "WHERE sp.paid_at >= TIMESTAMP '2026-10-01 00:00:00' AND sp.paid_at < TIMESTAMP '2026-10-25 00:00:00' "
               "GROUP BY DATE(sp.paid_at) ORDER BY payment_day ASC")
        verdict = SqlValidator(ALLOWLIST).validate(sql, "contador_demo")
        self.assertTrue(verdict.approved, verdict.reasons)

    def test_real_model_hallucinated_column_is_rejected(self) -> None:
        # Basado en una salida REAL de XiYanSQL v1.7 (cobros frente a pagos del mes en curso). Entonces usó
        # sales_invoice.created_at, que la ruta ampliada autorizó después (existe en Neon); aquí, una columna
        # que no existe en el esquema.
        sql = ("WITH s AS (SELECT SUM(sp.amount) AS sales_payments_total FROM sales_payment sp JOIN sales_invoice si "
               "ON si.id = sp.sales_invoice_id WHERE si.payment_date >= TIMESTAMP '2026-10-01 00:00:00') "
               "SELECT s.sales_payments_total FROM s")
        verdict = SqlValidator(ALLOWLIST).validate(sql, "contador_demo")
        self.assertFalse(verdict.approved)
        self.assertIn("UNRESOLVED_REFERENCE", verdict.reasons)

    def test_label_alias_used_by_the_real_model(self) -> None:
        # Salida REAL de XiYanSQL con OpenAI (2026-10-24): etiqueta como payment_type_name.
        plan = QueryPlan(kind="familia", cuenta="", periodo=month_to_date(REFERENCE), familia="ventas_cobradas_por_medio_pago")
        rows = [{"payment_type_id": 1, "payment_type_name": "Yape", "sales_payment_count": 3, "sales_payments_total": Decimal("120.00")}]
        result = FamilyResultAdapter(CATALOG).compute(plan, rows)
        self.assertIn("Yape · Cobrado", result.labels.values())

    def test_explicit_account_code_takes_precedence_over_a_family(self) -> None:
        orchestrator, server, _factory, _audit = build()
        outcome = orchestrator.handle(payload("¿Cuál fue el movimiento de ventas de la cuenta 101 en septiembre?"),
                                      authorization=VERIFIED, diagnostics=True)
        request = question_of(server.requests[0]["user_content"])
        self.assertEqual(request["filters"][0], {"field": "account_code", "operator": "eq", "value": "101"})
        self.assertIsNone(outcome.body.diagnostico.consulta)

    def test_metric_alias_is_accepted_without_guessing(self) -> None:
        plan = QueryPlan(kind="familia", cuenta="", periodo=month_to_date(REFERENCE), familia="comprobantes_venta_lista")
        rows = [{"voucher_type": "Boleta", "series": "B001", "number": 12, "issued_at": date(2026, 10, 13),
                 "total_amount": Decimal("59.90")}]
        result = FamilyResultAdapter(CATALOG).compute(plan, rows)
        self.assertIn("Boleta · B001-12 · 13/10/2026 · Total", result.labels.values())


class ExplanationMarkerTests(GuardedTestCase):
    def test_text_markers_are_inserted_after_validation(self) -> None:
        figures = [Figure(marcador="c1", valor=Decimal("9200.00"), unidad="PEN", origen="executor")]
        text = render_verified("El plato con más ingresos fue {{e1}}, con {{c1}}.", figures, {"e1": "Pollo a la brasa"})
        self.assertEqual(text, "El plato con más ingresos fue Pollo a la brasa, con S/ 9,200.00.")
        with self.assertRaises(MarkerValidationError):
            render_verified("Fue {{e2}} con {{c1}}.", figures, {"e1": "Pollo"})


class FinancialConceptTests(GuardedTestCase):
    """Regresión de la interpretación financiera: cada concepto contable usa su propia métrica.

    Caso real del 2026-10-24: «¿Cuánto gastamos en compras?» se respondió con pagos a proveedores
    (S/ 1,878.91) en lugar de compras facturadas (S/ 1,893.01)."""

    EXPECTED = {  # concepto → (familia canónica, métrica que debe consultarse)
        "ventas_facturadas": ("ventas_facturadas_por_comprobante", "invoiced_sales_total"),
        "cobros": ("ventas_cobradas_total", "sales_payments_total"),
        "compras_facturadas": ("compras_por_comprobante", "purchase_invoiced_total"),
        "pagos_proveedores": ("pagos_proveedores_total", "purchase_payments_total"),
        "resultado_facturado": ("ventas_vs_compras_facturadas", "invoiced_sales_total"),
        "flujo_caja": ("cobros_vs_pagos", "sales_payments_total"),
    }

    def test_each_concept_maps_to_its_own_metric(self) -> None:
        for concept, (family_id, metric) in self.EXPECTED.items():
            with self.subTest(concept=concept):
                family, _ = CATALOG.resolve(None, concept)
                self.assertEqual(family.id, family_id)
                self.assertIn(metric, family.solicitud["metrics"])
                self.assertEqual(family.concepto, concept)

    def test_purchases_and_supplier_payments_are_never_interchanged(self) -> None:
        family, adjustment = CATALOG.resolve("pagos_proveedores_total", "compras_facturadas")
        self.assertEqual((family.id, adjustment), ("compras_por_comprobante", "FAMILY_ADJUSTED_TO_CONCEPT"))
        family, adjustment = CATALOG.resolve("compras_por_comprobante", "pagos_proveedores")
        self.assertEqual((family.id, adjustment), ("pagos_proveedores_total", "FAMILY_ADJUSTED_TO_CONCEPT"))
        family, adjustment = CATALOG.resolve("ventas_cobradas_total", "ventas_facturadas")
        self.assertEqual(family.id, "ventas_facturadas_por_comprobante")
        # Familias del mismo concepto se respetan (no se fuerza la canónica).
        self.assertEqual(CATALOG.resolve("compras_por_proveedor", "compras_facturadas"), (CATALOG.get("compras_por_proveedor"), None))
        self.assertEqual(CATALOG.resolve("ventas_cobradas_por_dia", "cobros")[0].id, "ventas_cobradas_por_dia")

    def test_every_family_declares_a_known_concept(self) -> None:
        for family in CATALOG:
            self.assertIn(family.concepto, CATALOG.concepts, family.id)
        self.assertIsNone(CATALOG.concepts["gastos_operativos"].canonica)
        self.assertIsNone(CATALOG.concepts["saldo_cuenta"].canonica)

    def ask(self, question: str, *, consulta: str | None, concepto: str | None, cuenta: str | None = None,
            names=("purchase_payments_total",), rows=((Decimal("1878.91"),),)):
        connection = FakeConnection(rows=list(rows), names=names)
        orchestrator, server, _factory, _audit = build(connection)
        from ai_service.orchestrator.ports import Interpretation

        class Interpreter:
            def interpret(self, request):
                return Interpretation(intencion="consulta_financiera", cuenta=cuenta, consulta=consulta, concepto=concepto)

        orchestrator._interpreter = Interpreter()
        outcome = orchestrator.handle(payload(question), authorization=VERIFIED, diagnostics=True)
        requests = [question_of(r["user_content"]) for r in server.requests]
        return outcome, requests

    def test_pipeline_uses_purchases_when_the_concept_is_purchases(self) -> None:
        names, rows = ROWS["compras_por_comprobante"]
        outcome, requests = self.ask("¿Cuánto gastamos en compras este mes?", consulta="pagos_proveedores_total",
                                     concepto="compras_facturadas", names=names, rows=rows)
        self.assertEqual(requests[0]["metrics"], ["purchase_invoice_count", "purchase_invoiced_total"])
        self.assertEqual(outcome.body.diagnostico.ajuste, "FAMILY_ADJUSTED_TO_CONCEPT")
        self.assertIn("FAMILY_ADJUSTED_TO_CONCEPT", outcome.audit.codigos_rechazo)
        self.assertEqual(outcome.body.detalle.titulo, "Compras facturadas")

    def test_operating_expenses_are_reported_as_not_available(self) -> None:
        outcome, requests = self.ask("¿Cuánto gastamos en luz y alquiler?", consulta="compras_por_comprobante",
                                     concepto="gastos_operativos")
        self.assertEqual((outcome.body.estado, requests), ("no_resoluble", []))  # XiYanSQL no se invoca
        self.assertEqual(outcome.body.texto, REASON_TEXTS["OPERATING_EXPENSES_NOT_AVAILABLE"])

    def test_account_balance_concept_uses_the_saldo_flow(self) -> None:
        outcome, requests = self.ask("¿Cuál es el saldo de caja este mes?", consulta="ventas_cobradas_total",
                                     concepto="saldo_cuenta", cuenta="101",
                                     names=("account_code", "account_type", "total_debit", "total_credit"),
                                     rows=(("101", "Activo", Decimal("10.00"), Decimal("4.00")),))
        self.assertEqual(requests[0]["filters"][0]["value"], "101")
        self.assertEqual(outcome.body.detalle.tipo, "saldo_cuenta")

    def test_concept_outside_the_closed_list_is_ignored(self) -> None:
        names, rows = ROWS["pagos_proveedores_total"]
        outcome, requests = self.ask("¿Cuánto pagamos a proveedores?", consulta="pagos_proveedores_total",
                                     concepto="inventado", names=names, rows=rows)
        self.assertEqual(requests[0]["metrics"], ["purchase_payments_total"])
        self.assertIsNone(outcome.body.diagnostico.concepto)

    def test_interpreter_instructions_define_every_concept(self) -> None:
        provider = OpenAiResponsesProvider(api_key="sk-test-" + "0" * 32, model="gpt-6-luna",
                                           price=__import__("ai_service.llm.budget", fromlist=["ModelPrice"]).ModelPrice(
                                               input_per_1k=Decimal("0.001"), output_per_1k=Decimal("0.004")),
                                           account_catalog={}, families=CATALOG)
        instructions = provider._interpret_instructions
        for concept in CATALOG.concepts:
            self.assertIn(f"- {concept}:", instructions)
        schema = provider._interpret_schema
        self.assertEqual(set(schema["properties"]["concepto"]["enum"][:-1]), set(CATALOG.concepts))
        self.assertIn("concepto", schema["required"])
        provider.close()


class InterpreterContractTests(GuardedTestCase):
    def test_extended_schema_requires_history_flag_and_english_goal(self) -> None:
        schema = interpret_schema(list(CATALOG.ids), list(CATALOG.concepts), (["ventas"], ["product"]))
        self.assertIn("historico", schema["required"])
        free_query = schema["properties"]["consulta_libre"]["anyOf"][0]
        self.assertIn("pregunta_en", free_query["required"])

    def test_schema_offers_only_catalog_families_or_null(self) -> None:
        schema = interpret_schema(list(CATALOG.ids))
        self.assertEqual(schema["properties"]["consulta"]["enum"][-1], None)
        self.assertEqual(set(schema["properties"]["consulta"]["enum"][:-1]), set(CATALOG.ids))
        self.assertIn("consulta", schema["required"])
        with self.assertRaises(ValueError):
            OpenAiResponsesProvider._to_output(
                "interpretar",
                {"intencion": "consulta_financiera", "cuenta": None, "indicador": None, "necesita_aclaracion": False,
                 "consulta": "inventada"},
                list(CATALOG.ids),
            )
