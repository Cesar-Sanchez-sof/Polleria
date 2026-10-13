"""Pruebas del conjunto Gold ficticio y versionado (T031)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import get_args

from guards import GuardedTestCase

from ai_service.audit.masking import contains_sensitive
from ai_service.knowledge.corpus import build_corpus, load_json
from ai_service.llm.provider import Intent

ROOT = Path(__file__).resolve().parents[1]
GOLD = load_json(ROOT / "eval" / "gold" / "gold_v1.json")
METADATA = load_json(ROOT / "knowledge" / "erp_schema_metadata.json")
CORPUS = build_corpus(METADATA, load_json(ROOT / "knowledge" / "glossary_v1.json"), load_json(ROOT / "knowledge" / "rules_v1.json"))


class GoldIntegrityTests(GuardedTestCase):
    def test_items_hash_matches_recorded_version(self) -> None:
        canonical = json.dumps(GOLD["items"], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        self.assertEqual(
            hashlib.sha256(canonical.encode("utf-8")).hexdigest(), GOLD["items_sha256"],
            "Los ítems Gold cambiaron: crear una nueva versión (gold-v2) en lugar de editar gold-v1.",
        )

    def test_contamination_check_is_documented_as_pending(self) -> None:
        independence = GOLD["independence"]
        self.assertEqual(independence["training_contamination_check"], "PENDIENTE")
        self.assertIsNone(independence["training_dataset_sha256"])
        self.assertTrue(independence["reason"])


class GoldContentTests(GuardedTestCase):
    def test_items_are_well_formed(self) -> None:
        ids = [item["id"] for item in GOLD["items"]]
        self.assertEqual(len(ids), len(set(ids)))
        intents = set(get_args(Intent))
        for item in GOLD["items"]:
            with self.subTest(item=item["id"]):
                self.assertIn(item["perfil"], {"contador", "propietario"})
                self.assertIn(item["intencion_esperada"], intents)
                self.assertFalse(contains_sensitive(item["pregunta"]))  # sin datos personales ni importes
        self.assertEqual({item["perfil"] for item in GOLD["items"]}, {"contador", "propietario"})

    def test_references_exist_in_corpus_and_metadata(self) -> None:
        fragment_ids = {fragment.fuente for fragment in CORPUS}
        tables = {model["table"] for model in METADATA["models"]}
        relations = {
            f"{model['table']}.{','.join(r['columns'])}->{r['target_table']}.{','.join(r['target_columns'])}"
            for model in METADATA["models"]
            for r in model["relations"]
        }
        for item in GOLD["items"]:
            with self.subTest(item=item["id"]):
                self.assertTrue(set(item["fragmentos_relevantes"]) <= fragment_ids)
                self.assertTrue(set(item["tablas_esperadas"]) <= tables)
                self.assertTrue(set(item["relaciones_esperadas"]) <= relations)

    def test_enough_items_for_retrieval_evaluation(self) -> None:
        evaluable = [item for item in GOLD["items"] if item["fragmentos_relevantes"]]
        self.assertGreaterEqual(len(evaluable), 14)
        self.assertTrue(any(not item["fragmentos_relevantes"] for item in GOLD["items"]))
