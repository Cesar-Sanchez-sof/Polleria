"""*Embedder* semántico local: ``intfloat/multilingual-e5-small`` con ONNX Runtime en CPU (T033).

- 384 dimensiones, *mean pooling* con la máscara de atención y normalización L2 (como el modelo
  original). Prefijos de E5: ``"passage: "`` para el corpus y ``"query: "`` para las preguntas.
- Sin PyTorch: Smart App Control bloqueó ``torch_python.dll`` en Windows; ONNX Runtime y
  ``tokenizers`` sí cargan. Usa el ``onnx/model.onnx`` oficial del repositorio del modelo.
- Carga diferida: importar este módulo no importa ``onnxruntime`` ni descarga nada. Por defecto
  solo usa la caché local (``local_files_only``); la descarga inicial es un paso explícito.
- Todo se calcula en local: ningún texto sale del equipo para generar los vectores.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from ai_service.retrieval.embedder import Vector

MODEL_ID = "intfloat/multilingual-e5-small"
MODEL_FILE = "onnx/model.onnx"
TOKENIZER_FILE = "onnx/tokenizer.json"
DIMENSION = 384
MAX_TOKENS = 512
BATCH_SIZE = 16


class EmbedderUnavailable(RuntimeError):
    """El modelo de embeddings no está disponible (no descargado o no cargable)."""


class E5OnnxEmbedder:
    dimension = DIMENSION

    def __init__(self, *, model_id: str = MODEL_ID, local_files_only: bool = True, cache_dir: str | None = None) -> None:
        self._model_id = model_id
        self._local_only = local_files_only
        self._cache_dir = cache_dir
        self._session: Any = None
        self._tokenizer: Any = None
        self._input_names: frozenset[str] = frozenset()

    def _load(self) -> None:
        if self._session is not None:
            return
        try:
            import onnxruntime as ort
            from huggingface_hub import hf_hub_download
            from tokenizers import Tokenizer

            model_path = hf_hub_download(self._model_id, MODEL_FILE, cache_dir=self._cache_dir, local_files_only=self._local_only)
            tokenizer_path = hf_hub_download(self._model_id, TOKENIZER_FILE, cache_dir=self._cache_dir, local_files_only=self._local_only)
            options = ort.SessionOptions()
            options.log_severity_level = 3
            session = ort.InferenceSession(model_path, sess_options=options, providers=["CPUExecutionProvider"])
            tokenizer = Tokenizer.from_file(tokenizer_path)
        except Exception as exc:  # sin rutas ni detalles en el mensaje
            raise EmbedderUnavailable("Modelo de embeddings no disponible.") from exc
        tokenizer.enable_truncation(MAX_TOKENS)
        tokenizer.enable_padding()
        output = session.get_outputs()[0]
        if output.shape[-1] != DIMENSION:
            raise EmbedderUnavailable("Dimensión del modelo inesperada.")
        self._session, self._tokenizer = session, tokenizer
        self._input_names = frozenset(i.name for i in session.get_inputs())

    def _encode(self, texts: Sequence[str]) -> list[Vector]:
        self._load()
        import numpy as np

        vectors: list[Vector] = []
        for start in range(0, len(texts), BATCH_SIZE):
            encoded = self._tokenizer.encode_batch(list(texts[start : start + BATCH_SIZE]))
            ids = np.array([e.ids for e in encoded], dtype=np.int64)
            mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)
            feeds = {"input_ids": ids, "attention_mask": mask}
            if "token_type_ids" in self._input_names:
                feeds["token_type_ids"] = np.zeros_like(ids)
            hidden = self._session.run(None, feeds)[0]
            pooled = (hidden * mask[..., None]).sum(axis=1) / np.maximum(mask.sum(axis=1, keepdims=True), 1)
            pooled = pooled / np.maximum(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12)
            vectors.extend(tuple(float(x) for x in row) for row in pooled)
        return vectors

    def embed(self, texts: Sequence[str]) -> list[Vector]:
        """Vectores de fragmentos del corpus (prefijo ``passage:``)."""
        return self._encode([f"passage: {text}" for text in texts])

    def embed_queries(self, texts: Sequence[str]) -> list[Vector]:
        """Vectores de preguntas (prefijo ``query:``)."""
        return self._encode([f"query: {text}" for text in texts])
