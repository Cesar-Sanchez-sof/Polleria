"""Evaluación real de recuperación sobre el conjunto Gold: léxico frente a semántico (E5 local, CPU).

Uso, desde ``ai-service/``::

    set PYTHONPATH=src && .venv\\Scripts\\python.exe -m ai_service.retrieval.evaluate_gold

Calcula Recall@1/3/5 y MRR con ``retrieval.metrics`` sobre el corpus del Gold (diccionario,
relaciones y reglas) y sobre el corpus ampliado (más métricas y ejemplos SQL). Todo es local: los
textos no salen del equipo. Solo usa el modelo ya descargado en la caché.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from ai_service.knowledge.corpus import build_corpus, load_json
from ai_service.retrieval.e5_embedder import E5OnnxEmbedder
from ai_service.retrieval.embedder import Embedder, HashingEmbedder
from ai_service.retrieval.hybrid import HybridRetriever
from ai_service.retrieval.memory_index import VectorRetriever
from ai_service.retrieval.metrics import evaluate

SERVICE_ROOT = Path(__file__).resolve().parents[3]


def _corpora() -> dict[str, list]:
    knowledge = SERVICE_ROOT / "knowledge"
    base = [load_json(knowledge / "erp_schema_metadata.json"), load_json(knowledge / "glossary_v1.json"), load_json(knowledge / "rules_v1.json")]
    return {
        "gold": build_corpus(*base),
        "ampliado": build_corpus(*base, load_json(knowledge / "metrics_v1.json"), load_json(knowledge / "sql_examples_v1.json")),
    }


def report(embedders: dict[str, Embedder]) -> list[dict]:
    """``embedders`` debe incluir ``lexico``; con un semántico se evalúa también el híbrido RRF."""
    items = json.loads((SERVICE_ROOT / "eval" / "gold" / "gold_v1.json").read_text(encoding="utf-8"))["items"]
    rows = []
    for corpus_name, corpus in _corpora().items():
        built = {name: VectorRetriever.from_fragments(corpus, embedder) for name, embedder in embedders.items()}
        semantic = [name for name in built if name != "lexico"]
        if semantic:
            built["hibrido-rrf"] = HybridRetriever(built["lexico"], built[semantic[0]])
        for name, retriever in built.items():
            row = {"corpus": corpus_name, "fragmentos": len(corpus), "recuperador": name}
            for k in (1, 3, 5):
                started = time.perf_counter()
                result = evaluate(items, lambda q, kk: [h.id for h in retriever.search(q, kk)], k)
                row[f"recall@{k}"] = round(result.recall_at_k, 3)
                row[f"mrr@{k}"] = round(result.mrr, 3)
                row["preguntas"] = result.evaluated
                row[f"consulta_ms@{k}"] = round((time.perf_counter() - started) * 1000 / result.evaluated, 1)
            rows.append(row)
    return rows


def main() -> int:
    for row in report({"lexico": HashingEmbedder(), "semantico-e5": E5OnnxEmbedder()}):
        print(json.dumps(row, ensure_ascii=False))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
