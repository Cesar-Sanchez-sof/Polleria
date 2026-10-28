"""Endpoints HTTP del servicio de IA (T028, CT-B).

- ``GET /v1/health``: estado mínimo ``{"estado": "ok"}``, sin versiones ni configuración.
- ``POST /v1/agent/queries`` (solo con el agente Gemini activado) y ``POST /v1/agent/groq/queries`` (solo con
  el agente Groq activado): mismo cuerpo CT-B, **identidad verificada obligatoria** (P-9). Ver
  ``ai_service.gemini_sql``.
- ``POST /v1/queries``: recibe el cuerpo CT-B y delega en ``Orchestrator.handle``, que ya valida el
  contrato (``400``), revalida el rol (``403``), aplica presupuesto e incidentes (``503``) y audita.

Controles previos al orquestador, en orden (si fallan, el orquestador **no se invoca**):

1. ``X-Internal-Token`` válido (comparación en tiempo constante) → si no, ``401`` genérico.
2. ``Content-Type: application/json`` → si no, ``415``.
3. Tamaño del cuerpo ≤ ``max_body_bytes`` (cabecera y lectura incremental) → si no, ``413``.
4. Cuerpo en UTF-8 → si no, ``400``.
5. Con ``AI_ASSISTANT_IDENTITY_KEY`` configurada (P-9): aserción ``X-ERP-Identity`` válida y
   coincidente con usuario, rol y traza → si no, ``401`` genérico. Solo entonces se crea un
   ``AuthorizationContext`` autenticado (``erp-session``).
6. Con ``AI_SERVICE_EVAL_ALLOWED_USER_IDS`` (evaluación académica): el usuario de la identidad
   verificada debe estar en esa lista → si no, ``403``.

Nunca se registran cuerpos, tokens ni valores sensibles. Los errores siguen ``{ error, errores? }``;
en los ``503`` del orquestador, ``errores`` lleva los códigos fijos del componente que falló.

Cada consulta deja una línea JSON en el logger ``ai_service.trace`` (:func:`log_outcome`). La traza
técnica (``diagnostico``) solo viaja en la respuesta con ``AI_SERVICE_DIAGNOSTICS=1``, identidad P-9
verificada y la cabecera ``X-ERP-Diagnostics: 1`` del proxy.
"""

from __future__ import annotations

import json
import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from ai_service.auth.identity import IDENTITY_HEADER, IdentityError, verify_identity_assertion
from ai_service.config.settings import ServiceSettings
from ai_service.gemini_sql.agent import AgentRefusal, AgentUnavailable, GeminiSqlAgent, RateLimited
from ai_service.http.schemas import QueryRequest
from ai_service.orchestrator.pipeline import ERROR_INVALID_REQUEST, ErrorBody, Orchestrator, PipelineOutcome
from ai_service.orchestrator.ports import AuthorizationContext

TOKEN_HEADER = "X-Internal-Token"
DIAGNOSTICS_HEADER = "X-ERP-Diagnostics"
TRACE_LOGGER = logging.getLogger("ai_service.trace")
SECURITY_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}

ERROR_UNAUTHORIZED = "No autorizado."
ERROR_FORBIDDEN = "Acceso no permitido."
ERROR_TOO_LARGE = "La solicitud es demasiado grande."
ERROR_UNSUPPORTED_MEDIA = "El contenido debe ser application/json."
ERROR_RATE_LIMITED = "Demasiadas consultas; inténtalo de nuevo en unos minutos."
ERROR_AGENT_UNAVAILABLE = "El asistente no está disponible por el momento."


def error_response(status_code: int, message: str, errores: list[str] | None = None) -> JSONResponse:
    """Respuesta de error con el formato del ERP y las cabeceras de seguridad."""
    body = ErrorBody(error=message, errores=errores or [])
    return JSONResponse(body.model_dump(mode="json", exclude={"diagnostico"}), status_code=status_code, headers=SECURITY_HEADERS)


async def _read_limited_body(request: Request, limit: int) -> bytes | None:
    """Lee el cuerpo sin superar ``limit`` bytes; ``None`` si lo excede."""
    declared = request.headers.get("content-length")
    if declared is not None and (not declared.isdigit() or int(declared) > limit):
        return None
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


def _identity_subject(text: str) -> tuple[str, int, str] | None:
    """``(id_traza, usuario.id, usuario.rol)`` del cuerpo CT-B, o ``None`` si no tienen el tipo esperado."""
    try:
        data = json.loads(text)
        trace_id, user = data["id_traza"], data["usuario"]
        user_id, rol = user["id"], user["rol"]
    except (ValueError, TypeError, KeyError):
        return None
    if not isinstance(trace_id, str) or not isinstance(rol, str) or not isinstance(user_id, int) or isinstance(user_id, bool):
        return None
    return trace_id, user_id, rol


