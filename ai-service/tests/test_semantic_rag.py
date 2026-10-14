"""RAG semántico (T033): embedder E5 (ONNX), Milvus/Zilliz, híbrido RRF y *fallback* léxico.

Sin modelos ni red: un *embedder* falso determinista y un cliente de Milvus simulado. El modelo real
solo se usa en ``ai_service.retrieval.evaluate_gold`` (evaluación manual en CPU).
"""

from __future__ import annotations

import hashlib
import importlib
import json
import secrets
import sys
from importlib.abc import MetaPathFinder
from pathlib import Path

from guards import GuardedTestCase
from sqlgen_support import NOW, FakeInferenceServer, payload, question_of, xiyan_env

from ai_service.audit.masking import HMAC_KEY_ENV_VAR
from ai_service.assembly import build_dev_orchestrator
from ai_service.config.settings import (
    ENV_VAR,
    RAG_APPROVED_CORPUS_VAR,
    RAG_MODE_VAR,
    SQLGEN_TOKEN_VAR,
    TOKEN_VAR,
    ZILLIZ_TOKEN_VAR,
    ZILLIZ_URI_VAR,
    RagSettings,
    ServiceConfigError,
    load_service_settings,
)
from ai_service.knowledge.corpus import build_corpus, corpus_fingerprint, load_json
from ai_service.orchestrator.ports import Fragment
from ai_service.retrieval.embedder import HashingEmbedder
from ai_service.retrieval.factory import CorpusNotApproved, build_retriever
from ai_service.retrieval.fallback import FallbackRetriever
from ai_service.retrieval.hybrid import HybridRetriever
from ai_service.retrieval.memory_index import VectorRetriever
from ai_service.retrieval.milvus_index import MilvusUnavailable, MilvusVectorIndex

ROOT = Path(__file__).resolve().parents[1]
K = ROOT / "knowledge"
CORPUS = build_corpus(
    load_json(K / "erp_schema_metadata.json"), load_json(K / "glossary_v1.json"), load_json(K / "rules_v1.json"),
    load_json(K / "metrics_v1.json"), load_json(K / "sql_examples_v1.json"),
)
TOKEN = "zilliz-ficticio-" + "x" * 20


class FakeE5:
    """Embedder determinista con prefijos de E5 (registra qué método se usó)."""

    dimension = 384

    def __init__(self) -> None:
        self.calls: list[str] = []
        self._lexical = HashingEmbedder(384)

    def embed(self, texts):
        self.calls.append("passage")
        return self._lexical.embed(texts)

    def embed_queries(self, texts):
        self.calls.append("query")
        return self._lexical.embed(texts)


class FakeMilvus:
    def __init__(self, *, fail: bool = False, hits=None) -> None:
        self.fail, self.hits = fail, hits
        self.rows: list[dict] = []
        self.created = False
        self.searches = 0

    def has_collection(self, name):
        return self.created

    def upsert(self, collection_name, data):
        self.rows.extend(data)

    def search(self, collection_name, data, limit, output_fields, search_params):
        self.searches += 1
        if self.fail:
            raise ConnectionError(f"fallo con token {TOKEN}")
        return [self.hits if self.hits is not None else [{"id": r["id"], "distance": 0.9 - i / 100} for i, r in enumerate(self.rows[:limit])]]


class CorpusTests(GuardedTestCase):
    def test_corpus_includes_only_synthetic_approved_sources(self) -> None:
        kinds = {f.tipo for f in CORPUS}
        self.assertEqual(kinds, {"esquema", "relacion", "regla", "metrica", "ejemplo"})
        ids = {f.fuente for f in CORPUS}
        self.assertIn("metric:saldo-neto-periodo", ids)
        self.assertIn("example:saldo-cuenta-periodo", ids)
        for fragment in CORPUS:
            if fragment.tipo == "ejemplo":  # SQL con parámetros, sin códigos ni fechas
                self.assertIn(":codigo", fragment.contenido)
                self.assertNotRegex(fragment.contenido, r"'\d|\d{4}-\d{2}")

    def test_fingerprint_detects_any_change(self) -> None:
        original = corpus_fingerprint(CORPUS)
        self.assertRegex(original, r"^[0-9a-f]{64}$")
        self.assertEqual(original, corpus_fingerprint(list(reversed(CORPUS))))  # independiente del orden
        altered = [*CORPUS[:-1], Fragment(CORPUS[-1].tipo, CORPUS[-1].fuente, CORPUS[-1].version, CORPUS[-1].contenido + " ")]
        self.assertNotEqual(original, corpus_fingerprint(altered))


