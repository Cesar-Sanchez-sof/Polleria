"""Construcción del recuperador según ``AI_RAG_MODE`` (sin cargar modelos al importar).

- ``lexico`` (por defecto): ``HashingEmbedder`` en memoria, sin dependencias ni red.
- ``semantico``: híbrido RRF de léxico + ``multilingual-e5-small`` (ONNX, CPU) en memoria, con
  *fallback* léxico si el modelo no está disponible.
- ``milvus``: mismo híbrido, con la parte semántica buscada en Zilliz Cloud. Solo
  arranca si la huella del corpus actual coincide con la aprobada (``AI_RAG_REMOTE_CORPUS_SHA256``);
  la indexación remota es un paso manual aparte (``ai_service.retrieval.milvus_sync``).

En todos los modos el recuperador solo devuelve fragmentos del corpus local aprobado: el RAG
informa, pero nunca amplía tablas ni permisos (el M-Schema y el SQL Validator siguen mandando).
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from ai_service.config.settings import RagSettings
from ai_service.knowledge.corpus import corpus_fingerprint
from ai_service.orchestrator.ports import Fragment, Retriever
from ai_service.retrieval.embedder import Embedder, HashingEmbedder
from ai_service.retrieval.fallback import FallbackRetriever
from ai_service.retrieval.hybrid import HybridRetriever
from ai_service.retrieval.memory_index import SearchHit, VectorRetriever

TOP_K = 5


class CorpusNotApproved(ValueError):
    """El corpus actual no coincide con la huella aprobada para el índice remoto."""


def build_retriever(
    rag: RagSettings,
    corpus: Sequence[Fragment],
    *,
    embedder: Embedder | None = None,
    milvus_client_factory: Callable[[], Any] | None = None,
) -> tuple[Retriever, str]:
    """Devuelve ``(recuperador, versión)``; ``embedder`` y el cliente de Milvus solo se inyectan en pruebas."""
    lexical = VectorRetriever.from_fragments(corpus, HashingEmbedder())
    if rag.mode == "lexico":
        return lexical, "lexico-hashing"

    if embedder is None:
        from ai_service.retrieval.e5_embedder import E5OnnxEmbedder

        embedder = E5OnnxEmbedder()  # carga diferida: el modelo se lee en la primera consulta
    if rag.mode == "semantico":
        semantic = _LazySemantic(lambda: VectorRetriever.from_fragments(corpus, embedder))
        return FallbackRetriever(HybridRetriever(lexical, semantic), lexical), "hibrido-rrf-e5-small+lexico"

    fingerprint = corpus_fingerprint(list(corpus))
    if fingerprint != rag.approved_corpus_sha256:
        raise CorpusNotApproved("La huella del corpus no coincide con la aprobada para Milvus.")
    from ai_service.retrieval.milvus_index import MilvusVectorIndex, milvus_client_factory as default_factory

    factory = milvus_client_factory or default_factory(rag.milvus_uri or "", rag.milvus_token or "")
    index = MilvusVectorIndex(factory, corpus, collection=rag.collection, dimension=embedder.dimension)
    semantic_remote = VectorRetriever(embedder, index)
    return FallbackRetriever(HybridRetriever(lexical, semantic_remote), lexical), "hibrido-rrf-milvus-e5-small+lexico"


def build_local_retriever(
    fragments: Sequence[Fragment], mode: str, *, embedder: Embedder | None = None
) -> tuple[Retriever, str]:
    """RAG **local** (en memoria) para otro corpus, p. ej. los módulos del ERP de la ruta ampliada.

    No usa Milvus ni la huella aprobada del corpus remoto: indexar este corpus en Milvus es un paso
    aparte que requiere aprobar su huella y sincronizar (``milvus_sync``). Con ``lexico`` solo usa el
    índice léxico; en los demás modos, híbrido RRF léxico + E5 en CPU con *fallback* léxico.
    """
    lexical = VectorRetriever.from_fragments(fragments, HashingEmbedder())
    if mode == "lexico":
        return lexical, "local-lexico"
    if embedder is None:
        from ai_service.retrieval.e5_embedder import E5OnnxEmbedder

        embedder = E5OnnxEmbedder()
    semantic = _LazySemantic(lambda: VectorRetriever.from_fragments(fragments, embedder))
    return FallbackRetriever(HybridRetriever(lexical, semantic), lexical), "local-hibrido-e5+lexico"


class _LazySemantic:
    """Indexa el corpus con el modelo semántico en la primera consulta (no al arrancar ni al importar)."""

    def __init__(self, build: Callable[[], VectorRetriever]) -> None:
        self._build = build
        self._retriever: VectorRetriever | None = None

    def search(self, query: str, k: int) -> list[SearchHit]:
        if self._retriever is None:
            self._retriever = self._build()
        return self._retriever.search(query, k)

    def retrieve(self, query: str, k: int) -> list[Fragment]:
        return [hit.fragment for hit in self.search(query, k)]
