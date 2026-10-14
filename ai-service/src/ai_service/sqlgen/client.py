"""Cliente HTTP del servicio de inferencia XiYanSQL (WSL), con fallo controlado.

- Solo ``http://127.0.0.1:<puerto>`` (validado en ``config.settings``); sin proxies ni variables de
  entorno (``trust_env=False``), sin redirecciones y con *timeout* total y de conexión.
- Credencial propia del canal en :data:`~ai_service.sqlgen.wire.TOKEN_HEADER`.
- Respuesta limitada a :data:`~ai_service.sqlgen.wire.MAX_RESPONSE_BYTES` y validada con el
  contrato; ``request_id`` y adaptador deben coincidir con los solicitados.
- Clasificación de fallos (sin *fallback* al generador simulado):

  - :class:`~ai_service.orchestrator.ports.SqlGeneratorTimeout`: *timeout* de conexión o lectura.
  - :class:`~ai_service.orchestrator.ports.SqlGeneratorUnavailable`: conexión fallida, servicio
    cargando, ocupado o con error, credencial rechazada, adaptador distinto u otro estado HTTP.
  - :class:`~ai_service.orchestrator.ports.GenerationInputRejected`: el servicio rechazó la
    entrada (``400``/``422``, p. ej., más larga que la longitud entrenada).
  - :class:`~ai_service.orchestrator.ports.InvalidGeneratorOutput`: respuesta ``200`` que no cumple
    el contrato (JSON inválido, ``request_id`` distinto, tamaño excesivo).

Las excepciones solo llevan un código fijo: nunca el prompt, la salida, la URL ni la credencial.
"""

from __future__ import annotations

import secrets

import httpx
from pydantic import ValidationError

from ai_service.config.settings import SqlGenSettings
from ai_service.orchestrator.ports import (
    GenerationInputRejected,
    InvalidGeneratorOutput,
    SqlGenerationError,
    SqlGeneratorTimeout,
    SqlGeneratorUnavailable,
)
from ai_service.sqlgen.wire import (
    MAX_RESPONSE_BYTES,
    TOKEN_HEADER,
    ErrorResponse,
    GenerateRequest,
    GenerateResponse,
)

GENERATE_PATH = "/v1/generate"
MAX_CONNECT_TIMEOUT_S = 5.0
INPUT_REJECTED_STATUSES = frozenset({400, 413, 422})


class XiYanHttpClient:
    def __init__(self, config: SqlGenSettings, *, transport: httpx.BaseTransport | None = None) -> None:
        self._config = config
        self._client = httpx.Client(
            base_url=config.url,
            timeout=httpx.Timeout(config.timeout_s, connect=min(MAX_CONNECT_TIMEOUT_S, config.timeout_s)),
            transport=transport,
            trust_env=False,
            follow_redirects=False,
        )

    def close(self) -> None:
        self._client.close()

    def generate(self, user_content: str) -> GenerateResponse:
        request_id = secrets.token_hex(16)
        try:
            body = GenerateRequest(
                request_id=request_id,
                adapter=self._config.adapter,
                user_content=user_content,
                max_new_tokens=self._config.max_new_tokens,
            ).model_dump_json()
        except ValidationError:
            raise GenerationInputRejected("INVALID_REQUEST") from None

        headers = {
            TOKEN_HEADER: self._config.token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            with self._client.stream("POST", GENERATE_PATH, content=body.encode("utf-8"), headers=headers) as response:
                payload = bytearray()
                for chunk in response.iter_bytes():
                    payload += chunk
                    if len(payload) > MAX_RESPONSE_BYTES:
                        raise InvalidGeneratorOutput("RESPONSE_TOO_LARGE")
                status = response.status_code
        except httpx.ConnectTimeout:
            raise SqlGeneratorTimeout("CONNECT_TIMEOUT") from None
        except httpx.TimeoutException:
            raise SqlGeneratorTimeout("READ_TIMEOUT") from None
        except httpx.HTTPError:
            raise SqlGeneratorUnavailable("CONNECTION_FAILED") from None

        if status != 200:
            raise self._status_error(bytes(payload), status)
        try:
            result = GenerateResponse.model_validate_json(bytes(payload))
        except ValidationError:
            raise InvalidGeneratorOutput("INVALID_RESPONSE") from None
        if result.request_id != request_id:
            raise InvalidGeneratorOutput("REQUEST_ID_MISMATCH")
        if result.adapter != self._config.adapter:
            raise SqlGeneratorUnavailable("ADAPTER_MISMATCH")  # configuración, no salida del modelo
        return result

    @staticmethod
    def _status_error(payload: bytes, status: int) -> SqlGenerationError:
        try:
            code: str = ErrorResponse.model_validate_json(payload).error
        except ValidationError:
            code = "HTTP_ERROR_STATUS"
        if status in INPUT_REJECTED_STATUSES:
            return GenerationInputRejected(code)
        return SqlGeneratorUnavailable(code)
