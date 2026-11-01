"""Optimizaciones de rendimiento: indicadores, paralelismo, reutilización de conexiones, cachés y registros.

Sin red ni modelos: proveedores, conexiones y servidor de inferencia simulados. Cada prueba comprueba el
efecto real (llamadas evitadas, conexiones reutilizadas, solapamiento medido), no solo que el indicador exista.
"""

from __future__ import annotations

import io
import threading
import time
from decimal import Decimal

from guards import GuardedTestCase

from ai_service.config.settings import (
    LLM_EXPLAIN_REASONING_VAR,
    LLM_REASONING_VAR,
    PERF_CACHE_VAR,
    PERF_CONSOLE_VAR,
    PERF_OPT_VAR,
    ServiceConfigError,
    load_service_settings,
)
from ai_service.execution.postgres_readonly import ConnectionPool, PostgresReadOnlyExecutor
from ai_service.llm.budget import BudgetGuard, CallRequest, UsageLog
from ai_service.llm.openai_provider import OpenAiResponsesProvider, _ConnectionProbe
from ai_service.orchestrator import diagnostics
from ai_service.orchestrator.ports import AuthorizationContext, ExecutionRefused, ExecutionFailed
from ai_service.perf.cache import CachingGenerationClient, TtlCache
from ai_service.perf.console import print_outcome
from ai_service.simulation.components import KeywordRetriever
from ai_service.simulation.llm import MockLlmProvider
from ai_service.orchestrator.ports import Fragment
from pipeline_support import GOLD, NOW, SIM_PRICING, build_harness, make_policy, request
from test_openai_provider import CATALOG, PRICE, FakeOpenAI, explain_request, fake_key, interpret_request, openai_env
from test_postgres_executor import NAMES, DbError, FakeConnection, approved

AUTH = AuthorizationContext(rol="contador_demo", origen="ct-b-provisional")
SALDO = "¿Cuál fue el saldo de caja en septiembre?"


class SettingsFlagsTests(GuardedTestCase):
    def test_optimizations_are_off_by_default_and_reversible(self) -> None:
        settings = load_service_settings(openai_env())
        self.assertEqual((settings.perf_opt, settings.perf_cache, settings.perf_console), (False, False, False))
        on = load_service_settings(openai_env(**{PERF_OPT_VAR: "1", PERF_CACHE_VAR: "1", PERF_CONSOLE_VAR: "1"}))
        self.assertEqual((on.perf_opt, on.perf_cache, on.perf_console), (True, True, True))
        for value in ("si", "2", "true"):
            with self.subTest(value=value), self.assertRaises(ServiceConfigError):
                load_service_settings(openai_env(**{PERF_OPT_VAR: value}))

    def test_explain_effort_defaults_to_interpret_effort(self) -> None:
        same = load_service_settings(openai_env(**{LLM_REASONING_VAR: "low"})).llm
        self.assertEqual((same.reasoning_effort, same.explain_reasoning_effort), ("low", "low"))
        own = load_service_settings(openai_env(**{LLM_REASONING_VAR: "low", LLM_EXPLAIN_REASONING_VAR: "minimal"})).llm
        self.assertEqual((own.reasoning_effort, own.explain_reasoning_effort), ("low", "minimal"))
        with self.assertRaises(ServiceConfigError):
            load_service_settings(openai_env(**{LLM_EXPLAIN_REASONING_VAR: "maximo"}))


