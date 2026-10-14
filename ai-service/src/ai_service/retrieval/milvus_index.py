"""Índice vectorial remoto en Milvus / Zilliz Cloud (P-8) detrás de la interfaz ``VectorIndex``.

- Conexión solo por variables de entorno (``ZILLIZ_CLOUD_URI``, ``ZILLIZ_CLOUD_TOKEN``): nunca hay
  secretos en el código. ``pymilvus`` se importa de forma diferida.
- Colección con ``id`` (clave), ``vector`` (FLOAT_VECTOR 384, coseno) y metadatos del fragmento.
- **El índice remoto no puede ampliar el corpus**: ``search`` devuelve solo fragmentos del corpus
  local aprobado, buscados por ``id``; el texto almacenado en el servicio remoto se ignora. Un id
  desconocido se descarta.
- Solo se suben fragmentos del corpus sintético o aprobado (diccionario, relaciones, reglas,
  métricas y ejemplos SQL con parámetros), y solo tras aprobar su huella (``corpus_fingerprint``).
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from typing import Any

from ai_service.orchestrator.ports import Fragment
from ai_service.retrieval.embedder import Vector
from ai_service.retrieval.memory_index import SearchHit

DEFAULT_COLLECTION = "erp_ai_rag_v1"
MAX_TEXT = 4096
FIELDS = ("id", "tipo", "fuente", "version", "contenido")


class MilvusUnavailable(RuntimeError):
    """Milvus no está disponible o respondió con error (sin detalles ni credenciales)."""


def milvus_client_factory(uri: str, token: str, timeout_s: float = 10.0) -> Callable[[], Any]:
    def connect() -> Any:
        try:
            from pymilvus import MilvusClient

            return MilvusClient(uri=uri, token=token, timeout=timeout_s)
        except Exception:
            raise MilvusUnavailable("No se pudo conectar con Milvus.") from None  # sin URI ni token

    return connect


class MilvusVectorIndex:
    def __init__(
        self,
        client_factory: Callable[[], Any],
        corpus: Sequence[Fragment],
        *,
        collection: str = DEFAULT_COLLECTION,
        dimension: int = 384,
    ) -> None:
        self.dimension = dimension
        self._factory = client_factory
        self._client: Any = None
        self._collection = collection
        self._known = {fragment.fuente: fragment for fragment in corpus}

    def _connect(self) -> Any:
        if self._client is None:
            self._client = self._factory()
        return self._client

    def ensure_collection(self) -> None:
        try:
            client = self._connect()
            if client.has_collection(self._collection):
                return
            from pymilvus import DataType, MilvusClient

            schema = MilvusClient.create_schema(auto_id=False, enable_dynamic_field=False)
            schema.add_field("id", DataType.VARCHAR, is_primary=True, max_length=256)
            schema.add_field("vector", DataType.FLOAT_VECTOR, dim=self.dimension)
            for name in ("tipo", "fuente", "version"):
                schema.add_field(name, DataType.VARCHAR, max_length=256)
            schema.add_field("contenido", DataType.VARCHAR, max_length=MAX_TEXT)
            index_params = client.prepare_index_params()
            index_params.add_index(field_name="vector", index_type="AUTOINDEX", metric_type="COSINE")
            client.create_collection(self._collection, schema=schema, index_params=index_params)
        except MilvusUnavailable:
            raise
        except Exception:
            raise MilvusUnavailable("No se pudo preparar la colección.") from None

    def upsert(self, items: Iterable[tuple[str, Vector, Fragment]]) -> None:
        rows = []
        for item_id, vector, fragment in items:
            if item_id not in self._known or self._known[item_id] != fragment:
                raise ValueError("Solo se indexan fragmentos del corpus aprobado.")
            if len(vector) != self.dimension:
                raise ValueError("Dimensión de vector incorrecta.")
            rows.append({
                "id": item_id, "vector": list(vector), "tipo": fragment.tipo, "fuente": fragment.fuente,
                "version": fragment.version, "contenido": fragment.contenido[:MAX_TEXT],
            })
        if not rows:
            return
        try:
            self._connect().upsert(collection_name=self._collection, data=rows)
        except Exception:
            raise MilvusUnavailable("No se pudo indexar en Milvus.") from None

    def search(self, vector: Vector, k: int) -> list[SearchHit]:
        if k <= 0:
            return []
        try:
            results = self._connect().search(
                collection_name=self._collection,
                data=[list(vector)],
                limit=k,
                output_fields=["fuente"],
                search_params={"metric_type": "COSINE"},
            )
        except Exception:
            raise MilvusUnavailable("Búsqueda en Milvus no disponible.") from None
        hits: list[SearchHit] = []
        for hit in (results[0] if results else []):
            item_id = hit.get("id") if isinstance(hit, dict) else getattr(hit, "id", None)
            score = hit.get("distance") if isinstance(hit, dict) else getattr(hit, "distance", None)
            fragment = self._known.get(item_id)  # el texto remoto se ignora: solo el corpus local aprobado
            if fragment is None or not isinstance(score, (int, float)):
                continue
            hits.append(SearchHit(id=item_id, score=float(score), fragment=fragment))
        return hits