class RetrieverTests(GuardedTestCase):
    def test_queries_use_the_query_prefix_and_passages_the_passage_prefix(self) -> None:
        embedder = FakeE5()
        retriever = VectorRetriever.from_fragments(CORPUS, embedder)
        retriever.retrieve("saldo de caja", 5)
        self.assertEqual(embedder.calls, ["passage", "query"])

    def test_hybrid_fuses_both_rankings(self) -> None:
        lexical = VectorRetriever.from_fragments(CORPUS, HashingEmbedder())
        hybrid = HybridRetriever(lexical, VectorRetriever.from_fragments(CORPUS, FakeE5()))
        results = hybrid.retrieve("¿Cuál fue el saldo de la cuenta caja en septiembre?", 5)
        self.assertEqual(len(results), 5)
        self.assertTrue(all(f in CORPUS for f in results))

    def test_fallback_to_lexical_when_semantic_fails_or_is_empty(self) -> None:
        lexical = VectorRetriever.from_fragments(CORPUS, HashingEmbedder())

        class Broken:
            def retrieve(self, q, k):
                raise RuntimeError("modelo no disponible")

        class Empty:
            def retrieve(self, q, k):
                return []

        for primary in (Broken(), Empty()):
            fallback = FallbackRetriever(primary, lexical)
            self.assertEqual(fallback.retrieve("saldo de caja", 5), lexical.retrieve("saldo de caja", 5))
            self.assertEqual(fallback.last_source, "lexico")
        semantic = FallbackRetriever(lexical, VectorRetriever.from_fragments(CORPUS[:1], HashingEmbedder()))
        semantic.retrieve("saldo de caja", 5)
        self.assertEqual(semantic.last_source, "semantico")


