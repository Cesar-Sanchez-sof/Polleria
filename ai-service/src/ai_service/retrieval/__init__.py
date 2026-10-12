"""Recuperación RAG (C6, B4).

En B4 la recuperación es **en memoria** y usa un *embedder* léxico determinista de la biblioteca
estándar. Sirve para probar la **mecánica** (indexar, buscar por coseno, medir Recall@k y MRR), no
equivale a embeddings semánticos reales (T033, pendiente). El índice está detrás de la interfaz
``VectorIndex`` para conectar Milvus/Zilliz más adelante (P-8).
"""
