"""Seguridad con TODAS las optimizaciones activas (``AI_PERF_OPT=1`` y ``AI_PERF_CACHE=1``).

Ensamblado real (``build_dev_orchestrator``) con el validador AST, ``allowlist.readonly_erp.json``, permisos
por módulo, pool de conexiones, RAG en paralelo y cachés; simulados solo el intérprete, el servidor de
inferencia y la conexión PostgreSQL. Comprueba que ni la caché ni la reutilización de conexiones permiten
ejecutar escritura, leer datos restringidos o saltarse los permisos de cada petición.
"""

from __future__ import annotations

from guards import GuardedTestCase
from sqlgen_support import NOW, FakeInferenceServer, payload, xiyan_env
from test_free_route import ADMIN, free
from test_postgres_executor import REAL_ENV, Factory, FakeConnection

from ai_service.assembly import PerfComponents, build_dev_orchestrator
from ai_service.config.settings import PERF_CACHE_VAR, PERF_OPT_VAR, SQLGEN_TOKEN_VAR, load_service_settings
from ai_service.orchestrator.ports import AuthorizationContext, Interpretation

PRODUCT_COUNT = "SELECT COUNT(p.id) AS product_count FROM product AS p"
QUESTION = "¿Cuántos productos tenemos registrados?"


def build_optimized(connection: FakeConnection, sql_for, query=None, **interpretation):
    env = {**xiyan_env(), **REAL_ENV, PERF_OPT_VAR: "1", PERF_CACHE_VAR: "1"}
    settings = load_service_settings(env)
    server = FakeInferenceServer(env[SQLGEN_TOKEN_VAR])
    server.text_for = sql_for
    factory = Factory(connection)
    perf = PerfComponents()
    orchestrator, _ = build_dev_orchestrator(
        settings, clock=lambda: NOW, sqlgen_transport=server.transport(), readonly_connection_factory=factory, perf=perf
    )

    class Interpreter:
        def interpret(self, request):
            return Interpretation(intencion="consulta_financiera", consulta_libre=query, **interpretation)

    orchestrator._interpreter = Interpreter()
    return orchestrator, server, factory, perf


def executed(connection: FakeConnection) -> list[str]:
    return [s for s in connection.statements if not s.startswith(("SET ", "SHOW "))]


