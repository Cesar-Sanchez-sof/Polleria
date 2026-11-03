"""Cachés deterministas en memoria (``AI_PERF_CACHE=1``; desactivadas por defecto).

Qué se guarda y por qué es seguro:

- **Interpretación**: la salida estructurada del Modelo 1 para la MISMA entrada (mensaje prefiltrado,
  turnos del usuario y contexto de pantalla), con el mismo modelo, esfuerzo e instrucciones. No depende del
  usuario: los permisos se aplican después, en cada petición.
- **Salida cruda de XiYanSQL** para el MISMO ``user_content`` (que ya incluye período, esquema filtrado por
  rol y evidencia) y el mismo adaptador. La generación es *greedy*. El parser, P-4, el validador AST, los
  permisos por módulo y el Executor se aplican SIEMPRE sobre el texto cacheado.
- **Explicación**: el texto con marcadores para la MISMA entrada (intención, período y marcadores, sin
  cifras). ``render_verified`` inserta y verifica las cifras nuevas en cada petición.

Nunca se guardan filas, cifras ni respuestas finales. Las claves son el SHA-256 de un JSON canónico (la
pregunta no queda en claro en la clave) y el contenido vive solo en la memoria del proceso.
"""

from __future__ import annotations

import hashlib
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Generic, TypeVar

from ai_service.orchestrator import diagnostics

T = TypeVar("T")

DEFAULT_MAX_ENTRIES = 256
DEFAULT_TTL_S = 30 * 60


def cache_key(*parts: str) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode("utf-8"))
        digest.update(b"\x00")
    return digest.hexdigest()


class TtlCache(Generic[T]):
    """LRU con caducidad, seguro entre hilos."""

    def __init__(self, name: str, *, max_entries: int = DEFAULT_MAX_ENTRIES, ttl_s: float = DEFAULT_TTL_S,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.name = name
        self._max = max_entries
        self._ttl = ttl_s
        self._clock = clock
        self._items: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> T | None:
        now = self._clock()
        with self._lock:
            item = self._items.get(key)
            if item is None or now - item[0] > self._ttl:
                self._items.pop(key, None)
                self.misses += 1
                return None
            self._items.move_to_end(key)
            self.hits += 1
            return item[1]

    def put(self, key: str, value: T) -> None:
        with self._lock:
            self._items[key] = (self._clock(), value)
            self._items.move_to_end(key)
            while len(self._items) > self._max:
                self._items.popitem(last=False)

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)


def record_hit(stage: str) -> None:
    """Evento ``CACHE_HIT`` con el nombre de la etapa (la traza lo pone en el ``codigo`` de esa etapa)."""
    diagnostics.event("CACHE_HIT", stage)


def record_miss(stage: str) -> None:
    diagnostics.event("CACHE_MISS", stage)


class CachingGenerationClient:
    """Envuelve el cliente del servicio de inferencia: misma entrada → misma salida *greedy*, sin invocar el modelo.

    Solo se guardan respuestas 200 válidas (los errores se propagan y nunca se cachean). En un acierto, la
    latencia informada es 0: el servidor de inferencia no se invocó."""

    def __init__(self, inner, cache: TtlCache, namespace: str) -> None:
        self._inner = inner
        self._cache = cache
        self._namespace = namespace

    def generate(self, user_content: str):
        key = cache_key(self._namespace, user_content)
        cached = self._cache.get(key)
        if cached is not None:
            record_hit("generacion_sql")
            return cached.model_copy(update={"latency_ms": 0})
        response = self._inner.generate(user_content)
        self._cache.put(key, response)
        record_miss("generacion_sql")
        return response

    def close(self) -> None:
        close = getattr(self._inner, "close", None)
        if callable(close):
            close()
