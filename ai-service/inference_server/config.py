"""Configuración del servicio de inferencia (solo biblioteca estándar), con fallo seguro.

Variables (solo se leen estas):

- ``XIYAN_SERVER_ENV``: exactamente ``development``.
- ``XIYAN_SERVER_HOST``: por defecto y únicamente ``127.0.0.1``.
- ``XIYAN_SERVER_PORT``: por defecto ``8011``; entre 1024 y 65535.
- ``XIYAN_SERVER_TOKEN``: hexadecimal de al menos 32 bytes; el mismo valor que ``AI_SQLGEN_TOKEN``
  en ``ai-service``. Nunca se versiona.
- ``XIYAN_ADAPTER_ID``: uno de los adaptadores conocidos (por defecto el de v17 balanced).
- ``XIYAN_ADAPTER_DIR``: ruta **absoluta** del directorio del adaptador; su nombre debe coincidir
  con ``XIYAN_ADAPTER_ID``.
- ``HF_HUB_CACHE``: ruta **absoluta** de la caché local de Hugging Face con el modelo base.

Rendimiento (reversibles; por defecto, el comportamiento previo):

- ``XIYAN_PROMPT_LOOKUP``: ``0`` (por defecto) o 1–20. Activa la decodificación asistida por búsqueda en el
  prompt (``prompt_lookup_num_tokens``) de transformers; con *greedy* propone n-gramas del propio prompt
  (nombres de tablas y columnas del M-Schema) y el modelo los verifica.
- ``XIYAN_WARMUP=1``: una generación corta con un texto sin datos antes de quedar ``ready``.
- ``XIYAN_QUEUE_WAIT_S``: segundos (0–30, por defecto 0) que una petición espera a que termine otra
  generación antes de responder ``503 BUSY``.

Las rutas se reciben en tiempo de ejecución y no aparecen en mensajes de error ni en ``repr``.
"""

from __future__ import annotations

import hmac
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import PurePosixPath

from ai_service.sqlgen.profile import DEFAULT_ADAPTER, KNOWN_ADAPTERS

ENV_VAR = "XIYAN_SERVER_ENV"
HOST_VAR = "XIYAN_SERVER_HOST"
PORT_VAR = "XIYAN_SERVER_PORT"
TOKEN_VAR = "XIYAN_SERVER_TOKEN"
ADAPTER_ID_VAR = "XIYAN_ADAPTER_ID"
ADAPTER_DIR_VAR = "XIYAN_ADAPTER_DIR"
HF_CACHE_VAR = "HF_HUB_CACHE"

DEVELOPMENT = "development"
ALLOWED_HOST = "127.0.0.1"
DEFAULT_PORT = 8011
PROMPT_LOOKUP_VAR = "XIYAN_PROMPT_LOOKUP"
WARMUP_VAR = "XIYAN_WARMUP"
QUEUE_WAIT_VAR = "XIYAN_QUEUE_WAIT_S"
MAX_PROMPT_LOOKUP = 20
MAX_QUEUE_WAIT_S = 30
MIN_TOKEN_BYTES = 32
MAX_BODY_BYTES = 32 * 1024


class ServerConfigError(Exception):
    """Configuración inválida o insegura. Nunca incluye valores de las variables."""


@dataclass(frozen=True)
class ServerSettings:
    host: str
    port: int
    token: str = field(repr=False)
    adapter_id: str = DEFAULT_ADAPTER
    adapter_dir: str = field(default="", repr=False)
    hf_hub_cache: str = field(default="", repr=False)
    max_body_bytes: int = MAX_BODY_BYTES
    prompt_lookup: int = 0
    warmup: bool = False
    queue_wait_s: float = 0.0

    def __repr__(self) -> str:
        return (
            f"ServerSettings(host={self.host!r}, port={self.port}, token='***', "
            f"adapter_id={self.adapter_id!r}, adapter_dir='***', hf_hub_cache='***', "
            f"prompt_lookup={self.prompt_lookup}, warmup={self.warmup}, queue_wait_s={self.queue_wait_s})"
        )

    def token_matches(self, provided: str | None) -> bool:
        if not provided:
            return False
        return hmac.compare_digest(provided.encode("utf-8"), self.token.encode("utf-8"))


