"""Ruta ampliada: preguntas del ERP sin familia entrenada (SIMULADO).

Simulados: intérprete (devuelve una ``consulta_libre`` fija), servicio de inferencia (responde el SQL
que fija cada prueba, no uno generado) y conexión PostgreSQL. Reales: prefiltro, catálogo de módulos,
RAG local léxico, constructor del prompt, SQL Validator con ``allowlist.readonly_erp.json``, permisos
por módulo, reintento controlado, Executor de solo lectura (sobre la conexión simulada) y adaptador.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path

from guards import GuardedTestCase
from sqlgen_support import FakeInferenceServer, NOW, payload, question_of, xiyan_env
from test_postgres_executor import REAL_ENV, Factory, FakeConnection

from ai_service.assembly import build_dev_orchestrator
from ai_service.auth.identity import IdentityError, verify_identity_assertion
from ai_service.config.settings import SQLGEN_TOKEN_VAR, load_service_settings
from ai_service.llm.provider import FreeQuery
from ai_service.orchestrator.pipeline import REASON_TEXTS
from ai_service.orchestrator.ports import AuthorizationContext, Interpretation, QueryPlan
from ai_service.sqlgen.free_result import FreeResultAdapter
from ai_service.sqlgen.mschema import MSchemaBuilder
from ai_service.sqlgen.modules import load_erp_modules
from ai_service.sqlgen.prompt import is_xiyan_user_content
from ai_service.validation.allowlist import AllowlistError, load_allowlist, parse_allowlist
from test_identity import KEY, claims, sign

ROOT = Path(__file__).resolve().parents[1]
MODULES = load_erp_modules(ROOT / "knowledge" / "erp_modules_v1.json")
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.readonly_erp.json")
ADMIN = AuthorizationContext(rol="contador_demo", origen="erp-session", autenticado=True)
SENSITIVE_COLUMN = re.compile(r"(ruc|dni|phone|email|address|password|salary|first_name|last_name|contact|document|username|token)")


def free(**overrides) -> FreeQuery:
    base = {"modulo": "productos", "tablas": ["product"], "intent": "aggregate", "subject": "product",
            "metrics": ["product_count"], "busqueda": "cantidad de productos registrados"}
    return FreeQuery.model_validate({**base, **overrides}, strict=False)


def build(connection: FakeConnection, sql_for, query: FreeQuery | None = None, **interpretation):
    env = {**xiyan_env(), **REAL_ENV}
    settings = load_service_settings(env)
    server = FakeInferenceServer(env[SQLGEN_TOKEN_VAR])
    server.text_for = sql_for
    orchestrator, audit = build_dev_orchestrator(
        settings, clock=lambda: NOW, sqlgen_transport=server.transport(), readonly_connection_factory=Factory(connection)
    )

    class Interpreter:
        def interpret(self, request):
            return Interpretation(intencion="consulta_financiera", consulta_libre=query, **interpretation)

    orchestrator._interpreter = Interpreter()
    return orchestrator, server


class ModuleCatalogTests(GuardedTestCase):
    def test_modules_only_expose_allowlisted_non_sensitive_columns(self) -> None:
        grants = ALLOWLIST.roles["contador_demo"]
        for name, table in MODULES.tables.items():
            with self.subTest(table=name):
                self.assertIn(name, grants)
                for column in table.columns:
                    self.assertIn(column.name, grants[name])
                    self.assertIsNone(SENSITIVE_COLUMN.search(column.name), column.name)
        for excluded in ("app_user", "role", "permission", "audit_log", "employee", "payroll", "customer"):
            self.assertNotIn(excluded, MODULES.tables)
            self.assertNotIn(excluded, ALLOWLIST.tables)

    def test_mschema_uses_the_training_format_and_real_types(self) -> None:
        schema = MODULES.mschema(["product", "inventory_movement"], ALLOWLIST.roles["contador_demo"])
        self.assertTrue(schema.startswith("〖DB_ID〗 los_betos\n〖Schema〗\n# Table: product\n["))
        self.assertIn("(current_stock:DECIMAL(10,2))", schema)
        self.assertIn("inventory_movement.product_id=product.id", schema)

    def test_saldo_prompt_is_identical_whatever_the_allowlist_authorizes(self) -> None:
        # Regresión: ampliar la allowlist real no puede cambiar el M-Schema de la variante entrenada del saldo.
        from ai_service.sqlgen.generator import TRAINED_COLUMNS

        meta = json.loads((ROOT / "knowledge" / "erp_schema_metadata.json").read_text(encoding="utf-8"))
        tables = ("accounting_account", "journal_entry", "journal_entry_detail")
        dev = load_allowlist(ROOT / "knowledge" / "allowlist.dev_erp.json")
        hidden = {(t, c) for t in tables for c in ALLOWLIST.roles["contador_demo"][t]
                  if c not in TRAINED_COLUMNS["saldo_cuenta"][t]} | {("journal_entry", "status")}
        self.assertEqual(MSchemaBuilder(dev, meta).build("contador_demo", tables, hidden_columns=frozenset({("journal_entry", "status")})),
                         MSchemaBuilder(ALLOWLIST, meta).build("contador_demo", tables, hidden_columns=frozenset(hidden)))

    def test_cash_session_is_an_exact_exception_to_the_session_rule(self) -> None:
        def allowlist(name: str) -> dict:
            return {"version": "t", "schema": "public", "tables": {name: {"id": "INT"}}, "roles": {"r": {name: ["id"]}}}

        parse_allowlist(allowlist("cash_session"))
        for name in ("user_session", "sessions", "cash_sessions"):
            with self.subTest(table=name), self.assertRaises(AllowlistError):
                parse_allowlist(allowlist(name))


class FreeRouteTests(GuardedTestCase):
    def test_new_question_reaches_xiyansql_and_answers_from_returned_rows(self) -> None:
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(p.id) AS product_count FROM product AS p", free())
        outcome = orchestrator.handle(payload("¿Cuántos productos tenemos registrados?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)
        prompt = server.requests[0]["user_content"]
        self.assertTrue(is_xiyan_user_content(prompt))
        request = question_of(prompt)
        self.assertEqual(len(request), 12)  # mismas 12 claves del contrato 1.0
        self.assertEqual((request["subject"], request["metrics"], request["time"]), ("product", ["product_count"], None))
        self.assertIn("# Table: product", prompt)
        trace = outcome.body.diagnostico
        self.assertEqual((trace.ruta, trace.filas), ("ampliada", 1))
        self.assertEqual(trace.indice_rag, "local")  # catálogo de módulos en memoria, nunca se presenta como Milvus
        self.assertTrue(trace.tablas_rag)  # el RAG local propuso tablas (aquí, léxico simulado)
        self.assertEqual(trace.tablas_prompt[0], "product")  # la nombrada por el intérprete va primero
        self.assertEqual([(f.valor, f.unidad) for f in outcome.body.cifras], [(Decimal("20"), "N")])
        self.assertIn("Consulta fuera del catálogo entrenado", outcome.body.detalle.nota)
        self.assertIsNone(outcome.body.detalle.periodo)

    def test_restricted_data_is_refused_before_any_model(self) -> None:
        orchestrator, server = build(FakeConnection(), lambda b: "SELECT 1", None, restringido=True)
        outcome = orchestrator.handle(payload("¿Cuántos usuarios están registrados?"), authorization=ADMIN)
        self.assertEqual((outcome.body.estado, outcome.body.texto), ("no_resoluble", REASON_TEXTS["RESTRICTED_DATA"]))
        self.assertEqual(server.requests, [])

    def test_modules_without_permission_are_never_offered_or_executed(self) -> None:
        only_sales = AuthorizationContext(rol="contador_demo", origen="erp-session", autenticado=True, modulos=frozenset({"ventas"}))
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(p.id) AS product_count FROM product AS p",
                                     free(busqueda="stock de insumos y productos"))
        outcome = orchestrator.handle(payload("¿Cuántos productos tenemos registrados?"), authorization=only_sales,
                                      diagnostics=True)
        self.assertEqual(outcome.body.estado, "no_resoluble")
        self.assertNotIn("# Table: product", "".join(r["user_content"] for r in server.requests))
        # Aunque el modelo lea una tabla de otro módulo, el SQL no se ejecuta.
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(pi.id) AS invoices FROM purchase_invoice AS pi",
                                     free(modulo="ventas", tablas=["sales_order"], subject="sales_order", metrics=["orders"]))
        outcome = orchestrator.handle(payload("¿Cuántos pedidos hubo?"), authorization=only_sales, diagnostics=True)
        self.assertIn("MODULE_NOT_PERMITTED", outcome.audit.codigos_rechazo)
        self.assertNotIn("purchase_invoice", " ".join(connection.statements))

    def test_one_controlled_retry_after_an_invalid_column(self) -> None:
        answers = iter(["SELECT COUNT(p.stock_level) AS product_count FROM product AS p",
                        "SELECT COUNT(p.id) AS product_count FROM product AS p"])
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        orchestrator, server = build(connection, lambda b: next(answers), free())
        outcome = orchestrator.handle(payload("¿Cuántos productos tenemos registrados?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)
        self.assertEqual(len(server.requests), 2)
        self.assertIn("Columns stock_level do not exist", server.requests[1]["user_content"])  # pista con el nombre exacto
        trace = outcome.body.diagnostico
        self.assertEqual(trace.reintento, "UNRESOLVED_REFERENCE")
        self.assertIn("stock_level", trace.sql_previo)
        self.assertIn("SQL_REJECTED", outcome.audit.codigos_rechazo)  # el primer intento queda auditado

    def test_intent_contradiction_is_corrected_once_then_reported(self) -> None:
        connection = FakeConnection(rows=[("Pollo",)], names=("name",))
        orchestrator, server = build(connection, lambda b: "SELECT p.name FROM product AS p", free())
        outcome = orchestrator.handle(payload("¿Cuántos productos tenemos registrados?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(len(server.requests), 2)  # un único reintento
        self.assertEqual((outcome.body.estado, outcome.body.texto), ("no_resoluble", REASON_TEXTS["INTENT_SQL_MISMATCH"]))
        self.assertEqual(connection.statements, [])  # nunca se ejecutó un SQL incoherente

    def test_zero_rows_is_a_valid_answer(self) -> None:
        connection = FakeConnection(rows=[], names=("name", "current_stock"))
        query = free(intent="list", metrics=[], conditions=["stock_below_minimum"], busqueda="productos por agotarse")
        orchestrator, _server = build(connection, lambda b: "SELECT p.name, p.current_stock FROM product AS p "
                                      "WHERE p.current_stock <= p.minimum_stock", query)
        outcome = orchestrator.handle(payload("¿Qué productos están por agotarse?"), authorization=ADMIN)
        self.assertEqual((outcome.body.estado, outcome.body.texto), ("sin_datos", REASON_TEXTS["NO_ROWS"]))

    def test_period_is_resolved_by_the_backend(self) -> None:
        connection = FakeConnection(rows=[(3,)], names=("orders",))
        query = free(modulo="ventas", tablas=["sales_order"], subject="sales_order", metrics=["order_count"],
                     usa_periodo=True, concepto_tiempo="ordered_at")
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(so.id) AS orders FROM sales_order AS so", query)
        orchestrator.handle(payload("¿Cuántos pedidos hubo ayer?"), authorization=ADMIN)
        time = question_of(server.requests[0]["user_content"])["time"]
        self.assertEqual((time["start"], time["end_exclusive"], time["concept"]), ("2026-10-11", "2026-10-12", "ordered_at"))


class RealBatteryRegressionTests(GuardedTestCase):
    """Fallos observados con XiYanSQL + Neon reales (2026-10-24) y su corrección controlada."""

    def test_status_case_is_normalized_against_known_values(self) -> None:
        sql, changed = MODULES.normalize_literals("SELECT COUNT(*) AS n FROM cash_session AS cs WHERE cs.status = 'open'")
        self.assertTrue(changed)
        self.assertIn("cs.status = 'OPEN'", sql)
        untouched = "SELECT COUNT(*) AS n FROM product AS p WHERE p.name = 'open'"  # sin valores conocidos
        self.assertEqual(MODULES.normalize_literals(untouched), (untouched, False))

    def test_unknown_status_value_triggers_a_retry_with_the_valid_values(self) -> None:
        answers = iter(["SELECT COUNT(so.id) AS order_count FROM sales_order AS so WHERE so.status = 'pending'",
                        "SELECT COUNT(so.id) AS order_count FROM sales_order AS so WHERE so.status NOT IN ('Closed', 'Cancelled')"])
        connection = FakeConnection(rows=[(1,)], names=("order_count",))
        query = free(modulo="ventas", tablas=["sales_order"], subject="sales_order", metrics=["order_count"])
        orchestrator, server = build(connection, lambda b: next(answers), query)
        outcome = orchestrator.handle(payload("¿Cuántos pedidos siguen pendientes?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)
        self.assertEqual(outcome.body.diagnostico.reintento, "UNKNOWN_STATUS_VALUE")
        self.assertIn("Received, Preparing, Served, Closed, Cancelled", server.requests[1]["user_content"])
        self.assertEqual(len(connection.statements) - connection.statements.count(""), len(connection.statements))
        self.assertNotIn("'pending'", " ".join(connection.statements))  # el SQL incorrecto nunca se ejecutó

    def test_period_status_is_not_confused_with_the_entry_status(self) -> None:
        from ai_service.policies.registered_entries import apply_registered_entries_filter

        sql = apply_registered_entries_filter(
            "SELECT ap.id, COUNT(je.id) AS n FROM accounting_period ap LEFT JOIN journal_entry je ON je.period_id = ap.id "
            "WHERE ap.status = 'OPEN' GROUP BY ap.id")
        self.assertIn("je.status = TRUE", sql)

    def test_restricted_questions_are_refused_before_any_model(self) -> None:
        orchestrator, server = build(FakeConnection(), lambda b: "SELECT 1", free())
        for question in ("¿Cuál es la contraseña del administrador?", "¿Cuál es el sueldo de los empleados?",
                         "¿Cuántos usuarios están registrados?"):
            with self.subTest(question=question):
                outcome = orchestrator.handle(payload(question, trace=f"traza-r-{abs(hash(question)) % 10**8:08d}"),
                                              authorization=ADMIN)
                self.assertEqual((outcome.body.estado, outcome.body.texto), ("no_resoluble", REASON_TEXTS["RESTRICTED_DATA"]))
        self.assertEqual(server.requests, [])

    def test_null_aggregate_is_no_data_not_one_record(self) -> None:
        result = FreeResultAdapter().compute(QueryPlan(kind="libre", cuenta="", periodo=None), [{"units_lost": None}])  # type: ignore[arg-type]
        self.assertTrue(result.no_data)


class PrecisionRegressionTests(GuardedTestCase):
    """Correcciones generales tras la batería real de 24 preguntas (2026-10-25); ninguna fija SQL por pregunta."""

    def test_descending_order_puts_nulls_last_unless_the_model_decided(self) -> None:
        sql, changed = MODULES.nulls_last("SELECT p.name, p.price FROM product AS p ORDER BY p.price DESC LIMIT 1")
        self.assertTrue(changed)
        self.assertIn("ORDER BY p.price DESC NULLS LAST", sql)
        for untouched in ("SELECT p.name FROM product AS p ORDER BY p.price ASC",
                          "SELECT p.name FROM product AS p ORDER BY p.price DESC NULLS FIRST"):
            self.assertEqual(MODULES.nulls_last(untouched), (untouched, False))

    def test_interpreter_tables_win_over_rag_noise(self) -> None:
        connection = FakeConnection(rows=[(12,)], names=("table_count",))
        query = free(modulo="ventas", tablas=["dining_table"], subject="dining_table", metrics=["table_count"],
                     busqueda="mesas del restaurante pedidos mesa")
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(dt.id) AS table_count FROM dining_table AS dt", query)
        outcome = orchestrator.handle(payload("¿Cuántas mesas tiene el restaurante?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(list(outcome.body.diagnostico.tablas_prompt), ["dining_table"])
        self.assertNotIn("# Table: order_table", server.requests[0]["user_content"])

    def test_rag_tables_are_only_a_fallback(self) -> None:
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        orchestrator, _server = build(connection, lambda b: "SELECT COUNT(p.id) AS product_count FROM product AS p",
                                      free(tablas=[], subject="productos"))
        outcome = orchestrator.handle(payload("¿Cuántos productos tenemos registrados?"), authorization=ADMIN, diagnostics=True)
        self.assertTrue(outcome.body.diagnostico.tablas_prompt)
        trace = outcome.body.diagnostico
        self.assertEqual(list(trace.tablas_prompt), list(trace.tablas_rag)[: len(trace.tablas_prompt)])

    def test_time_concept_must_be_a_date_column_of_the_chosen_tables(self) -> None:
        connection = FakeConnection(rows=[(3,)], names=("order_count",))
        query = free(modulo="ventas", tablas=["sales_order"], subject="sales_order", metrics=["order_count"],
                     usa_periodo=True, concepto_tiempo="created_at")
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(so.id) AS order_count FROM sales_order AS so", query)
        outcome = orchestrator.handle(payload("¿Cuántos pedidos hubo ayer?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(question_of(server.requests[0]["user_content"])["time"]["concept"], "ordered_at")
        self.assertEqual(outcome.body.diagnostico.ajuste, "TIME_CONCEPT_ADJUSTED")
        self.assertEqual(MODULES.time_concept("issued_at", ["sales_invoice"], "sales_invoice"), ("issued_at", False))

    def test_historical_question_without_dates_covers_the_whole_history(self) -> None:
        connection = FakeConnection(rows=[("Lomo", 40)], names=("name", "units_sold"))
        query = free(modulo="ventas", tablas=["order_item", "product"], subject="order_item", intent="ranking",
                     metrics=["units_sold"], usa_periodo=True, concepto_tiempo="ordered_at")
        orchestrator, server = build(connection, lambda b: "SELECT p.name, SUM(oi.quantity) AS units_sold FROM order_item AS oi "
                                     "JOIN product AS p ON p.id = oi.product_id GROUP BY p.name ORDER BY units_sold DESC LIMIT 1",
                                     query, historico=True)
        outcome = orchestrator.handle(payload("¿Cuál es el producto más vendido?"), authorization=ADMIN)
        time = question_of(server.requests[0]["user_content"])["time"]
        self.assertEqual(time["start"], "2000-01-01")
        self.assertIn("todo el historial", outcome.body.detalle.nota)

    def test_english_goal_reaches_the_evidence_first(self) -> None:
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        goal = "Count all rows of product; do not filter by active."
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(p.id) AS product_count FROM product AS p",
                                     free(pregunta_en=goal))
        orchestrator.handle(payload("¿Cuántos productos tenemos registrados?"), authorization=ADMIN)
        evidence = server.requests[0]["user_content"].rsplit("〖参考信息〗", 1)[1]
        self.assertTrue(evidence.lstrip().startswith(goal))
        self.assertEqual(FreeQuery.model_validate({**free().model_dump(), "pregunta_en": "Use {{c1}}"}).pregunta_en, "")

    def test_operating_expenses_use_operational_tables_not_accounting(self) -> None:
        connection = FakeConnection(rows=[(Decimal("150.00"),)], names=("total_amount",))
        query = free(modulo="contabilidad", tablas=["journal_entry_detail", "accounting_account"],
                     subject="journal_entry_detail", metrics=["total_amount"], filters=[
                         {"field": "purchase_type", "operator": "eq", "value": "OperatingExpense"}])
        orchestrator, server = build(connection, lambda b: "SELECT SUM(ip.amount_paid) AS total_amount FROM informal_purchase AS ip "
                                     "WHERE ip.purchase_type = 'OperatingExpense'", query, concepto="gastos_operativos")
        outcome = orchestrator.handle(payload("¿Cuánto gastamos en gastos operativos?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(list(outcome.body.diagnostico.tablas_prompt), ["informal_purchase"])
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)

    def test_concrete_filter_a_family_cannot_apply_goes_to_the_extended_route(self) -> None:
        connection = FakeConnection(rows=[(Decimal("80.00"),)], names=("total_paid",))
        query = free(modulo="ventas", tablas=["sales_payment", "payment_type"], subject="sales_payment", metrics=["total_paid"],
                     filters=[{"field": "name", "operator": "eq", "value": "Yape"}])
        orchestrator, _server = build(connection, lambda b: "SELECT SUM(sp.amount) AS total_paid FROM sales_payment AS sp "
                                      "JOIN payment_type AS pt ON pt.id = sp.payment_type_id WHERE pt.name = 'Yape'",
                                      query, consulta="ventas_cobradas_total", concepto="cobros")
        outcome = orchestrator.handle(payload("¿Cuánto cobramos con Yape?"), authorization=ADMIN, diagnostics=True)
        trace = outcome.body.diagnostico
        self.assertEqual((trace.ruta, trace.ajuste), ("ampliada", "FAMILY_FILTER_NOT_SUPPORTED"))
        # Sin filtro concreto, la familia entrenada sigue teniendo prioridad.
        orchestrator, _server = build(connection, lambda b: "SELECT 1", free(filters=[], metrics=["collected_amount"]),
                                      consulta="ventas_cobradas_total", concepto="cobros")
        outcome = orchestrator.handle(payload("¿Cuánto cobramos?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.diagnostico.ruta, "entrenada")

    def test_unrequested_numbers_are_not_the_main_answer(self) -> None:
        plan = QueryPlan(kind="libre", cuenta="", periodo=None, solicitud={"metrics": []})  # type: ignore[arg-type]
        result = FreeResultAdapter().compute(plan, [{"name": "Octubre 2026", "entries": 7}])
        self.assertEqual(result.labels[result.primary[0]], "Registros devueltos")
        self.assertIn("Octubre 2026", result.text_labels.values())
        self.assertIn("Entries", result.labels.values())  # el número sigue en el detalle
        plan = QueryPlan(kind="libre", cuenta="", periodo=None, solicitud={"metrics": ["order_count"]})  # type: ignore[arg-type]
        result = FreeResultAdapter().compute(plan, [{"table_count": 12, "order_count": 30}])
        self.assertEqual([result.labels[m] for m in result.primary], ["Order count"])


class FreeResultTests(GuardedTestCase):
    def plan(self) -> QueryPlan:
        return QueryPlan(kind="libre", cuenta="", periodo=None, tablas=("product",))  # type: ignore[arg-type]

    def test_units_come_only_from_column_names(self) -> None:
        result = FreeResultAdapter().compute(self.plan(), [{"average_order_amount": Decimal("40.62"), "order_count": 10}])
        self.assertEqual([(f.valor, f.unidad) for f in result.figures], [(Decimal("40.62"), "PEN"), (Decimal("10"), "N")])

    def test_identifying_numbers_are_labels_and_additive_columns_get_a_total(self) -> None:
        last = FreeResultAdapter().compute(self.plan(), [{"series": "F001", "number": 44444444, "purchase_amount": Decimal("58.88")}])
        self.assertEqual([f.valor for f in last.figures], [Decimal("58.88")])
        rows = [{"name": "Pollo entero", "current_stock": Decimal("90.00")}, {"name": "Pollo 1/4", "current_stock": Decimal("3.00")}]
        stock = FreeResultAdapter().compute(self.plan(), rows)
        self.assertEqual((stock.figures[1].valor, stock.figures[1].origen), (Decimal("93.00"), "motor"))
        prices = FreeResultAdapter().compute(self.plan(), [{"name": "A", "price": Decimal("10")}, {"name": "B", "price": Decimal("5")}])
        self.assertNotIn("Total · price", prices.labels.values())  # los precios no se suman

    def test_text_lists_are_shown_without_inventing_numbers(self) -> None:
        rows = [{"id": i, "name": f"Producto {i}"} for i in range(1, 4)]
        result = FreeResultAdapter().compute(self.plan(), rows)
        self.assertEqual([(f.valor, f.origen) for f in result.figures], [(Decimal("3"), "motor")])
        self.assertEqual(result.text_labels["e1"], "Producto 1")
        self.assertIn("Producto 3", result.notes[0])


class ModuleClaimTests(GuardedTestCase):
    def verify(self, **overrides):
        token = sign(claims(**overrides), key=KEY)
        return verify_identity_assertion(token, key=KEY, trace_id=claims()["jti"], user_id=7, rol="contador_demo",
                                         now=claims()["iat"] + 1)

    def test_module_claim_is_optional_and_validated(self) -> None:
        self.assertIsNone(self.verify().modulos)
        self.assertEqual(self.verify(mod=["ventas", "compras"]).modulos, frozenset({"ventas", "compras"}))
        for bad in ("ventas", ["Ventas"], [1], ["x" * 40]):
            with self.subTest(bad=bad), self.assertRaises(IdentityError):
                self.verify(mod=bad)


class StabilizationTests(GuardedTestCase):
    """Fase de estabilización (2026-10-25): aciertos por casualidad y fallos semánticos de la batería real.
    Correcciones generales guiadas por el catálogo; ninguna fija SQL ni respuestas por pregunta."""

    def test_values_written_in_the_question_are_recognized_from_the_catalog(self) -> None:
        self.assertEqual(MODULES.mentioned_values("¿Cuántas facturas de venta se emitieron?", ["sales_invoice"]),
                         [("sales_invoice", "voucher_type", "Factura")])
        self.assertEqual(MODULES.mentioned_values("¿Cuánto se pagó con tarjeta?", ["sales_payment", "payment_type"]),
                         [("payment_type", "name", "Tarjeta / POS")])
        self.assertEqual(MODULES.mentioned_values("¿Cuánto vendimos en boletas y facturas?", ["sales_invoice"]), [])  # desglose
        self.assertEqual(MODULES.mentioned_values("¿Cuántas ventas facturadas hubo?", ["sales_invoice"]), [])

    def test_requested_filter_must_be_applied_and_must_filter_something(self) -> None:
        tables = ["sales_payment", "payment_type"]
        self.assertEqual(MODULES.filter_problem("SELECT SUM(sp.amount) AS t FROM sales_payment AS sp",
                                                [("eq", "Yape")], tables), "FILTER_NOT_APPLIED")
        self.assertIsNone(MODULES.filter_problem(
            "SELECT SUM(sp.amount) AS t FROM sales_payment AS sp JOIN payment_type AS pt ON pt.id = sp.payment_type_id "
            "WHERE pt.name LIKE '%Yape%'", [("contains", "Yape")], tables))
        self.assertEqual(MODULES.filter_problem(
            "SELECT COUNT(cm.id) AS n FROM cash_movement AS cm WHERE cm.type IN ('INCOME', 'EXPENSE')", [], ["cash_movement"]),
            "FILTER_NOOP")

    def test_left_join_nullified_by_where_is_detected(self) -> None:
        wrong = ("SELECT p.id, p.name FROM product AS p LEFT JOIN order_item AS oi ON oi.product_id = p.id "
                 "LEFT JOIN sales_order AS so ON so.id = oi.order_id WHERE so.ordered_at >= CAST('2026-10-01' AS TIMESTAMP) "
                 "GROUP BY p.id, p.name HAVING COUNT(oi.id) = 0")
        self.assertTrue(MODULES.left_join_nullified(wrong))
        for right in ("SELECT p.id FROM product AS p WHERE NOT EXISTS (SELECT 1 FROM order_item AS oi WHERE oi.product_id = p.id)",
                      "SELECT p.id FROM product AS p LEFT JOIN order_item AS oi ON oi.product_id = p.id AND oi.quantity > 0 "
                      "WHERE oi.id IS NULL"):
            self.assertFalse(MODULES.left_join_nullified(right))

    def test_noop_filter_is_retried_once_and_never_executed(self) -> None:
        answers = iter(["SELECT COUNT(cm.id) AS movement_count FROM cash_movement AS cm WHERE cm.type IN ('INCOME', 'EXPENSE')",
                        "SELECT COUNT(cm.id) AS movement_count FROM cash_movement AS cm WHERE cm.type = 'EXPENSE'"])
        connection = FakeConnection(rows=[(2,)], names=("movement_count",))
        query = free(modulo="caja", tablas=["cash_movement"], subject="cash_movement", metrics=["movement_count"])
        orchestrator, _server = build(connection, lambda b: next(answers), query)
        outcome = orchestrator.handle(payload("¿Cuántos egresos de caja hubo?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.diagnostico.reintento, "FILTER_NOOP")
        self.assertNotIn("'INCOME'", " ".join(connection.statements))
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)

    def test_set_operation_retry_reads_only_the_main_table(self) -> None:
        answers = iter(["SELECT pi.total_amount FROM purchase_invoice AS pi UNION ALL SELECT ip.amount_paid FROM informal_purchase AS ip",
                        "SELECT pi.total_amount FROM purchase_invoice AS pi ORDER BY pi.issued_at DESC LIMIT 1"])
        connection = FakeConnection(rows=[(Decimal("58.88"),)], names=("total_amount",))
        query = free(modulo="compras", tablas=["purchase_invoice", "informal_purchase"], subject="purchase_invoice",
                     intent="detail", metrics=["total_amount"])
        orchestrator, server = build(connection, lambda b: next(answers), query)
        outcome = orchestrator.handle(payload("¿Cuál fue la última compra registrada?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.diagnostico.reintento, "SET_OPERATION")
        self.assertNotIn("# Table: informal_purchase", server.requests[1]["user_content"])
        self.assertEqual([f.valor for f in outcome.body.cifras], [Decimal("58.88")])

    @staticmethod
    def family(family: str, rows, names, message: str, query: FreeQuery | None = None, concepto: str = "cobros"):
        from test_query_families import training_sql_for

        connection = FakeConnection(rows=rows, names=names)
        orchestrator, server = build(connection, training_sql_for, query, consulta=family, concepto=concepto)
        return orchestrator.handle(payload(message), authorization=ADMIN, diagnostics=True)

    def test_grouped_family_answers_the_requested_group(self) -> None:
        rows = [(2, "Efectivo", 4, Decimal("179.20")), (3, "Tarjeta / POS", 5, Decimal("217.10"))]
        names = ("payment_type_id", "payment_type_name", "sales_payment_count", "sales_payments_total")
        body = self.family("ventas_cobradas_por_medio_pago", rows, names, "¿Cuánto se pagó con tarjeta este mes?").body
        self.assertEqual((body.diagnostico.ruta, body.diagnostico.ajuste), ("entrenada", "FAMILY_GROUP_FOCUS"))
        self.assertEqual(body.cifras[0].valor, Decimal("217.10"))  # la cifra principal es el grupo pedido, no el total
        self.assertIn("217.10", body.texto)

    def test_requested_group_without_rows_is_zero_not_the_total(self) -> None:
        body = self.family("pedidos_por_tipo", [("Mesa", 10)], ("order_type", "sales_order_count"),
                           "¿Cuántos pedidos para llevar hubo en total?", concepto="pedidos").body
        self.assertEqual((body.cifras[0].valor, body.cifras[0].origen), (Decimal("0"), "motor"))
        self.assertIn("No hubo registros de Llevar", body.detalle.nota)

    def test_value_a_family_cannot_filter_goes_to_the_extended_route_with_the_filter(self) -> None:
        connection = FakeConnection(rows=[(3,)], names=("sales_invoice_count",))
        query = free(modulo="ventas", tablas=["sales_invoice"], subject="sales_invoice", metrics=["sales_invoice_count"])
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(si.id) AS sales_invoice_count FROM sales_invoice AS si "
                                     "WHERE si.voucher_type = 'Factura'", query, consulta="comprobantes_venta_cantidad",
                                     concepto="ventas_facturadas")
        outcome = orchestrator.handle(payload("¿Cuántas facturas de venta se emitieron?"), authorization=ADMIN, diagnostics=True)
        trace = outcome.body.diagnostico
        self.assertEqual((trace.ruta, trace.ajuste), ("ampliada", "FAMILY_FILTER_NOT_SUPPORTED"))
        filters = question_of(server.requests[0]["user_content"])["filters"]
        self.assertIn({"field": "voucher_type", "operator": "eq", "value": "Factura"}, filters)

    def test_grouped_family_names_the_leading_group(self) -> None:
        from ai_service.sqlgen.family_result import FamilyResultAdapter
        from test_query_families import CATALOG

        plan = QueryPlan(kind="familia", cuenta="", periodo=None, familia="compras_por_proveedor")  # type: ignore[arg-type]
        rows = [{"supplier_id": 1, "business_name": "A", "purchase_invoiced_total": Decimal("10")},
                {"supplier_id": 2, "business_name": "B", "purchase_invoiced_total": Decimal("30")}]
        result = FamilyResultAdapter(CATALOG).compute(plan, rows)
        leader = [m for m in result.primary if result.labels[m].startswith("Mayor")]
        self.assertEqual([result.figures[int(m[1:]) - 1].valor for m in leader], [Decimal("30")])
        self.assertIn("B", result.text_labels.values())

    def test_unparseable_sql_is_retried_without_adding_accounting_tables(self) -> None:
        answers = iter(["SELECT pi.total_amount, (SELECT json_agg(x)) ORDER BY 1) FROM purchase_invoice pi",
                        "SELECT pi.total_amount FROM purchase_invoice AS pi ORDER BY pi.issued_at DESC LIMIT 1"])
        connection = FakeConnection(rows=[(Decimal("58.88"),)], names=("total_amount",))
        query = free(modulo="compras", tablas=["purchase_invoice"], subject="purchase_invoice", intent="detail", metrics=["total_amount"])
        orchestrator, server = build(connection, lambda b: next(answers), query)
        outcome = orchestrator.handle(payload("¿Cuál fue la última compra registrada?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.diagnostico.reintento, "UNPARSEABLE_SQL")
        self.assertNotIn("# Table: journal_entry", server.requests[1]["user_content"])
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)

    def test_state_filters_with_a_table_prefix_do_not_divert_a_family(self) -> None:
        from test_query_families import training_sql_for

        connection = FakeConnection(rows=[(Decimal("406.20"), Decimal("1893.01"))],
                                    names=("invoiced_sales_total", "purchase_invoiced_total"))
        query = free(modulo="ventas", tablas=["sales_invoice", "purchase_invoice"], subject="sales_invoice", intent="comparison",
                     metrics=["invoiced_sales_total", "purchase_invoiced_total"],
                     filters=[{"field": "sales_invoice_status", "operator": "eq", "value": "Issued"}])
        orchestrator, _server = build(connection, training_sql_for, query, consulta="ventas_vs_compras_facturadas",
                                      concepto="resultado_facturado")
        outcome = orchestrator.handle(payload("¿Cuál es la diferencia entre las compras y las ventas de este mes?"),
                                      authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.diagnostico.ruta, "entrenada")

    def test_aggregation_a_family_does_not_compute_goes_to_the_extended_route(self) -> None:
        connection = FakeConnection(rows=[(Decimal("45.13"),)], names=("average_invoice_amount",))
        query = free(modulo="ventas", tablas=["sales_invoice"], subject="sales_invoice", metrics=["average_invoice_amount"])
        orchestrator, _server = build(connection, lambda b: "SELECT AVG(si.total_amount) AS average_invoice_amount FROM sales_invoice AS si",
                                      query, consulta="ventas_facturadas_por_comprobante", concepto="ventas_facturadas")
        outcome = orchestrator.handle(payload("¿Cuál es el importe promedio de los comprobantes de venta?"),
                                      authorization=ADMIN, diagnostics=True)
        self.assertEqual((outcome.body.diagnostico.ruta, outcome.body.cifras[0].valor), ("ampliada", Decimal("45.13")))

    def test_evidence_keeps_the_notes_relevant_to_the_goal_within_the_limit(self) -> None:
        grants = ALLOWLIST.roles["contador_demo"]
        evidence = MODULES.evidence(["product_recipe", "product"], grants,
                                    "List ingredients from product_recipe for the product whose name matches pollo a la brasa.")
        self.assertLessEqual(len(evidence), 700)
        self.assertIn("ILIKE", evidence)

    def test_unrequested_business_flags_are_rejected_and_retried(self) -> None:
        sql = "SELECT COUNT(*) AS product_count FROM product WHERE product.active = TRUE AND product.sellable = TRUE"
        self.assertEqual(MODULES.unrequested_flags(sql, "Count all rows in product", ["product"]), ["active", "sellable"])
        self.assertEqual(MODULES.unrequested_flags(sql, "Count active sellable products", ["product"]), [])
        answers = iter([sql, "SELECT COUNT(*) AS product_count FROM product"])
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        orchestrator, server = build(connection, lambda b: next(answers), free(pregunta_en="Count all rows in product."))
        outcome = orchestrator.handle(payload("¿Cuántos productos tenemos registrados?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.diagnostico.reintento, "UNREQUESTED_FILTER")
        self.assertIn("Do not filter by active, sellable", server.requests[1]["user_content"])
        self.assertEqual(outcome.body.cifras[0].valor, Decimal("20"))

    def test_text_patterns_must_come_from_the_question(self) -> None:
        # Regresión real (2026-10-25): el modelo copió "ILIKE '%text%'" de una nota y respondió 0 proveedores.
        sql = "SELECT COUNT(s.id) AS supplier_count FROM supplier AS s WHERE s.business_name ILIKE '%text%'"
        self.assertEqual(MODULES.invented_patterns(sql, "¿Cuántos proveedores tenemos? Count rows in supplier."), ["%text%"])
        self.assertEqual(MODULES.invented_patterns("SELECT 1 FROM product p WHERE p.name ILIKE '%pollo a la brasa%'",
                                                   "¿Qué insumos lleva la receta del Pollo a la Brasa?"), [])
        answers = iter([sql, "SELECT COUNT(s.id) AS supplier_count FROM supplier AS s"])
        connection = FakeConnection(rows=[(4,)], names=("supplier_count",))
        query = free(modulo="proveedores", tablas=["supplier"], subject="supplier", metrics=["supplier_count"],
                     pregunta_en="Count rows in supplier.")
        orchestrator, _server = build(connection, lambda b: next(answers), query)
        outcome = orchestrator.handle(payload("¿Cuántos proveedores tenemos registrados en total?"), authorization=ADMIN,
                                      diagnostics=True)
        self.assertEqual(outcome.body.diagnostico.reintento, "UNREQUESTED_FILTER")
        self.assertNotIn("%text%", " ".join(connection.statements))
        self.assertNotIn("'%text%'", json.dumps(MODULES.fragments()[0].contenido))

    def test_table_names_are_not_text_the_user_searched_for(self) -> None:
        # Regresión real (corrida v7): ILIKE '%supplier%' pasaba porque "supplier" estaba en el objetivo en inglés.
        answers = iter(["SELECT COUNT(s.id) AS supplier_count FROM supplier AS s WHERE s.business_name ILIKE '%supplier%'",
                        "SELECT COUNT(s.id) AS supplier_count FROM supplier AS s"])
        connection = FakeConnection(rows=[(4,)], names=("supplier_count",))
        query = free(modulo="proveedores", tablas=["supplier"], subject="supplier", metrics=["supplier_count"],
                     pregunta_en="Count rows in supplier.")
        orchestrator, _server = build(connection, lambda b: next(answers), query)
        outcome = orchestrator.handle(payload("¿Cuántos proveedores tenemos registrados en total?"), authorization=ADMIN,
                                      diagnostics=True)
        self.assertEqual((outcome.body.diagnostico.reintento, outcome.body.cifras[0].valor), ("UNREQUESTED_FILTER", Decimal("4")))

    def test_family_answers_with_the_requested_metric(self) -> None:
        from ai_service.orchestrator.pipeline import Orchestrator
        from ai_service.sqlgen.family_result import FamilyResultAdapter
        from test_query_families import CATALOG

        family = CATALOG.get("ventas_por_plato")
        metric = Orchestrator._family_metric(family, free(metrics=["units_sold"]))
        self.assertEqual(metric, "dish_units_sold")
        self.assertIsNone(Orchestrator._family_metric(family, free(metrics=["total"])))  # no distingue: la principal
        plan = QueryPlan(kind="familia", cuenta="", periodo=None, familia="ventas_por_plato", metrica=metric)  # type: ignore[arg-type]
        rows = [{"dish_id": 1, "dish_name": "1/4 Pollo", "dish_units_sold": 11, "dish_sales_amount": Decimal("240.90")},
                {"dish_id": 2, "dish_name": "Chicha", "dish_units_sold": 13, "dish_sales_amount": Decimal("60.00")}]
        result = FamilyResultAdapter(CATALOG).compute(plan, rows)
        self.assertEqual([result.figures[int(m[1:]) - 1].valor for m in result.primary][0], Decimal("24"))

    def test_voided_entries_are_refused_not_answered_with_registered_ones(self) -> None:
        # Regresión real (corrida v9): "¿cuántos asientos anulados?" respondió los 81 registrados (P-4 fuerza status = TRUE).
        connection = FakeConnection(rows=[(81,)], names=("journal_entry_count",))
        query = free(modulo="contabilidad", tablas=["journal_entry"], subject="journal_entry", metrics=["journal_entry_count"],
                     filters=[{"field": "annulled", "operator": "eq", "value": "true"}])
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(je.id) AS journal_entry_count FROM journal_entry AS je", query)
        outcome = orchestrator.handle(payload("¿Cuántos asientos contables están anulados?"), authorization=ADMIN)
        self.assertEqual((outcome.body.estado, outcome.body.texto), ("no_resoluble", REASON_TEXTS["VOIDED_ENTRIES_NOT_AVAILABLE"]))
        self.assertEqual((server.requests, connection.statements), ([], []))
        # Otros "anulados" (transformaciones) no son asientos: siguen respondiéndose.
        connection = FakeConnection(rows=[(1,)], names=("transformation_count",))
        query = free(modulo="inventario", tablas=["transformation"], subject="transformation", metrics=["transformation_count"])
        orchestrator, _server = build(connection, lambda b: "SELECT COUNT(t.id) AS transformation_count FROM transformation AS t "
                                      "WHERE t.annulled = TRUE", query)
        outcome = orchestrator.handle(payload("¿Cuántas transformaciones fueron anuladas?"), authorization=ADMIN)
        self.assertEqual(outcome.body.estado, "respondida", outcome.audit.codigos_rechazo)

    def test_latest_record_by_date_breaks_ties_by_key(self) -> None:
        sql, changed = MODULES.latest_tiebreak("SELECT pi.total_amount FROM purchase_invoice AS pi ORDER BY pi.issued_at DESC LIMIT 1")
        self.assertTrue(changed)
        self.assertIn("ORDER BY pi.issued_at DESC, pi.id DESC NULLS LAST LIMIT 1", sql)
        for untouched in ("SELECT im.quantity FROM inventory_movement AS im ORDER BY im.moved_at DESC LIMIT 1",  # TIMESTAMP
                          "SELECT pi.total_amount FROM purchase_invoice AS pi ORDER BY pi.issued_at DESC"):  # sin LIMIT
            self.assertEqual(MODULES.latest_tiebreak(untouched), (untouched, False))

    def test_main_figures_follow_the_order_of_the_requested_metrics(self) -> None:
        plan = QueryPlan(kind="libre", cuenta="", periodo=None,  # type: ignore[arg-type]
                         solicitud={"metrics": ["difference", "counted_amount", "expected_amount"]})
        result = FreeResultAdapter().compute(plan, [{"expected_amount": Decimal("756.20"), "counted_amount": Decimal("756.20"),
                                                     "difference": Decimal("0.00")}])
        self.assertEqual(result.labels[result.primary[0]], "Difference")

    def test_subject_read_through_its_key_is_not_a_mismatch(self) -> None:
        connection = FakeConnection(rows=[(4,)], names=("distinct_supplier_count",))
        query = free(modulo="compras", tablas=["purchase_invoice", "supplier"], subject="supplier",
                     metrics=["distinct_supplier_count"])
        orchestrator, server = build(connection, lambda b: "SELECT COUNT(DISTINCT pi.supplier_id) AS distinct_supplier_count "
                                     "FROM purchase_invoice AS pi", query)
        outcome = orchestrator.handle(payload("¿A cuántos proveedores distintos les compramos?"), authorization=ADMIN)
        self.assertEqual((outcome.body.estado, len(server.requests)), ("respondida", 1))

    def test_unknown_column_hint_names_the_column_and_the_valid_dates(self) -> None:
        missing, dates = MODULES.unknown_columns("SELECT im.quantity FROM inventory_movement im ORDER BY im.created_at DESC",
                                                 ["inventory_movement"])
        self.assertEqual((missing, dates), (["created_at"], ["inventory_movement.moved_at"]))

    def test_ranking_answer_is_the_first_place(self) -> None:
        plan = QueryPlan(kind="libre", cuenta="", periodo=None, solicitud={"intent": "ranking", "metrics": ["quantity_sold"]})  # type: ignore[arg-type]
        result = FreeResultAdapter().compute(plan, [{"product_name": "1/4 Pollo", "quantity_sold": 11},
                                                    {"product_name": "Chicha", "quantity_sold": 5}])
        self.assertEqual(result.figures[0].valor, Decimal("11"))
        self.assertIn(result.figures[0].marcador, result.primary)
        self.assertIn("1/4 Pollo", result.text_labels.values())

    def test_requested_count_without_a_count_column_counts_the_rows(self) -> None:
        plan = QueryPlan(kind="libre", cuenta="", periodo=None, solicitud={"metrics": ["cash_session_count"]})  # type: ignore[arg-type]
        result = FreeResultAdapter().compute(plan, [{"status": "OPEN", "sales_cash": Decimal("129.20")}])
        self.assertEqual([result.labels[m] for m in result.primary], ["Registros devueltos"])

    def test_interpreter_sees_the_catalog_business_rules(self) -> None:
        from ai_service.llm.openai_provider import _business_rules

        rules = _business_rules(MODULES)
        self.assertIn("never compute stock from inventory_movement", rules)
        self.assertIn("EXPENSE is cash outflow", rules)