class FactoryTests(GuardedTestCase):
    def test_default_is_lexical(self) -> None:
        retriever, version = build_retriever(RagSettings(), CORPUS)
        self.assertEqual(version, "lexico-hashing")
        self.assertIsInstance(retriever, VectorRetriever)

    def test_semantic_mode_is_lazy_hybrid_with_fallback(self) -> None:
        embedder = FakeE5()
        retriever, version = build_retriever(RagSettings(mode="semantico"), CORPUS, embedder=embedder)
        self.assertEqual(version, "hibrido-rrf-e5-small+lexico")
        self.assertEqual(embedder.calls, [])  # no indexa al construir
        retriever.retrieve("saldo de caja", 5)
        self.assertEqual(embedder.calls, ["passage", "query"])
        self.assertEqual(retriever.last_source, "semantico")

    def test_semantic_mode_falls_back_when_model_is_missing(self) -> None:
        class Missing(FakeE5):
            def embed(self, texts):
                raise RuntimeError("modelo no descargado")

        retriever, _ = build_retriever(RagSettings(mode="semantico"), CORPUS, embedder=Missing())
        self.assertEqual(len(retriever.retrieve("saldo de caja", 5)), 5)
        self.assertEqual((retriever.last_source, retriever.failures), ("lexico", 1))

    def test_milvus_requires_the_approved_corpus(self) -> None:
        rag = RagSettings(mode="milvus", milvus_uri="https://x.invalid", milvus_token=TOKEN, approved_corpus_sha256="0" * 64)
        with self.assertRaises(CorpusNotApproved):
            build_retriever(rag, CORPUS, embedder=FakeE5(), milvus_client_factory=FakeMilvus)

    def test_milvus_search_returns_only_local_approved_fragments(self) -> None:
        approved = corpus_fingerprint(CORPUS)
        client = FakeMilvus(hits=[
            {"id": "metric:saldo-neto-periodo", "distance": 0.95, "entity": {"contenido": "TEXTO REMOTO MANIPULADO"}},
            {"id": "tabla:usuarios-inventada", "distance": 0.94},  # desconocido: se descarta
            {"id": "rule:partida-doble", "distance": "no-numero"},
        ])
        rag = RagSettings(mode="milvus", milvus_uri="https://x.invalid", milvus_token=TOKEN, approved_corpus_sha256=approved)
        retriever, version = build_retriever(rag, CORPUS, embedder=FakeE5(), milvus_client_factory=lambda: client)
        self.assertEqual(version, "hibrido-rrf-milvus-e5-small+lexico")
        results = retriever.retrieve("saldo neto", 5)
        self.assertEqual(client.searches, 1)
        self.assertTrue(all(f in CORPUS for f in results))
        self.assertNotIn("TEXTO REMOTO MANIPULADO", json.dumps([f.contenido for f in results], ensure_ascii=False))

    def test_milvus_failure_falls_back_without_leaking(self) -> None:
        approved = corpus_fingerprint(CORPUS)
        client = FakeMilvus(fail=True)
        rag = RagSettings(mode="milvus", milvus_uri="https://x.invalid", milvus_token=TOKEN, approved_corpus_sha256=approved)
        retriever, _ = build_retriever(rag, CORPUS, embedder=FakeE5(), milvus_client_factory=lambda: client)
        self.assertEqual(len(retriever.retrieve("saldo de caja", 5)), 5)
        self.assertEqual(retriever.last_source, "lexico")
        index = MilvusVectorIndex(lambda: client, CORPUS)
        with self.assertRaises(MilvusUnavailable) as ctx:
            index.search((0.0,) * 384, 3)
        self.assertNotIn(TOKEN, str(ctx.exception))
        self.assertIsNone(ctx.exception.__cause__)


class MilvusIndexTests(GuardedTestCase):
    def test_upsert_only_approved_fragments(self) -> None:
        client = FakeMilvus()
        client.created = True
        index = MilvusVectorIndex(lambda: client, CORPUS)
        index.ensure_collection()  # ya existe: no se recrea
        embedder = FakeE5()
        vectors = embedder.embed([f.contenido for f in CORPUS])
        index.upsert((f.fuente, v, f) for f, v in zip(CORPUS, vectors))
        self.assertEqual({r["id"] for r in client.rows}, {f.fuente for f in CORPUS})
        self.assertEqual(set(client.rows[0]), {"id", "vector", "tipo", "fuente", "version", "contenido"})
        foreign = Fragment("regla", "rule:datos-reales", "x", "Saldo real de la empresa S/ 10,000")
        with self.assertRaises(ValueError):
            index.upsert([("rule:datos-reales", vectors[0], foreign)])
        altered = Fragment(CORPUS[0].tipo, CORPUS[0].fuente, CORPUS[0].version, "contenido alterado")
        with self.assertRaises(ValueError):
            index.upsert([(CORPUS[0].fuente, vectors[0], altered)])


