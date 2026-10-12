"""Métricas de recuperación: Recall@k y MRR (T032, NFR-008, P-17).

- ``Recall@k`` = fragmentos relevantes recuperados entre los ``k`` primeros / total de relevantes.
- ``RR`` = 1 / posición del primer fragmento relevante (0 si no aparece en los ``k`` primeros).
- ``MRR`` = media de ``RR`` sobre las preguntas evaluadas.

No se fijan umbrales: los umbrales de aceptación siguen pendientes (P-11). Los resultados sobre
el conjunto Gold ficticio miden la **mecánica** del recuperador, no la calidad semántica.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass


def recall_at_k(relevant: Sequence[str], retrieved: Sequence[str], k: int) -> float:
    relevant_set = set(relevant)
    if not relevant_set:
        raise ValueError("Recall@k no está definido sin fragmentos relevantes.")
    return len(relevant_set & set(retrieved[:k])) / len(relevant_set)


def reciprocal_rank(relevant: Sequence[str], retrieved: Sequence[str], k: int) -> float:
    relevant_set = set(relevant)
    for position, item in enumerate(retrieved[:k], start=1):
        if item in relevant_set:
            return 1.0 / position
    return 0.0


@dataclass(frozen=True)
class RetrievalReport:
    k: int
    evaluated: int
    recall_at_k: float
    mrr: float
    per_question: tuple[tuple[str, float, float], ...]  # (id, recall, rr)


def evaluate(items: Sequence[dict], retrieve_ids: Callable[[str, int], list[str]], k: int) -> RetrievalReport:
    """Evalúa ``retrieve_ids(pregunta, k) -> [id]`` sobre los ítems Gold con relevantes."""
    rows = []
    for item in items:
        relevant = item.get("fragmentos_relevantes") or []
        if not relevant:
            continue
        retrieved = retrieve_ids(item["pregunta"], k)
        rows.append((item["id"], recall_at_k(relevant, retrieved, k), reciprocal_rank(relevant, retrieved, k)))
    if not rows:
        raise ValueError("No hay preguntas con fragmentos relevantes para evaluar.")
    return RetrievalReport(
        k=k,
        evaluated=len(rows),
        recall_at_k=sum(r for _, r, _ in rows) / len(rows),
        mrr=sum(rr for _, _, rr in rows) / len(rows),
        per_question=tuple(rows),
    )
