"""Índice vectorial en memoria y recuperador (T032).

- :class:`VectorIndex` es la interfaz que también implementará el adaptador de Milvus/Zilliz
  (P-8, fase posterior): ``upsert`` y ``search`` por similitud coseno.
- :class:`InMemoryVectorIndex` la implementa con la biblioteca estándar (búsqueda exhaustiva).
- :class:`VectorRetriever` implementa la interfaz ``Retriever`` del orquestador (B3) usando un
  ``Embedder`` y un ``VectorIndex`` intercambiables.

Los vectores deben estar normalizados (L2); el coseno se calcula como producto escalar. Los
empates se resuelven por orden de inserción, para que los resultados sean deterministas.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Protocol

from ai_service.orchestrator.ports import Fragment
from ai_service.retrieval.embedder import Embedder, Vector


@dataclass(frozen=True)
class SearchHit:
    id: str
    score: float
    fragment: Fragment


class VectorIndex(Protocol):
    dimension: int

    def upsert(self, items: Iterable[tuple[str, Vector, Fragment]]) -> None: ...

    def search(self, vector: Vector, k: int) -> list[SearchHit]: ...


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Similitud coseno; 0.0 si alguno de los vectores es nulo."""
    if len(a) != len(b):
        raise ValueError("Los vectores deben tener la misma dimensión.")
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


class InMemoryVectorIndex:
    """Índice exhaustivo en memoria (sin red, sin dependencias)."""

    def __init__(self, dimension: int) -> None:
        self.dimension = dimension
        self._items: dict[str, tuple[int, Vector, Fragment]] = {}
        self._counter = 0

    def __len__(self) -> int:
        return len(self._items)

    def upsert(self, items: Iterable[tuple[str, Vector, Fragment]]) -> None:
        for item_id, vector, fragment in items:
            if len(vector) != self.dimension:
                raise ValueError("Dimensión de vector incorrecta.")
            order = self._items[item_id][0] if item_id in self._items else self._counter
            if item_id not in self._items:
                self._counter += 1
            self._items[item_id] = (order, tuple(vector), fragment)

    def search(self, vector: Vector, k: int) -> list[SearchHit]:
        if k <= 0:
            return []
        scored = [
            (cosine(vector, stored), order, item_id, fragment)
            for item_id, (order, stored, fragment) in self._items.items()
        ]
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [SearchHit(id=item_id, score=score, fragment=fragment) for score, _, item_id, fragment in scored[:k]]


class VectorRetriever:
    """Implementación de ``Retriever`` (B3) sobre un ``Embedder`` y un ``VectorIndex``."""

    def __init__(self, embedder: Embedder, index: VectorIndex, min_score: float = 0.0) -> None:
        if embedder.dimension != index.dimension:
            raise ValueError("El embedder y el índice deben tener la misma dimensión.")
        self._embedder = embedder
        self._index = index
        self._min_score = min_score

    @classmethod
    def from_fragments(
        cls, fragments: Sequence[Fragment], embedder: Embedder, min_score: float = 0.0, index: VectorIndex | None = None
    ) -> "VectorRetriever":
        """Indexa ``fragments`` en ``index`` (por defecto, en memoria) y devuelve el recuperador."""
        index = index or InMemoryVectorIndex(embedder.dimension)
        vectors = embedder.embed([f.contenido for f in fragments])
        index.upsert((f.fuente, v, f) for f, v in zip(fragments, vectors))
        return cls(embedder, index, min_score)

    def search(self, query: str, k: int) -> list[SearchHit]:
        # Los embedders asimétricos (E5) codifican preguntas y fragmentos con prefijos distintos.
        embed_query = getattr(self._embedder, "embed_queries", self._embedder.embed)
        [vector] = embed_query([query])
        return [hit for hit in self._index.search(vector, k) if hit.score > self._min_score]

    def retrieve(self, query: str, k: int) -> list[Fragment]:
        return [hit.fragment for hit in self.search(query, k)]
