"""Pruebas del recuperador en memoria y de las métricas (T032).

El *embedder* es léxico y determinista: estas pruebas verifican la **mecánica** de recuperación,
no la calidad semántica de embeddings reales (T033, pendiente).
"""

from __future__ import annotations

import math
from pathlib import Path

from guards import GuardedTestCase

from ai_service.knowledge.corpus import build_corpus, load_json
from ai_service.orchestrator.ports import Fragment, Retriever
from ai_service.retrieval.embedder import HashingEmbedder, normalize_tokens
from ai_service.retrieval.memory_index import InMemoryVectorIndex, VectorRetriever, cosine
from ai_service.retrieval.metrics import evaluate, recall_at_k, reciprocal_rank
from pipeline_support import build_harness, request

ROOT = Path(__file__).resolve().parents[1]
GOLD = load_json(ROOT / "eval" / "gold" / "gold_v1.json")
CORPUS = build_corpus(
    load_json(ROOT / "knowledge" / "erp_schema_metadata.json"),
    load_json(ROOT / "knowledge" / "glossary_v1.json"),
    load_json(ROOT / "knowledge" / "rules_v1.json"),
)


def frag(fuente: str, contenido: str) -> Fragment:
    return Fragment(tipo="regla", fuente=fuente, version="t", contenido=contenido)


class EmbedderTests(GuardedTestCase):
    def test_normalization(self) -> None:
        self.assertEqual(normalize_tokens("¿Cuál es el SALDO de las cuentas?"), ["saldo", "cuenta"])
        self.assertEqual(normalize_tokens("journal_entry_detail"), ["journal", "entry", "detail"])
        self.assertEqual(normalize_tokens("período"), ["periodo"])

    def test_vectors_are_deterministic_and_normalized(self) -> None:
        embedder = HashingEmbedder(64)
        a1, a2 = embedder.embed(["saldo de caja"])[0], HashingEmbedder(64).embed(["saldo de caja"])[0]
        self.assertEqual(a1, a2)
        self.assertEqual(len(a1), 64)
        self.assertAlmostEqual(math.sqrt(sum(v * v for v in a1)), 1.0)
        self.assertEqual(embedder.embed(["de la el"])[0], tuple([0.0] * 64))  # solo palabras vacías

    def test_collisions_never_cancel_out(self) -> None:
        # Regresión: con hashing firmado, "saldo de caja" daba un vector nulo en dimensión 64.
        for dimension in (8, 16, 32, 64):
            with self.subTest(dimension=dimension):
                vector = HashingEmbedder(dimension).embed(["saldo de caja"])[0]
                self.assertAlmostEqual(math.sqrt(sum(v * v for v in vector)), 1.0)
                self.assertTrue(all(v >= 0 for v in vector))

    def test_invalid_dimension(self) -> None:
        with self.assertRaises(ValueError):
            HashingEmbedder(4)


class IndexTests(GuardedTestCase):
    def test_cosine(self) -> None:
        self.assertAlmostEqual(cosine((1.0, 0.0), (1.0, 0.0)), 1.0)
        self.assertAlmostEqual(cosine((1.0, 0.0), (0.0, 1.0)), 0.0)
        self.assertEqual(cosine((0.0, 0.0), (1.0, 0.0)), 0.0)
        with self.assertRaises(ValueError):
            cosine((1.0,), (1.0, 0.0))

    def test_search_order_ties_and_upsert(self) -> None:
        index = InMemoryVectorIndex(2)
        index.upsert([
            ("a", (1.0, 0.0), frag("a", "a")),
            ("b", (0.0, 1.0), frag("b", "b")),
            ("c", (1.0, 0.0), frag("c", "c")),
        ])
        self.assertEqual([h.id for h in index.search((1.0, 0.0), 3)], ["a", "c", "b"])  # empate por inserción
        index.upsert([("a", (0.0, 1.0), frag("a", "a2"))])  # actualiza sin duplicar
        self.assertEqual(len(index), 3)
        self.assertEqual(index.search((1.0, 0.0), 1)[0].id, "c")
        self.assertEqual(index.search((1.0, 0.0), 0), [])
        with self.assertRaises(ValueError):
            index.upsert([("d", (1.0,), frag("d", "d"))])

    def test_retriever_contract(self) -> None:
        retriever: Retriever = VectorRetriever.from_fragments(CORPUS, HashingEmbedder())  # tipado estructural
        results = retriever.retrieve("saldo de la cuenta caja", 3)
        self.assertLessEqual(len(results), 3)
        self.assertTrue(all(isinstance(f, Fragment) for f in results))
        self.assertEqual(retriever.retrieve("xyzzy plugh", 3), [])  # sin coincidencias
        with self.assertRaises(ValueError):
            VectorRetriever(HashingEmbedder(64), InMemoryVectorIndex(32))

    def test_retriever_plugs_into_the_simulated_pipeline(self) -> None:
        h = build_harness(retriever=VectorRetriever.from_fragments(CORPUS, HashingEmbedder()))
        outcome = h.orchestrator.handle(request("¿Cuál fue el saldo de caja en septiembre?"))
        self.assertEqual(outcome.status_code, 200)
        self.assertEqual(outcome.body.estado, "respondida")


class MetricsTests(GuardedTestCase):
    def test_recall_and_reciprocal_rank(self) -> None:
        self.assertEqual(recall_at_k(["a", "b"], ["x", "a", "b"], 2), 0.5)
        self.assertEqual(recall_at_k(["a", "b"], ["x", "a", "b"], 3), 1.0)
        self.assertEqual(reciprocal_rank(["a"], ["x", "y", "a"], 3), 1 / 3)
        self.assertEqual(reciprocal_rank(["a"], ["x", "y", "a"], 2), 0.0)
        with self.assertRaises(ValueError):
            recall_at_k([], ["a"], 1)

    def test_oracle_and_empty_retrievers_bound_the_metrics(self) -> None:
        relevant = {item["pregunta"]: item["fragmentos_relevantes"] for item in GOLD["items"]}
        oracle = evaluate(GOLD["items"], lambda q, k: relevant[q][:k], 5)
        self.assertEqual((oracle.recall_at_k, oracle.mrr), (1.0, 1.0))
        empty = evaluate(GOLD["items"], lambda q, k: [], 5)
        self.assertEqual((empty.recall_at_k, empty.mrr), (0.0, 0.0))
        self.assertEqual(oracle.evaluated, len([i for i in GOLD["items"] if i["fragmentos_relevantes"]]))
        with self.assertRaises(ValueError):
            evaluate([{"id": "x", "pregunta": "q", "fragmentos_relevantes": []}], lambda q, k: [], 3)


class GoldEvaluationTests(GuardedTestCase):
    def test_lexical_baseline_is_deterministic_and_bounded(self) -> None:
        def run(k: int):
            retriever = VectorRetriever.from_fragments(CORPUS, HashingEmbedder())
            return evaluate(GOLD["items"], lambda q, kk: [h.id for h in retriever.search(q, kk)], k)

        for k in (1, 3, 5):
            with self.subTest(k=k):
                first, second = run(k), run(k)
                self.assertEqual(first, second)
                self.assertTrue(0.0 <= first.recall_at_k <= 1.0)
                self.assertTrue(0.0 <= first.mrr <= 1.0)
