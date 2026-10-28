"""Perfil de prompt del entrenamiento QLoRA ``json_v10`` (contrato de solicitud 1.0).

Valores verificados en solo lectura contra el proyecto de entrenamiento (2026-10-13):

- Dataset ``v1.7_json_v1.0_balanced`` (400 ejemplos) y ``v1.7.1_json_v1.0_semantic``.
- ``〖DB_ID〗``: ``los_betos`` en el 100 % de los ejemplos. Es la **etiqueta del dataset de
  entrenamiento**, no el identificador del ERP: se conserva solo para no alterar la entrada que el
  adaptador aprendió. Nunca llega al SQL (el validador rechaza nombres calificados no permitidos).
- Plantilla de chat ChatML de Qwen, idéntica en v17 y v171; ``eos_token`` = ``<|im_end|>``.
- Longitud máxima de entrenamiento: 1024 tokens (prompt + SQL).

Ningún valor de este módulo es una ruta local, una credencial ni un dato del ERP.
"""

from __future__ import annotations

PROFILE_ID = "xiyan-json-v1.0"
CONTRACT_VERSION = "1.0"
DIALECT = "PostgreSQL"
TRAINING_DB_ID = "los_betos"
TRAINING_MAX_LENGTH = 1024
DEFAULT_MAX_NEW_TOKENS = 256

BASE_MODEL_ID = "XGenerationLab/XiYanSQL-QwenCoder-7B-2504"
DEFAULT_ADAPTER = "xiyansql_v17_json_v10_balanced_full"
ALTERNATIVE_ADAPTER = "xiyansql_v171_json_v10_semantic_full"
KNOWN_ADAPTERS: frozenset[str] = frozenset({DEFAULT_ADAPTER, ALTERNATIVE_ADAPTER})