class OpenAiOptimizationTests(GuardedTestCase):
    def test_reasoning_effort_per_task(self) -> None:
        api = FakeOpenAI()
        provider = OpenAiResponsesProvider(
            api_key=fake_key(), model="gpt-6-luna", price=PRICE, account_catalog=CATALOG, transport=api.transport(),
            reasoning_effort="low", explain_reasoning_effort="minimal",
        )
        self.addCleanup(provider.close)
        provider.complete(interpret_request())
        provider.complete(explain_request())
        self.assertEqual(api.requests[0]["reasoning"], {"effort": "low"})
        self.assertEqual(api.requests[1]["reasoning"], {"effort": "minimal"})

    def test_explain_effort_defaults_to_the_same_effort(self) -> None:
        api = FakeOpenAI()
        provider = OpenAiResponsesProvider(
            api_key=fake_key(), model="gpt-6-luna", price=PRICE, account_catalog=CATALOG, transport=api.transport(),
            reasoning_effort="low",
        )
        self.addCleanup(provider.close)
        provider.complete(explain_request())
        self.assertEqual(api.requests[0]["reasoning"], {"effort": "low"})

    def test_keepalive_is_configurable_and_default_is_unchanged(self) -> None:
        default = OpenAiResponsesProvider(api_key=fake_key(), model="m-1", price=PRICE, account_catalog=CATALOG)
        longer = OpenAiResponsesProvider(api_key=fake_key(), model="m-1", price=PRICE, account_catalog=CATALOG, keepalive_s=120)
        self.addCleanup(default.close)
        self.addCleanup(longer.close)
        self.assertEqual(default._client._transport._pool._keepalive_expiry, 5.0)  # valor de httpx
        self.assertEqual(longer._client._transport._pool._keepalive_expiry, 120)

    def test_connection_probe_reports_only_what_was_observed(self) -> None:
        with diagnostics.recording() as trace:
            fresh = _ConnectionProbe()
            for name in ("connection.connect_tcp.started", "connection.start_tls.complete", "http11.send_request_headers.started"):
                fresh(name, {})
            fresh.report("interpretar")
            reused = _ConnectionProbe()
            reused("http11.send_request_headers.started", {})
            reused.report("explicar")
            _ConnectionProbe().report("explicar")  # sin eventos de transporte: no se afirma nada
        codes = [code for code, _ in trace.events]
        self.assertEqual(codes, ["OPENAI_CONN_NEW", "OPENAI_CONN_REUSE"])

    def test_mock_transport_emits_no_connection_claim(self) -> None:
        api = FakeOpenAI()
        provider = OpenAiResponsesProvider(api_key=fake_key(), model="m-1", price=PRICE, account_catalog=CATALOG,
                                           transport=api.transport())
        self.addCleanup(provider.close)
        with diagnostics.recording() as trace:
            provider.complete(interpret_request())
        self.assertEqual(trace.events, [])


class SlowRetriever(KeywordRetriever):
    def __init__(self, fragments, delay: float) -> None:
        super().__init__(fragments)
        self.delay = delay
        self.threads: list[str] = []

    def retrieve(self, query: str, k: int):
        self.threads.append(threading.current_thread().name)
        time.sleep(self.delay)
        return super().retrieve(query, k)