class SettingsTests(GuardedTestCase):
    def base(self, **extra):
        return {ENV_VAR: "development", TOKEN_VAR: secrets.token_hex(32), HMAC_KEY_ENV_VAR: secrets.token_hex(32), **extra}

    def test_modes_and_remote_disabled_by_default(self) -> None:
        self.assertEqual(load_service_settings(self.base()).rag.mode, "lexico")
        self.assertEqual(load_service_settings(self.base(**{RAG_MODE_VAR: "semantico"})).rag.mode, "semantico")
        with self.assertRaises(ServiceConfigError):
            load_service_settings(self.base(**{RAG_MODE_VAR: "remoto"}))

    def test_milvus_requires_credentials_and_corpus_approval(self) -> None:
        approved = "a" * 64
        ok = {RAG_MODE_VAR: "milvus", ZILLIZ_URI_VAR: "https://in01-ficticio.zillizcloud.invalid", ZILLIZ_TOKEN_VAR: TOKEN, RAG_APPROVED_CORPUS_VAR: approved}
        settings = load_service_settings(self.base(**ok))
        self.assertEqual((settings.rag.mode, settings.rag.approved_corpus_sha256), ("milvus", approved))
        self.assertNotIn(TOKEN, repr(settings))
        self.assertNotIn("zillizcloud", repr(settings))
        for missing in (ZILLIZ_URI_VAR, ZILLIZ_TOKEN_VAR, RAG_APPROVED_CORPUS_VAR):
            with self.subTest(falta=missing), self.assertRaises(ServiceConfigError) as ctx:
                load_service_settings(self.base(**{k: v for k, v in ok.items() if k != missing}))
            self.assertNotIn(TOKEN, str(ctx.exception))
        with self.assertRaises(ServiceConfigError):
            load_service_settings(self.base(**{**ok, ZILLIZ_URI_VAR: "http://sin-tls.invalid"}))


class PipelineIntegrationTests(GuardedTestCase):
    """Recuperación top-5 integrada antes de XiYanSQL; el RAG no amplía el esquema ni los permisos."""

    def test_retrieved_relations_reach_model_2_but_schema_and_permissions_do_not_change(self) -> None:
        env = {**xiyan_env(), RAG_MODE_VAR: "semantico"}
        settings = load_service_settings(env)
        server = FakeInferenceServer(env[SQLGEN_TOKEN_VAR])
        embedder = FakeE5()
        orchestrator, _audit = build_dev_orchestrator(
            settings, clock=lambda: NOW, sqlgen_transport=server.transport(), rag_embedder=embedder
        )
        self.assertEqual(orchestrator._k, 5)
        outcome = orchestrator.handle(payload("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual(outcome.body.estado, "respondida")
        self.assertEqual(outcome.body.versiones["rag"], "hibrido-rrf-e5-small+lexico")
        content = server.requests[0]["user_content"]
        evidence = content.split("〖参考信息〗\n", 1)[1].split("\n\n〖用户问题〗", 1)[0]
        # Solo relaciones entre las tablas del M-Schema; nunca reglas, métricas, ejemplos ni otras tablas.
        for forbidden in ("accounting_period", "naturaleza", "Pregunta:", "SQL:", "app_user", "status"):
            self.assertNotIn(forbidden, evidence)
        schema = content.split("〖数据库schema〗\n", 1)[1].split("\n\n〖参考信息〗", 1)[0]
        self.assertEqual(schema.count("# Table:"), 3)  # M-Schema canónico intacto
        self.assertEqual(question_of(content)["filters"][0]["value"], "101")


class ImportTests(GuardedTestCase):
    def test_importing_does_not_load_onnxruntime_or_pymilvus(self) -> None:
        class Blocker(MetaPathFinder):
            attempts: list = []

            def find_spec(self, fullname, path=None, target=None):
                if fullname.split(".")[0] in ("onnxruntime", "pymilvus", "torch"):
                    self.attempts.append(fullname)
                    raise ImportError("bloqueado en pruebas")
                return None

        blocker = Blocker()
        names = ("ai_service.retrieval.e5_embedder", "ai_service.retrieval.milvus_index", "ai_service.retrieval.factory")
        saved = {n: sys.modules.pop(n, None) for n in names}
        sys.meta_path.insert(0, blocker)
        try:
            for name in names:
                importlib.import_module(name)
        finally:
            sys.meta_path.remove(blocker)
            for name, module in saved.items():
                if module is not None:
                    sys.modules[name] = module
        self.assertEqual(blocker.attempts, [])
        _ = hashlib  # sha256 del corpus: biblioteca estándar
