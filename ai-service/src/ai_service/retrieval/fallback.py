"""Recuperador con *fallback*: semántico primero y léxico si falla o no devuelve nada."""

from __future__ import annotations

from ai_service.orchestrator.ports import Fragment, Retriever


class FallbackRetriever:
    """Implementa ``Retriever``. ``last_source`` indica qué recuperador respondió (``semantico``/``lexico``)."""

    def __init__(self, primary: Retriever, fallback: Retriever) -> None:
        self._primary = primary
        self._fallback = fallback
        self.last_source = "ninguno"
        self.failures = 0

    def retrieve(self, query: str, k: int) -> list[Fragment]:
        try:
            fragments = self._primary.retrieve(query, k)
        except Exception:  # modelo no disponible, Milvus caído, etc.: sin detalles
            self.failures += 1
            fragments = []
        if fragments:
            self.last_source = "semantico"
            return fragments
        self.last_source = "lexico"
        return self._fallback.retrieve(query, k)