class SlowProvider(MockLlmProvider):
    def __init__(self, *args, delay: float, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.delay = delay

    def complete(self, request):
        if request.entrada.tarea == "interpretar":
            time.sleep(self.delay)
        return super().complete(request)


class ParallelRetrievalTests(GuardedTestCase):
    def fragments(self):
        return [Fragment(**f) for f in GOLD["fragments"]]

    def run_case(self, parallel: bool):
        retriever = SlowRetriever(self.fragments(), delay=0.25)
        provider = SlowProvider(GOLD["account_keywords"], delay=0.25)
        h = build_harness(provider=provider, retriever=retriever, parallel_retrieval=parallel)
        started = time.perf_counter()
        outcome = h.orchestrator.handle(request(SALDO), diagnostics=True)
        return outcome, time.perf_counter() - started, retriever

    def test_same_answer_and_retrieval_off_the_critical_path(self) -> None:
        serial, serial_s, serial_retriever = self.run_case(False)
        parallel, parallel_s, parallel_retriever = self.run_case(True)
        self.assertEqual(serial.body.estado, "respondida")
        self.assertEqual(parallel.body.model_dump(exclude={"diagnostico"}), serial.body.model_dump(exclude={"diagnostico"}))
        self.assertEqual(serial.trace.fragmentos_rag, parallel.trace.fragmentos_rag)
        self.assertEqual(serial_retriever.threads[0], threading.current_thread().name)
        self.assertTrue(parallel_retriever.threads[0].startswith("rag-paralelo"))
        stage = next(s for s in parallel.trace.etapas if s.etapa == "recuperacion")
        self.assertEqual(stage.estado, "ok")
        self.assertGreaterEqual(stage.ms, 200)  # duración real de la recuperación, medida en su hilo
        events = dict(parallel.events)
        self.assertIn("RAG_PARALLEL", events)
        waited = int(events["RAG_PARALLEL"].split("espera=")[1].split(" ")[0])
        self.assertLess(waited, stage.ms)  # la petición esperó menos de lo que duró la recuperación
        self.assertLess(parallel_s, serial_s - 0.1)  # solapamiento real con la interpretación

    def test_retriever_failure_behaves_as_in_series(self) -> None:
        class Broken:
            def retrieve(self, query, k):
                raise RuntimeError("fallo simulado")

        for parallel in (False, True):
            with self.subTest(parallel=parallel):
                h = build_harness(retriever=Broken(), parallel_retrieval=parallel)
                outcome = h.orchestrator.handle(request(SALDO), diagnostics=True)
                self.assertEqual(outcome.status_code, 503)
                self.assertIn("COMPONENT_FAILURE", outcome.audit.codigos_rechazo)
                stage = next(s for s in outcome.trace.etapas if s.etapa == "recuperacion")
                self.assertEqual(stage.estado, "fallo")
                self.assertEqual(h.executor.calls, 0)

    def test_prefilter_block_never_starts_retrieval(self) -> None:
        retriever = SlowRetriever(self.fragments(), delay=0.0)
        h = build_harness(retriever=retriever, parallel_retrieval=True)
        outcome = h.orchestrator.handle(request("Mi contraseña es secreta123, ¿cuál es el saldo de caja?"))
        self.assertNotEqual(outcome.body.model_dump().get("estado"), "respondida")
        self.assertEqual(retriever.threads, [])


class ConnectionPoolTests(GuardedTestCase):
    def factory(self, *connections):
        made: list[FakeConnection] = []
        queue = list(connections)

        def connect():
            connection = queue.pop(0) if queue else FakeConnection()
            made.append(connection)
            return connection

        return connect, made

    def executor(self, connect, *, pool: bool = True) -> PostgresReadOnlyExecutor:
        from test_postgres_executor import VALIDATOR

        return PostgresReadOnlyExecutor(connect, VALIDATOR, accepted_origins=frozenset({"ct-b-provisional"}), pool=pool)

    def test_reuses_the_connection_and_repeats_the_read_only_session(self) -> None:
        connect, made = self.factory()
        executor = self.executor(connect)
        with diagnostics.recording() as trace:
            first = executor.execute_authorized(approved(), AUTH)
            second = executor.execute_authorized(approved(), AUTH)
        self.assertEqual(first, second)
        self.assertEqual(len(made), 1)  # una sola apertura para las dos consultas
        statements = made[0].statements
        self.assertEqual(statements.count("SET TRANSACTION READ ONLY"), 2)
        self.assertEqual(statements.count("SHOW transaction_read_only"), 2)
        self.assertEqual([code for code, _ in trace.events], ["POOL_NEW", "POOL_REUSE"])

    def test_without_pool_each_query_opens_a_connection(self) -> None:
        connect, made = self.factory()
        executor = self.executor(connect, pool=False)
        executor.execute_authorized(approved(), AUTH)
        executor.execute_authorized(approved(), AUTH)
        self.assertEqual(len(made), 2)

    def test_stale_reused_connection_is_replaced_once(self) -> None:
        stale = FakeConnection()
        connect, made = self.factory(stale)
        executor = self.executor(connect)
        executor.execute_authorized(approved(), AUTH)
        stale.error = DbError(None)  # la conexión inactiva se cortó (sin SQLSTATE)
        with diagnostics.recording() as trace:
            rows = executor.execute_authorized(approved(), AUTH)
        self.assertTrue(rows)
        self.assertEqual(len(made), 2)
        self.assertEqual([code for code, _ in trace.events], ["POOL_STALE_RETRY", "POOL_NEW"])

    def test_query_errors_are_not_retried(self) -> None:
        connection = FakeConnection(error=DbError("42703"))
        connect, made = self.factory(connection)
        executor = self.executor(connect)
        with self.assertRaises(ExecutionFailed) as ctx:
            executor.execute_authorized(approved(), AUTH)
        self.assertEqual(ctx.exception.code, "UNDEFINED_COLUMN")
        self.assertEqual(len(made), 1)

    def test_reused_connection_without_read_only_is_refused_before_the_query(self) -> None:
        connection = FakeConnection()
        connect, made = self.factory(connection)
        executor = self.executor(connect)
        executor.execute_authorized(approved(), AUTH)
        connection.read_only = "off"
        connection.statements.clear()
        with self.assertRaises(ExecutionRefused) as ctx:
            executor.execute_authorized(approved(), AUTH)
        self.assertEqual(ctx.exception.code, "READ_ONLY_NOT_ENFORCED")
        self.assertFalse(any(s.startswith("SELECT") for s in connection.statements))

    def test_idle_connections_expire(self) -> None:
        now = [0.0]
        made: list[FakeConnection] = []

        def connect():
            made.append(FakeConnection())
            return made[-1]

        pool = ConnectionPool(connect, max_idle_s=10, clock=lambda: now[0])
        lease = pool.acquire()
        pool.release(lease)
        now[0] = 5
        self.assertTrue(pool.acquire().reused)
        pool.release(lease)
        now[0] = 30
        self.assertFalse(pool.acquire().reused)
        self.assertEqual(len(made), 2)


class CacheTests(GuardedTestCase):
    def test_ttl_and_lru(self) -> None:
        now = [0.0]
        cache: TtlCache[str] = TtlCache("t", max_entries=2, ttl_s=10, clock=lambda: now[0])
        cache.put("a", "1")
        cache.put("b", "2")
        self.assertEqual(cache.get("a"), "1")
        cache.put("c", "3")  # expulsa la menos usada (b)
        self.assertIsNone(cache.get("b"))
        now[0] = 11
        self.assertIsNone(cache.get("a"))

    def test_generation_cache_hits_without_calling_the_model(self) -> None:
        from ai_service.sqlgen.wire import GenerateResponse

        class Inner:
            calls = 0

            def generate(self, content):
                Inner.calls += 1
                return GenerateResponse(request_id="a" * 32, adapter="xiyansql_v17_json_v10_balanced_full", text="SELECT 1;",
                                        finish_reason="stop", prompt_tokens=10, output_tokens=4, latency_ms=900)

        client = CachingGenerationClient(Inner(), TtlCache("g"), "adapter|256")
        with diagnostics.recording() as trace:
            first = client.generate("prompt A")
            second = client.generate("prompt A")
            client.generate("prompt B")
        self.assertEqual(Inner.calls, 2)
        self.assertEqual((first.latency_ms, second.latency_ms, second.text), (900, 0, "SELECT 1;"))
        self.assertEqual([c for c, _ in trace.events], ["CACHE_MISS", "CACHE_HIT", "CACHE_MISS"])

    def test_interpretation_and_explanation_cache_skip_calls_and_budget(self) -> None:
        caches = {"interpretacion": TtlCache("i"), "explicacion": TtlCache("e")}
        h = build_harness(caches=caches)
        first = h.orchestrator.handle(request(SALDO, trace="traza-cache-0001"), diagnostics=True)
        calls_after_first, usage_after_first = len(h.provider.calls), len(h.usage.records())
        second = h.orchestrator.handle(request(SALDO, trace="traza-cache-0002"), diagnostics=True)
        self.assertEqual(first.body.cifras, second.body.cifras)
        self.assertEqual(second.body.texto, first.body.texto)
        self.assertEqual(len(h.provider.calls), calls_after_first)  # ninguna llamada nueva al Modelo 1
        self.assertEqual(len(h.usage.records()), usage_after_first)  # ni consumo de presupuesto
        self.assertEqual(h.executor.calls, 2)  # el Executor se ejecuta siempre (datos frescos)
        marks = {s.etapa: s.codigo for s in second.body.diagnostico.etapas}
        self.assertEqual((marks["interpretacion"], marks["explicacion"]), ("CACHE_HIT", "CACHE_HIT"))

    def test_without_cache_nothing_changes(self) -> None:
        h = build_harness()
        h.orchestrator.handle(request(SALDO, trace="traza-nocache-01"))
        calls = len(h.provider.calls)
        h.orchestrator.handle(request(SALDO, trace="traza-nocache-02"))
        self.assertEqual(len(h.provider.calls), 2 * calls)


class BudgetConcurrencyTests(GuardedTestCase):
    def test_concurrent_reservations_are_consistent(self) -> None:
        guard = BudgetGuard(make_policy(monthly_limit="100.00"), SIM_PRICING, UsageLog(), lambda: NOW)
        errors: list[Exception] = []

        def worker(i: int) -> None:
            try:
                for j in range(50):
                    auth = guard.authorize(CallRequest(trace_id=f"t-{i}-{j}", task="interpretar", model=MockLlmProvider.model,
                                                       input_tokens=100))
                    guard.cancel(auth)
            except Exception as exc:  # pragma: no cover - solo si hay una condición de carrera
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(errors, [])
        self.assertEqual(guard.pending_reservations, Decimal("0"))


class ConsoleTests(GuardedTestCase):
    def test_perf_block_has_times_and_no_question_or_sql(self) -> None:
        h = build_harness(parallel_retrieval=True)
        outcome = h.orchestrator.handle(request(SALDO), diagnostics=True)
        out = io.StringIO()
        print_outcome(outcome, stream=out)
        text = out.getvalue()
        self.assertIn("[PERF] consulta traza-b3-0001", text)
        for stage in ("interpretacion", "recuperacion", "generacion_sql", "validacion_sql", "ejecucion_sql", "explicacion", "TOTAL"):
            self.assertIn(stage, text)
        self.assertIn("[OPT]  RAG_PARALLEL", text)
        self.assertNotIn("caja", text.lower())  # ni la pregunta...
        self.assertNotIn("select", text.lower())  # ...ni el SQL


class InferenceServerPerfTests(GuardedTestCase):
    """Servidor de inferencia: indicadores, líneas ``[MODEL]`` sin prompt y espera acotada (motor falso)."""

    def setUp(self) -> None:
        super().setUp()
        from test_inference_server import CONTENT, FakeEngine, server_env

        self.content, self.FakeEngine, self.server_env = CONTENT, FakeEngine, server_env

    def make(self, engine, **env):
        from contextlib import redirect_stderr

        from starlette.testclient import TestClient

        from inference_server.app import create_app
        from inference_server.config import load_server_settings

        settings = load_server_settings(self.server_env(**env))
        err = io.StringIO()
        with redirect_stderr(err):
            app = create_app(settings, engine, background_load=False)
            client = TestClient(app, base_url="http://127.0.0.1", raise_server_exceptions=False)
            client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return settings, app, client, err

    def post(self, client, settings):
        import json
        import secrets

        from ai_service.sqlgen.wire import TOKEN_HEADER

        body = {"contract": "xiyan-sqlgen/1", "request_id": secrets.token_hex(16), "profile": "xiyan-json-v1.0",
                "adapter": "xiyansql_v17_json_v10_balanced_full", "user_content": self.content, "max_new_tokens": 256}
        return client.post("/v1/generate", content=json.dumps(body).encode(),
                           headers={TOKEN_HEADER: settings.token, "Content-Type": "application/json"})

    def test_flags_are_off_by_default_and_validated(self) -> None:
        from inference_server.config import ServerConfigError, load_server_settings

        settings = load_server_settings(self.server_env())
        self.assertEqual((settings.prompt_lookup, settings.warmup, settings.queue_wait_s), (0, False, 0.0))
        on = load_server_settings(self.server_env(XIYAN_PROMPT_LOOKUP="10", XIYAN_WARMUP="1", XIYAN_QUEUE_WAIT_S="10"))
        self.assertEqual((on.prompt_lookup, on.warmup, on.queue_wait_s), (10, True, 10.0))
        for name, value in (("XIYAN_PROMPT_LOOKUP", "99"), ("XIYAN_WARMUP", "si"), ("XIYAN_QUEUE_WAIT_S", "-1")):
            with self.subTest(name=name), self.assertRaises(ServerConfigError):
                load_server_settings(self.server_env(**{name: value}))

    def test_model_lines_report_numbers_and_never_the_prompt(self) -> None:
        from contextlib import redirect_stderr

        engine = self.FakeEngine()
        engine.resources = lambda: {"allocated": 5200, "reserved": 5600, "free": 2400, "total": 8151}
        settings, _, client, load_err = self.make(engine)
        self.assertIn("[MODEL] cargado", load_err.getvalue())
        self.assertIn("VRAM asignada 5.08 GiB", load_err.getvalue())
        err = io.StringIO()
        with redirect_stderr(err):
            response = self.post(client, settings)
        self.assertEqual(response.status_code, 200)
        line = err.getvalue()
        self.assertRegex(line, r"\[MODEL\] generate id=[0-9a-f]{8} prompt=\d+ tok · salida=4 tok · \d+ ms")
        self.assertIn("tok/s", line)
        self.assertNotIn("Evidence", line)  # nada del prompt
        self.assertNotIn("SELECT", line)  # ni de la salida

    def test_warmup_runs_before_ready(self) -> None:
        engine = self.FakeEngine()
        calls: list[str] = []
        engine.warm_up = lambda: calls.append("warm") or engine.output
        _, app, _, err = self.make(engine, XIYAN_WARMUP="1")
        self.assertEqual((calls, app.state.model.status), (["warm"], "ready"))
        self.assertIn("[MODEL] WARMUP", err.getvalue())

    def test_queue_wait_lets_a_second_request_through(self) -> None:
        settings, app, client, _ = self.make(self.FakeEngine(), XIYAN_QUEUE_WAIT_S="5")
        lock = app.state.model.generation_lock
        lock.acquire()
        threading.Timer(0.3, lock.release).start()  # la generación en curso termina a los 0,3 s
        response = self.post(client, settings)
        self.assertEqual(response.status_code, 200)

    def test_without_queue_wait_busy_is_immediate(self) -> None:
        settings, app, client, _ = self.make(self.FakeEngine())
        app.state.model.generation_lock.acquire()
        try:
            self.assertEqual(self.post(client, settings).json(), {"error": "BUSY"})
        finally:
            app.state.model.generation_lock.release()


class BenchmarkToolTests(GuardedTestCase):
    """Herramienta de medición: misma aserción P-9 que el proxy, sin texto en los resultados, comparación honesta."""

    def test_signed_identity_is_accepted_by_the_service_verifier(self) -> None:
        import secrets

        from ai_service.auth.identity import verify_identity_assertion
        from ai_service.perf.benchmark import ROLE, sign_identity

        key = bytes.fromhex(secrets.token_hex(32))
        now = time.time()
        token = sign_identity(key, user_id=3, trace_id="bench-q1-abcdef123456", modules=["caja", "ventas"], now=now)
        identity = verify_identity_assertion(token, key=key, trace_id="bench-q1-abcdef123456", user_id=3, rol=ROLE, now=now)
        self.assertEqual(identity.modulos, frozenset({"caja", "ventas"}))

    def test_results_keep_times_and_codes_but_not_the_question(self) -> None:
        import json

        import httpx

        from ai_service.perf.benchmark import run_question

        diag = {"etapas": [{"etapa": "interpretacion", "estado": "ok", "codigo": None, "ms": 4100},
                           {"etapa": "generacion_sql", "estado": "ok", "codigo": "CACHE_HIT", "ms": 3},
                           {"etapa": "generacion_sql", "estado": "ok", "codigo": None, "ms": 2900}],
                "duracion_total_ms": 7400, "ruta": "ampliada", "reintento": "FILTER_NOOP", "sql_generado": "SELECT secreto",
                "modelo_sql": {"latencia_ms": 2900, "tokens_prompt": 600, "tokens_salida": 80, "fin": "stop"}}
        transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"estado": "respondida", "texto": "S/ 10",
                                                                             "diagnostico": diag}))
        with httpx.Client(base_url="http://127.0.0.1:8002", transport=transport) as client:
            result = run_question(client, "t" * 64, b"k" * 32, user_id=3, modules=["caja"], qid="Q9",
                                  message="pregunta confidencial", round_no=1)
        text = json.dumps(result, ensure_ascii=False)
        self.assertNotIn("confidencial", text)
        self.assertNotIn("SELECT", text)
        self.assertNotIn("S/ 10", text)
        self.assertEqual(result["etapas"], {"interpretacion": 4100, "generacion_sql": 2903})  # el reintento se suma
        self.assertIn("generacion_sql:CACHE_HIT", result["marcas"])

    def test_compare_without_baseline_reports_it_and_computes_nothing(self) -> None:
        import tempfile
        from contextlib import redirect_stdout
        from pathlib import Path
        from unittest import mock

        import ai_service.perf.benchmark as bench

        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(bench, "RESULTS_DIR", Path(tmp)):
            out = io.StringIO()
            with redirect_stdout(out):
                code = bench.compare("antes", "despues")
        self.assertEqual(code, 1)
        self.assertIn("No existe una medición «antes» comparable", out.getvalue())
        self.assertNotIn("%", out.getvalue())

    def test_compare_uses_medians_of_the_first_pass_only(self) -> None:
        import json
        import tempfile
        from contextlib import redirect_stdout
        from pathlib import Path
        from unittest import mock

        import ai_service.perf.benchmark as bench

        def run(label, totals, repeated=None):
            rows = [{"id": f"Q{i}", "pasada": 1, "http": 200, "total_servidor": t, "total_cliente": t + 5,
                     "etapas": {"interpretacion": t // 2}} for i, t in enumerate(totals, 1)]
            if repeated is not None:
                rows.append({"id": "Q1", "pasada": 2, "http": 200, "total_servidor": repeated, "etapas": {}})
            return {"label": label, "creado": "x", "resultados": rows}

        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(bench, "RESULTS_DIR", Path(tmp)):
            (Path(tmp) / "a.json").write_text(json.dumps(run("a", [1000, 2000, 3000])), encoding="utf-8")
            (Path(tmp) / "b.json").write_text(json.dumps(run("b", [500, 1000, 1500], repeated=10)), encoding="utf-8")
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(bench.compare("a", "b"), 0)
        total = next(line for line in out.getvalue().splitlines() if "TOTAL servidor" in line)
        self.assertIn("2000ms", total)
        self.assertIn("1000ms", total)
        self.assertIn("50.0%", total)  # (2000 - 1000) / 2000; la pasada repetida (10 ms) no entra