async def _guarded_request(
    request: Request, settings: ServiceSettings
) -> tuple[str, AuthorizationContext | None] | JSONResponse:
    """Controles previos comunes (token, tipo, tamaño, UTF-8, identidad P-9, cuentas evaluadoras).

    Devuelve el cuerpo de texto y la autorización (``None`` sin P-9), o la respuesta de error.
    """
    if not settings.token_matches(request.headers.get(TOKEN_HEADER)):
        return error_response(401, ERROR_UNAUTHORIZED)

    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type != "application/json":
        return error_response(415, ERROR_UNSUPPORTED_MEDIA)

    raw = await _read_limited_body(request, settings.max_body_bytes)
    if raw is None:
        return error_response(413, ERROR_TOO_LARGE)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return error_response(400, ERROR_INVALID_REQUEST)

    authorization = None
    if settings.identity_key is not None:  # P-9: aserción obligatoria, sin excepciones
        subject = _identity_subject(text)
        if subject is None:
            return error_response(400, ERROR_INVALID_REQUEST)
        trace_id, user_id, rol = subject
        try:
            identity = verify_identity_assertion(
                request.headers.get(IDENTITY_HEADER),
                key=settings.identity_key,
                trace_id=trace_id,
                user_id=user_id,
                rol=rol,
                now=time.time(),
            )
        except IdentityError:
            return error_response(401, ERROR_UNAUTHORIZED)  # sin detallar el motivo
        # Evaluación académica: solo las cuentas evaluadoras configuradas (identidad ya verificada).
        if settings.eval_allowed_user_ids is not None and identity.user_id not in settings.eval_allowed_user_ids:
            return error_response(403, ERROR_FORBIDDEN)
        authorization = AuthorizationContext(
            rol=identity.rol, origen="erp-session", autenticado=True, modulos=identity.modulos
        )
    return text, authorization


def _register_agent_route(router: APIRouter, settings: ServiceSettings, path: str, agent: GeminiSqlAgent) -> None:
    @router.post(path)
    async def agent_queries(request: Request) -> JSONResponse:
        guarded = await _guarded_request(request, settings)
        if isinstance(guarded, JSONResponse):
            return guarded
        text, authorization = guarded
        if authorization is None:  # el agente exige identidad verificada (P-9), nunca el rol provisional
            return error_response(401, ERROR_UNAUTHORIZED)
        try:
            query = QueryRequest.model_validate_json(text)
        except ValidationError:
            return error_response(400, ERROR_INVALID_REQUEST)
        try:
            answer = await run_in_threadpool(agent.answer, query, authorization)
        except AgentRefusal as refusal:
            body = {"id_traza": query.id_traza, "estado": refusal.estado, "texto": refusal.texto, "tabla": None, "sql": None}
            return JSONResponse(body, status_code=200, headers=SECURITY_HEADERS)
        except RateLimited:
            return error_response(429, ERROR_RATE_LIMITED)
        except AgentUnavailable as unavailable:
            return error_response(unavailable.status, ERROR_AGENT_UNAVAILABLE)
        body = {
            "id_traza": answer.id_traza,
            "estado": answer.estado,
            "texto": answer.texto,
            "tabla": {"columnas": answer.columnas, "filas": answer.filas} if answer.columnas else None,
            "sql": answer.sql,
        }
        return JSONResponse(body, status_code=200, headers=SECURITY_HEADERS)


def build_router(
    settings: ServiceSettings,
    orchestrator: Orchestrator,
    agent: GeminiSqlAgent | None = None,
    groq_agent: GeminiSqlAgent | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"estado": "ok"}, headers=SECURITY_HEADERS)

    @router.post("/queries")
    async def queries(request: Request) -> JSONResponse:
        guarded = await _guarded_request(request, settings)
        if isinstance(guarded, JSONResponse):
            return guarded
        text, authorization = guarded

        # Traza en la respuesta: configuración + identidad P-9 verificada (ya filtrada por la lista de
        # evaluadores) + petición explícita del proxy. Cualquier otro caso: solo el log del servicio.
        diagnostics = (
            settings.diagnostics
            and authorization is not None
            and request.headers.get(DIAGNOSTICS_HEADER) == "1"
        )
        extra = {"diagnostics": True} if diagnostics else {}
        if authorization is None:
            outcome = await run_in_threadpool(orchestrator.handle, text)
        else:
            outcome = await run_in_threadpool(lambda: orchestrator.handle(text, authorization=authorization, **extra))
        log_outcome(outcome)
        body = outcome.body.model_dump(mode="json")
        if body.get("diagnostico", ...) is None:
            body.pop("diagnostico")  # campo opcional: ausente salvo en modo diagnóstico (proxies anteriores)
        return JSONResponse(body, status_code=outcome.status_code, headers=SECURITY_HEADERS)

    if agent is not None:
        _register_agent_route(router, settings, "/agent/queries", agent)
    if groq_agent is not None:
        _register_agent_route(router, settings, "/agent/groq/queries", groq_agent)

    return router


def log_outcome(outcome: PipelineOutcome) -> None:
    """Una línea JSON por consulta: etapas, códigos, modelo de SQL y plantilla SQL **parametrizada**.

    Nunca la pregunta, prompts, SQL con literales, filas, cifras, credenciales ni el usuario en claro
    (la auditoría solo guarda su seudónimo HMAC).
    """
    audit, trace = getattr(outcome, "audit", None), getattr(outcome, "trace", None)
    if audit is None:
        return
    entry: dict[str, object] = {
        "evento": "consulta_asistente",
        "id_traza": audit.id_traza,
        "http": outcome.status_code,
        "estado": audit.estado,
        "intencion": audit.intencion,
        "codigos": audit.codigos_rechazo,
        "plantilla_sql": audit.plantilla_sql,
        "filas": audit.filas,
        "versiones": audit.versiones,
    }
    if trace is not None:
        entry["etapas"] = [stage.model_dump(mode="json") for stage in trace.etapas]
        entry["modelo_sql"] = trace.modelo_sql.model_dump(mode="json") if trace.modelo_sql else None
        entry["consulta"], entry["fuente_rag"], entry["indice_rag"] = trace.consulta, trace.fuente_rag, trace.indice_rag
        entry["concepto"], entry["ajuste"] = trace.concepto, trace.ajuste
        entry["ruta"], entry["tablas_rag"], entry["reintento"] = trace.ruta, trace.tablas_rag, trace.reintento
        entry["duracion_total_ms"] = trace.duracion_total_ms
    TRACE_LOGGER.info(json.dumps(entry, ensure_ascii=False, default=str))
