"""Apoyo para las pruebas del conector XiYanSQL (Fase 1): sin red, sin modelos y con datos ficticios.

:class:`FakeInferenceServer` implementa el contrato ``ai_service.sqlgen.wire`` sobre
``httpx.MockTransport`` (transporte en proceso, sin sockets). Simula al Modelo 2 leyendo la
solicitud JSON 1.0 del prompt y respondiendo con SQL de la forma del entrenamiento, o con la salida o
el fallo que cada prueba necesite.
"""

from __future__ import annotations

import json
import secrets
import sys
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import guards  # noqa: F401  (añade src/ a sys.path)

import httpx

from ai_service.assembly import build_dev_orchestrator
from ai_service.audit.masking import HMAC_KEY_ENV_VAR
from ai_service.config.settings import (
    ENV_VAR,
    SQL_GENERATOR_VAR,
    SQLGEN_TOKEN_VAR,
    SQLGEN_URL_VAR,
    TOKEN_VAR,
    load_service_settings,
)
from ai_service.sqlgen.dev_fixtures import REFERENCE_SALDO_SQL
from ai_service.sqlgen.wire import TOKEN_HEADER

ROOT = Path(__file__).resolve().parents[1]  # ai-service/
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))  # paquete inference_server

NOW = datetime(2026, 10, 12, 17, 0, tzinfo=timezone.utc)
SQLGEN_URL = "http://127.0.0.1:8011"


def xiyan_env(**overrides: str) -> dict[str, str]:
    env = {
        ENV_VAR: "development",
        TOKEN_VAR: secrets.token_hex(32),
        HMAC_KEY_ENV_VAR: secrets.token_hex(32),
        SQL_GENERATOR_VAR: "xiyansql",
        SQLGEN_URL_VAR: SQLGEN_URL,
        SQLGEN_TOKEN_VAR: secrets.token_hex(32),
    }
    env.update(overrides)
    return env


def question_of(user_content: str) -> dict[str, Any]:
    """Solicitud JSON 1.0 contenida en el prompt XiYan."""
    return json.loads(user_content.split("〖用户问题〗\n", 1)[1].split("\n", 1)[0])


def training_style_sql(request: dict[str, Any]) -> str:
    """SQL con la forma aprendida para el patrón de saldo (lo que respondería el modelo)."""
    account = request["filters"][0]["value"]
    period = request["time"]
    return REFERENCE_SALDO_SQL.format(cuenta=account, start=period["start"], end=period["end_exclusive"])


class FakeInferenceServer:
    """Servicio de inferencia simulado. ``respond`` decide la salida a partir de la solicitud."""

    def __init__(self, token: str, adapter: str = "xiyansql_v17_json_v10_balanced_full") -> None:
        self.token = token
        self.adapter = adapter
        self.requests: list[dict[str, Any]] = []
        self.headers: list[httpx.Headers] = []
        self.respond: Callable[[dict[str, Any]], httpx.Response] = self.ok
        self.text_for: Callable[[dict[str, Any]], str] = lambda body: training_style_sql(question_of(body["user_content"]))

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)

    def handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        self.headers.append(request.headers)
        if request.headers.get(TOKEN_HEADER) != self.token:
            return httpx.Response(401, json={"error": "UNAUTHORIZED"})
        return self.respond(body)

    def ok(self, body: dict[str, Any], **overrides: Any) -> httpx.Response:
        payload = {
            "contract": "xiyan-sqlgen/1",
            "request_id": body["request_id"],
            "adapter": self.adapter,
            "text": self.text_for(body),
            "finish_reason": "stop",
            "prompt_tokens": 640,
            "output_tokens": 90,
            "latency_ms": 1200,
        }
        payload.update(overrides)
        return httpx.Response(200, json=payload)


def build_xiyan(server_token: str | None = None, **env_overrides: str):
    """Orquestador de desarrollo en modo ``xiyansql`` con el servicio simulado."""
    env = xiyan_env(**env_overrides)
    settings = load_service_settings(env)
    server = FakeInferenceServer(server_token or env[SQLGEN_TOKEN_VAR])
    orchestrator, audit = build_dev_orchestrator(settings, clock=lambda: NOW, sqlgen_transport=server.transport())
    return orchestrator, audit, server, settings


def payload(mensaje: str, *, rol: str = "contador_demo", trace: str = "traza-xiyan-0001") -> dict[str, Any]:
    return {
        "id_traza": trace,
        "usuario": {"id": 7, "rol": rol},
        "mensaje": mensaje,
        "contexto": None,
        "historial": [],
        "fecha_referencia_lima": "2026-10-12",
    }
