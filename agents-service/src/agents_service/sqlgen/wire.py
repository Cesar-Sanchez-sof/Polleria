"""Contrato HTTP entre ``ai-service`` y el servicio de inferencia XiYanSQL (WSL).

Lo importan los dos lados; solo depende de ``pydantic`` y de ``profile``/``prompt`` (biblioteca
estándar), para que el servicio de WSL no necesite el resto de ``agents_service``.

- ``GET  /v1/health``   → :class:`HealthResponse`
- ``POST /v1/generate`` :class:`GenerateRequest` → :class:`GenerateResponse`

Ambos exigen la cabecera :data:`TOKEN_HEADER` (credencial propia del canal, distinta del token de la
API del asistente y de la clave de auditoría). Los errores usan :class:`ErrorResponse` con un código
fijo; nunca incluyen el prompt, el SQL, rutas locales ni la credencial.

El servicio devuelve el texto **crudo** decodificado; la limpieza y el rechazo de salidas ambiguas
se hacen en ``ai-service`` (``output_parser``), y después actúa siempre el SQL Validator.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from agents_service.sqlgen.profile import KNOWN_ADAPTERS, PROFILE_ID, TRAINING_MAX_LENGTH
from agents_service.sqlgen.prompt import MAX_USER_CONTENT_CHARS

WIRE_CONTRACT = "xiyan-sqlgen/1"
TOKEN_HEADER = "X-Inference-Token"
MAX_OUTPUT_CHARS = 4000
MAX_RESPONSE_BYTES = 64 * 1024

RequestId = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{32}$")]
ErrorCode = Literal[
    "UNAUTHORIZED",
    "INVALID_REQUEST",
    "UNSUPPORTED_MEDIA_TYPE",
    "PAYLOAD_TOO_LARGE",
    "ADAPTER_MISMATCH",
    "PROMPT_TOO_LONG",
    "MODEL_LOADING",
    "MODEL_ERROR",
    "BUSY",
    "NOT_FOUND",
    "INTERNAL",
]


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class GenerateRequest(WireModel):
    contract: Literal["xiyan-sqlgen/1"] = WIRE_CONTRACT
    request_id: RequestId
    profile: Literal["xiyan-json-v1.0"] = PROFILE_ID
    adapter: str
    user_content: Annotated[str, Field(min_length=1, max_length=MAX_USER_CONTENT_CHARS)]
    max_new_tokens: Annotated[int, Field(ge=16, le=TRAINING_MAX_LENGTH // 2)]

    @field_validator("adapter")
    @classmethod
    def _known_adapter(cls, value: str) -> str:
        if value not in KNOWN_ADAPTERS:
            raise ValueError("Adaptador no reconocido.")
        return value


class GenerateResponse(WireModel):
    contract: Literal["xiyan-sqlgen/1"] = WIRE_CONTRACT
    request_id: RequestId
    adapter: str
    text: Annotated[str, Field(max_length=MAX_OUTPUT_CHARS)]
    finish_reason: Literal["stop", "length"]
    prompt_tokens: Annotated[int, Field(ge=0)]
    output_tokens: Annotated[int, Field(ge=0)]
    latency_ms: Annotated[int, Field(ge=0)]


class HealthResponse(WireModel):
    contract: Literal["xiyan-sqlgen/1"] = WIRE_CONTRACT
    status: Literal["loading", "ready", "error"]
    adapter: str


class ErrorResponse(WireModel):
    error: ErrorCode