class OptimizedSecurityTests(GuardedTestCase):
    def test_everything_is_active(self) -> None:
        _, _, _, perf = build_optimized(FakeConnection(), lambda b: PRODUCT_COUNT, free())
        for name in ("CACHE", "NEON_POOL", "RAG_PARALLEL", "KEEPALIVE_120S"):
            self.assertIn(name, perf.active)

    def test_write_sql_is_rejected_even_when_served_from_cache(self) -> None:
        for sql in ("DELETE FROM product", "UPDATE product SET price = 0", "INSERT INTO product (name) VALUES ('x')",
                    "SELECT COUNT(p.id) AS n FROM product AS p; DELETE FROM product"):
            with self.subTest(sql=sql):
                connection = FakeConnection(rows=[(1,)], names=("n",))
                orchestrator, server, factory, _ = build_optimized(connection, lambda b, sql=sql: sql, free())
                first = orchestrator.handle(payload(QUESTION, trace="traza-sec-w-0001"), authorization=ADMIN, diagnostics=True)
                generations = len(server.requests)  # intento + reintento con pista (prompts distintos)
                second = orchestrator.handle(payload(QUESTION, trace="traza-sec-w-0002"), authorization=ADMIN, diagnostics=True)
                for outcome in (first, second):
                    self.assertNotEqual(outcome.body.estado, "respondida")
                self.assertEqual(len(server.requests), generations)  # la segunda petición salió entera de la caché...
                # El acierto queda en los eventos [OPT]; la etapa conserva su código de fallo (no se sobrescribe).
                self.assertIn("CACHE_HIT", {code for code, _ in second.events})
                self.assertEqual(executed(connection), [])  # ...y aun así nada se ejecutó en la base
                self.assertEqual(factory.calls, 0)  # ni se abrió ninguna conexión

    def test_restricted_tables_and_columns_are_rejected(self) -> None:
        for sql in ('SELECT username, password FROM "user"', "SELECT business_name, ruc FROM supplier",
                    "SELECT id, action FROM audit_log"):
            with self.subTest(sql=sql):
                connection = FakeConnection()
                orchestrator, _, factory, _ = build_optimized(connection, lambda b, sql=sql: sql, free())
                outcome = orchestrator.handle(payload(QUESTION), authorization=ADMIN, diagnostics=True)
                self.assertEqual(outcome.body.estado, "no_resoluble")
                self.assertIn("SQL_REJECTED", outcome.audit.codigos_rechazo)
                self.assertEqual((executed(connection), factory.calls), ([], 0))

    def test_cached_sql_still_respects_the_modules_of_each_request(self) -> None:
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        orchestrator, server, _, _ = build_optimized(connection, lambda b: PRODUCT_COUNT, free())
        allowed = orchestrator.handle(payload(QUESTION, trace="traza-sec-m-0001"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(allowed.body.estado, "respondida", allowed.audit.codigos_rechazo)
        sales_only = AuthorizationContext(rol="contador_demo", origen="erp-session", autenticado=True, modulos=frozenset({"ventas"}))
        denied = orchestrator.handle(payload(QUESTION, trace="traza-sec-m-0002"), authorization=sales_only, diagnostics=True)
        self.assertEqual(denied.body.estado, "no_resoluble")
        # Sin el módulo «productos», el RAG propone tablas de ventas: el modelo (simulado) vuelve a leer product y el
        # control de módulos de ESTA petición lo rechaza antes del Executor.
        self.assertTrue({"MODULE_NOT_PERMITTED", "NO_AUTHORIZED_TABLES"} & set(denied.audit.codigos_rechazo))
        self.assertEqual(len(executed(connection)), 1)  # solo la petición autorizada llegó a la base

    def test_cache_hit_still_validates_and_executes_with_fresh_rows(self) -> None:
        connection = FakeConnection(rows=[(20,)], names=("product_count",))
        orchestrator, server, factory, _ = build_optimized(connection, lambda b: PRODUCT_COUNT, free())
        first = orchestrator.handle(payload(QUESTION, trace="traza-sec-c-0001"), authorization=ADMIN, diagnostics=True)
        connection.rows = [(21,)]  # la base cambió entre las dos preguntas
        second = orchestrator.handle(payload(QUESTION, trace="traza-sec-c-0002"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(len(server.requests), 1)  # XiYanSQL solo se invocó una vez
        self.assertEqual([f.valor for f in first.body.cifras], [20])
        self.assertEqual([f.valor for f in second.body.cifras], [21])  # la cifra es la de la base, no la cacheada
        stages = {s.etapa: s for s in second.body.diagnostico.etapas}
        self.assertEqual(stages["generacion_sql"].codigo, "CACHE_HIT")
        self.assertEqual(stages["validacion_sql"].estado, "ok")  # el validador se ejecutó también en el acierto
        self.assertEqual(len(executed(connection)), 2)
        self.assertEqual(connection.statements.count("SET TRANSACTION READ ONLY"), 2)
        self.assertEqual(factory.calls, 1)  # pool: una sola conexión para las dos consultas

    def test_restricted_question_never_reaches_the_sql_model(self) -> None:
        connection = FakeConnection()
        orchestrator, server, factory, _ = build_optimized(connection, lambda b: PRODUCT_COUNT, None, restringido=True)
        outcome = orchestrator.handle(payload("¿Cuál es el RUC de nuestros proveedores?"), authorization=ADMIN, diagnostics=True)
        self.assertEqual(outcome.body.estado, "no_resoluble")
        self.assertIn("RESTRICTED_DATA", outcome.audit.codigos_rechazo)
        self.assertEqual((len(server.requests), factory.calls), (0, 0))
        self.assertNotIn("generacion_sql", {s.etapa for s in outcome.body.diagnostico.etapas})
