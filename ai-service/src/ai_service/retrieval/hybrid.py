"""Recuperación híbrida: léxico + semántico (E5) fusionados con *Reciprocal Rank Fusion* (RRF).

``score(f) = Σ 1 / (c + posición)`` en cada lista; ``c = 60`` es el valor estándar de RRF. Sobre el
conjunto Gold mejoró a ambos por separado (Recall@5 0,833 frente a 0,786 léxico y 0,750 semántico).
Si el recuperador semántico falla, el error se propaga para que ``FallbackRetriever`` use el léxico.
"""

from __future__ import annotations

from typing import Protocol

from ai_service.orchestrator.ports import Fragment
from ai_service.retrieval.memory_index import SearchHit

RRF_C = 60
DEPTH = 20


class SearchesHits(Protocol):
    def search(self, query: str, k: int) -> list[SearchHit]: ...


class HybridRetriever:
    def __init__(self, lexical: SearchesHits, semantic: SearchesHits, *, c: int = RRF_C, depth: int = DEPTH) -> None:
        self._lexical = lexical
        self._semantic = semantic
        self._c = c
        self._depth = depth

    def search(self, query: str, k: int) -> list[SearchHit]:
        semantic_hits = self._semantic.search(query, self._depth)  # primero: si falla, no hay mezcla parcial
        lexical_hits = self._lexical.search(query, self._depth)
        scores: dict[str, float] = {}
        fragments: dict[str, Fragment] = {}
        for hits in (lexical_hits, semantic_hits):
            for position, hit in enumerate(hits, start=1):
                scores[hit.id] = scores.get(hit.id, 0.0) + 1.0 / (self._c + position)
                fragments.setdefault(hit.id, hit.fragment)
        ranked = sorted(scores.items(), key=lambda item: -item[1])[:k]
        return [SearchHit(id=item_id, score=score, fragment=fragments[item_id]) for item_id, score in ranked]

    def retrieve(self, query: str, k: int) -> list[Fragment]:
        return [hit.fragment for hit in self.search(query, k)]
