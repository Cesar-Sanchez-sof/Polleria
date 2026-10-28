"""Clientes mínimos de LLM (Gemini y Groq) que solo devuelven el texto generado.

Salida restringida a JSON (``{"sql": "..."}``), temperatura 0 y tope de tokens. La clave solo viaja en la
cabecera de autenticación hacia el host del proveedor (``generativelanguage.googleapis.com`` o
``api.groq.com``): sin proxies del entorno, sin redirecciones y con respuesta acotada. Los errores se
clasifican sin conservar mensajes.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from agents_service.gemini_sql.config import GeminiSqlSettings, GroqSqlSettings

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_OUTPUT_TOKENS = 2048
RETRY_PAUSE_S = 1.5
MAX_RESPONSE_BYTES = 128 * 1024
ATTEMPTS = 2
TRANSIENT_STATUS = frozenset({429, 500, 502, 503, 504})
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {"sql": {"type": "STRING"}},
    "required": ["sql"],
}


class LlmError(Exception):
    """Fallo clasificado de un proveedor de LLM; ``category`` es fija y no contiene datos."""

    def __init__(self, category: str, detail: str = "") -> None:
        super().__init__(category)
        self.category = category
        self.detail = detail

    @property
    def is_timeout(self) -> bool:
        return self.category.endswith("_TIMEOUT")


class GeminiError(LlmError):
    """Fallo clasificado de Gemini."""


class GroqError(LlmError):
    """Fallo clasificado de Groq."""


def _post_with_retry(
    http: httpx.Client, url: str, *, headers: dict[str, str], body: dict[str, Any], prefix: str, error: type[LlmError]
) -> httpx.Response:
    """POST con un reintento ante 429/5xx/red; devuelve una respuesta 200 de tamaño acotado o lanza ``error``."""
    response: httpx.Response | None = None
    for attempt in range(ATTEMPTS):
        try:
            response = http.post(url, json=body, headers=headers)
        except httpx.TimeoutException:
            raise error(f"{prefix}_TIMEOUT") from None
        except httpx.HTTPError as exc:
            if attempt + 1 < ATTEMPTS:
                time.sleep(RETRY_PAUSE_S)
                continue
            raise error(f"{prefix}_UNAVAILABLE", type(exc).__name__) from None
        if response.status_code in TRANSIENT_STATUS and attempt + 1 < ATTEMPTS:
            time.sleep(RETRY_PAUSE_S)
            continue
        break
    assert response is not None
    if response.status_code in (400, 401, 403):
        raise error(f"{prefix}_REJECTED", f"HTTP_{response.status_code}")
    if response.status_code != 200:
        raise error(f"{prefix}_UNAVAILABLE", f"HTTP_{response.status_code}")
    if len(response.content) > MAX_RESPONSE_BYTES:
        raise error(f"{prefix}_UNAVAILABLE", "RESPONSE_TOO_LARGE")
    return response


class GeminiHttpClient:
    def __init__(self, settings: GeminiSqlSettings, *, transport: httpx.BaseTransport | None = None) -> None:
        self._settings = settings
        self._client = httpx.Client(
            transport=transport, trust_env=False, follow_redirects=False, timeout=float(settings.timeout_s)
        )

    def generate(self, system: str, user: str) -> str:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
                "thinkingConfig": {"thinkingBudget": 0},
                "responseMimeType": "application/json",
                "responseSchema": RESPONSE_SCHEMA,
            },
        }
        url = f"{BASE_URL}/{self._settings.model}:generateContent"
        response = _post_with_retry(
            self._client, url, headers={"x-goog-api-key": self._settings.api_key}, body=body, prefix="GEMINI", error=GeminiError
        )
        try:
            candidate = response.json()["candidates"][0]
            text = "".join(part.get("text", "") for part in candidate["content"]["parts"])
            finish = candidate.get("finishReason")
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            raise GeminiError("GEMINI_BAD_RESPONSE") from None
        if finish != "STOP" or not text.strip():
            raise GeminiError("GEMINI_BAD_RESPONSE")
        return text


class GroqHttpClient:
    """Groq (API compatible con OpenAI ``chat/completions``) en modo JSON, temperatura 0."""

    def __init__(self, settings: GroqSqlSettings, *, transport: httpx.BaseTransport | None = None) -> None:
        self._settings = settings
        self._client = httpx.Client(
            transport=transport, trust_env=False, follow_redirects=False, timeout=float(settings.timeout_s)
        )

    def generate(self, system: str, user: str) -> str:
        body = {
            "model": self._settings.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "response_format": {"type": "json_object"},
        }
        if self._settings.model.startswith("openai/gpt-oss"):
            body["reasoning_effort"] = "low"  # modelo con razonamiento: menos tokens y respuesta más rápida
        response = _post_with_retry(
            self._client,
            GROQ_URL,
            headers={"Authorization": f"Bearer {self._settings.api_key}"},
            body=body,
            prefix="GROQ",
            error=GroqError,
        )
        try:
            choice = response.json()["choices"][0]
            text = choice["message"]["content"]
            finish = choice.get("finish_reason")
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            raise GroqError("GROQ_BAD_RESPONSE") from None
        if finish != "stop" or not isinstance(text, str) or not text.strip():
            raise GroqError("GROQ_BAD_RESPONSE")
        return text
