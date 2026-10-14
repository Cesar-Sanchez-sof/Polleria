"""Preparación del índice remoto de Milvus / Zilliz Cloud (manual; no se ejecuta en pruebas).

Uso, desde ``ai-service/`` (``set PYTHONPATH=src``):

- ``python -m ai_service.retrieval.milvus_sync``: **sin red**. Muestra la huella del corpus y su
  contenido resumido (tipo y fuente de cada fragmento) para que se apruebe lo que se enviaría.
- ``python -m ai_service.retrieval.milvus_sync --sync``: crea la colección (si falta) e indexa los
  vectores. Exige ``AI_RAG_MODE=milvus``, ``ZILLIZ_CLOUD_URI``/``ZILLIZ_CLOUD_TOKEN`` (entorno o
  ``ai-service/.env``) y ``AI_RAG_REMOTE_CORPUS_SHA256`` igual a la huella mostrada.

Solo se envía el corpus sintético o aprobado (diccionario, relaciones, reglas, métricas y ejemplos SQL
con parámetros) y sus vectores. Nunca datos del ERP. No imprime credenciales.
"""

from __future__ import annotations

import collections
import os
import sys
from pathlib import Path

from ai_service.config.settings import ServiceConfigError, _load_rag_settings, read_dotenv_keys
from ai_service.knowledge.corpus import build_corpus, corpus_fingerprint, load_json

SERVICE_ROOT = Path(__file__).resolve().parents[3]


def corpus() -> list:
    knowledge = SERVICE_ROOT / "knowledge"
    return build_corpus(
        load_json(knowledge / "erp_schema_metadata.json"),
        load_json(knowledge / "glossary_v1.json"),
        load_json(knowledge / "rules_v1.json"),
        load_json(knowledge / "metrics_v1.json"),
        load_json(knowledge / "sql_examples_v1.json"),
    )


def main(argv: list[str]) -> int:
    fragments = corpus()
    fingerprint = corpus_fingerprint(fragments)
    print(f"Corpus: {len(fragments)} fragmentos | por tipo: {dict(collections.Counter(f.tipo for f in fragments))}")
    print(f"Huella (AI_RAG_REMOTE_CORPUS_SHA256): {fingerprint}")
    if "--sync" not in argv:
        for fragment in fragments:
            print(f"  - {fragment.tipo:8} {fragment.fuente}")
        print("Modo revisión: no se conectó a ningún servicio.")
        return 0

    try:
        rag = _load_rag_settings(os.environ, read_dotenv_keys(SERVICE_ROOT / ".env"))
    except ServiceConfigError as exc:
        print(f"Configuración incompleta: {exc}")
        return 2
    if rag.mode != "milvus" or rag.approved_corpus_sha256 != fingerprint:
        print("Sincronización cancelada: AI_RAG_MODE no es 'milvus' o la huella aprobada no coincide.")
        return 2

    from ai_service.retrieval.e5_embedder import E5OnnxEmbedder
    from ai_service.retrieval.milvus_index import MilvusUnavailable, MilvusVectorIndex, milvus_client_factory

    embedder = E5OnnxEmbedder()
    index = MilvusVectorIndex(milvus_client_factory(rag.milvus_uri or "", rag.milvus_token or ""), fragments,
                              collection=rag.collection, dimension=embedder.dimension)
    try:
        index.ensure_collection()
        vectors = embedder.embed([f.contenido for f in fragments])
        index.upsert((f.fuente, v, f) for f, v in zip(fragments, vectors))
    except MilvusUnavailable as exc:
        print(f"Milvus no disponible: {exc}")
        return 1
    print(f"Indexados {len(fragments)} fragmentos en la colección {rag.collection}.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv[1:]))