def _read(env: Mapping[str, str], name: str, default: str = "") -> str:
    value = env.get(name, default)
    return value.strip() if isinstance(value, str) else ""


def _absolute_path(env: Mapping[str, str], name: str) -> str:
    value = _read(env, name)
    path = PurePosixPath(value)
    if not value or not path.is_absolute() or ".." in path.parts:
        raise ServerConfigError(f"{name} debe ser una ruta absoluta sin '..'.")
    return value


def load_server_settings(env: Mapping[str, str]) -> ServerSettings:
    if _read(env, ENV_VAR) != DEVELOPMENT:
        raise ServerConfigError(f"{ENV_VAR} debe ser '{DEVELOPMENT}'.")
    host = _read(env, HOST_VAR, ALLOWED_HOST)
    if host != ALLOWED_HOST:
        raise ServerConfigError(f"El servicio de inferencia solo puede escuchar en {ALLOWED_HOST}.")
    port_text = _read(env, PORT_VAR, str(DEFAULT_PORT))
    if not port_text.isdigit() or not 1024 <= int(port_text) <= 65535:
        raise ServerConfigError(f"{PORT_VAR} debe ser un puerto entre 1024 y 65535.")

    token = _read(env, TOKEN_VAR)
    try:
        token_bytes = bytes.fromhex(token)
    except ValueError as exc:
        raise ServerConfigError(f"{TOKEN_VAR} debe ser hexadecimal.") from exc
    if len(token_bytes) < MIN_TOKEN_BYTES:
        raise ServerConfigError(f"{TOKEN_VAR} es obligatorio y debe tener al menos {MIN_TOKEN_BYTES} bytes.")

    adapter_id = _read(env, ADAPTER_ID_VAR, DEFAULT_ADAPTER)
    if adapter_id not in KNOWN_ADAPTERS:
        raise ServerConfigError(f"{ADAPTER_ID_VAR} no es un adaptador conocido.")
    adapter_dir = _absolute_path(env, ADAPTER_DIR_VAR)
    if PurePosixPath(adapter_dir).name != adapter_id:
        raise ServerConfigError(f"{ADAPTER_DIR_VAR} no corresponde a {ADAPTER_ID_VAR}.")
    hf_hub_cache = _absolute_path(env, HF_CACHE_VAR)

    lookup_text = _read(env, PROMPT_LOOKUP_VAR, "0")
    if not lookup_text.isdigit() or int(lookup_text) > MAX_PROMPT_LOOKUP:
        raise ServerConfigError(f"{PROMPT_LOOKUP_VAR} debe ser un entero entre 0 y {MAX_PROMPT_LOOKUP}.")
    warmup_text = _read(env, WARMUP_VAR, "0")
    if warmup_text not in ("0", "1"):
        raise ServerConfigError(f"{WARMUP_VAR} debe ser '0' o '1'.")
    wait_text = _read(env, QUEUE_WAIT_VAR, "0")
    if not wait_text.isdigit() or int(wait_text) > MAX_QUEUE_WAIT_S:
        raise ServerConfigError(f"{QUEUE_WAIT_VAR} debe ser un entero entre 0 y {MAX_QUEUE_WAIT_S}.")

    return ServerSettings(
        host=host,
        port=int(port_text),
        token=token,
        adapter_id=adapter_id,
        adapter_dir=adapter_dir,
        hf_hub_cache=hf_hub_cache,
        prompt_lookup=int(lookup_text),
        warmup=warmup_text == "1",
        queue_wait_s=float(wait_text),
    )
