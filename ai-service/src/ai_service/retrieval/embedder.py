"""*Embedders* para la recuperación (T032).

:class:`HashingEmbedder` es un vectorizador **léxico** determinista (bolsa de palabras con
*feature hashing* sin signo y normalización L2), implementado solo con la biblioteca estándar:

- minúsculas, sin tildes, identificadores separados por ``_``;
- se descartan palabras vacías frecuentes del español;
- se recorta un plural simple (``-es``/``-s``) para unificar formas como ``cuentas``/``cuenta``;
- el *hash* usa ``blake2b`` (estable entre ejecuciones; ``hash()`` de Python no lo es).

**No es un embedding semántico**: solo detecta coincidencias de palabras. Sinónimos sin palabras
compartidas ("dinero" frente a "efectivo") no se acercan. Los embeddings reales en CPU son T033,
pendiente de autorización.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from collections.abc import Sequence
from typing import Protocol

Vector = tuple[float, ...]

_TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = frozenset(
    {
        "a", "al", "algo", "como", "con", "cual", "cuales", "cuanto", "cuanta", "cuantos", "de", "del",
        "el", "en", "es", "esta", "este", "fue", "ha", "hay", "la", "las", "le", "les", "lo", "los",
        "mas", "me", "mi", "mis", "o", "para", "por", "que", "se", "si", "su", "sus", "un", "una",
        "y", "ya", "the", "of", "and",
    }
)


class Embedder(Protocol):
    """Convierte textos en vectores de la misma dimensión."""

    dimension: int

    def embed(self, texts: Sequence[str]) -> list[Vector]: ...


def normalize_tokens(text: str) -> list[str]:
    """Tokens normalizados (sin tildes, sin palabras vacías, plural simple recortado)."""
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    tokens = []
    for token in _TOKEN_RE.findall(plain.replace("_", " ")):
        if token in STOPWORDS:
            continue
        if len(token) > 4 and token.endswith("es"):
            token = token[:-2]
        elif len(token) > 3 and token.endswith("s"):
            token = token[:-1]
        tokens.append(token)
    return tokens


class HashingEmbedder:
    """Vectorizador léxico determinista (no semántico)."""

    def __init__(self, dimension: int = 512) -> None:
        if dimension < 8:
            raise ValueError("La dimensión debe ser al menos 8.")
        self.dimension = dimension

    def _bucket(self, token: str) -> int:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        return int.from_bytes(digest, "big") % self.dimension

    def embed(self, texts: Sequence[str]) -> list[Vector]:
        vectors = []
        for text in texts:
            values = [0.0] * self.dimension
            for token in normalize_tokens(text):
                # Sin signo: dos palabras que colisionan se suman y nunca se anulan entre sí
                # (con signo, "saldo de caja" llegó a dar un vector nulo en dimensión 64).
                values[self._bucket(token)] += 1.0
            norm = math.sqrt(sum(v * v for v in values))
            vectors.append(tuple(v / norm for v in values) if norm else tuple(values))
        return vectors
