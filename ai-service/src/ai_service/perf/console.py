"""Registros legibles en la terminal de FastAPI: ``[PERF]`` (tiempos por etapa) y ``[OPT]`` (optimizaciones).

Solo imprime lo que se midió en la petición: duraciones de ``TraceRecorder``, lo que informó el servicio de
inferencia (tokens, latencia) y los eventos de optimización registrados por cada componente. Nunca la
pregunta, prompts, SQL, filas, cifras, credenciales ni cadenas de conexión: la consulta se identifica solo
por su ``id_traza``.
"""

from __future__ import annotations

import sys
import time
from collections.abc import Callable
from typing import Any, TextIO

STAGE_LABELS: dict[str, str] = {
    "prefiltro": "reglas locales",
    "plan": "backend",
    "validacion_sql": "validador AST",
    "calculo": "motor financiero",
}


def _labels(versions: dict[str, str]) -> dict[str, str]:
    """Etiquetas según los componentes que informa el propio servicio (``versiones``): nunca se presenta un
    componente simulado como OpenAI, XiYanSQL o Neon."""
    llm = "OpenAI" if versions.get("llm", "").startswith("openai:") else "LLM simulado"
    sql = "XiYanSQL+QLoRA" if versions.get("sqlgen", "").startswith("xiyansql:") else "SQL simulado"
    db = "Neon (solo lectura)" if versions.get("executor") == "postgres-readonly" else "datos ficticios"
    return {**STAGE_LABELS, "interpretacion": llm, "explicacion": llm, "generacion_sql": sql, "ejecucion_sql": db}


def _emit(line: str, stream: TextIO | None = None) -> None:
    out = stream or sys.stderr
    try:
        out.write(line + "\n")
    except UnicodeEncodeError:  # consola o archivo sin UTF-8
        out.write(line.encode("ascii", "replace").decode("ascii") + "\n")
    out.flush()


def print_outcome(outcome: Any, stream: TextIO | None = None) -> None:
    """Bloque ``[PERF]``/``[OPT]`` de una consulta (``PipelineOutcome``) ya auditada."""
    audit, trace = getattr(outcome, "audit", None), getattr(outcome, "trace", None)
    if audit is None or trace is None:
        return
    head = f"[PERF] consulta {audit.id_traza[:16]}  ruta={trace.ruta or '-'}  estado={audit.estado}  http={outcome.status_code}"
    _emit(head, stream)
    model = trace.modelo_sql
    labels = _labels(dict(audit.versiones or {}))
    events = list(getattr(outcome, "events", ()) or ())
    parallel = any(code == "RAG_PARALLEL" for code, _ in events)
    accounted = 0
    for stage in trace.etapas:
        concurrent = parallel and stage.etapa == "recuperacion"
        if not concurrent:  # en paralelo se solapa con la interpretación: no suma al total
            accounted += stage.ms
        label = labels.get(stage.etapa, "")
        if stage.etapa == "recuperacion" and trace.indice_rag:
            label = f"RAG {trace.indice_rag}/{trace.fuente_rag or '-'}"
        extra = []
        if stage.estado != "ok":
            extra.append(f"FALLO {stage.codigo or ''}".strip())
        elif stage.codigo:
            extra.append(stage.codigo)
        if concurrent:
            extra.append("en paralelo con la interpretación")
        if stage.etapa == "generacion_sql" and model is not None and stage.estado == "ok":
            rate = f"{model.tokens_salida / (model.latencia_ms / 1000):.1f} tok/s" if model.latencia_ms > 0 else "sin inferencia"
            extra.append(f"{model.tokens_salida} tok salida, {rate}")
        _emit(f"[PERF]   {stage.etapa:<15} {label:<22} {stage.ms:>7} ms   {'; '.join(extra)}".rstrip(), stream)
    other = max(0, trace.duracion_total_ms - accounted)
    _emit(f"[PERF]   {'(sin etapa)':<15} {'auditoría y traza':<22} {other:>7} ms", stream)
    _emit(f"[PERF]   {'TOTAL':<15} {'':<22} {trace.duracion_total_ms:>7} ms", stream)
    for code, detail in events:
        _emit(f"[OPT]  {code:<22} {detail}".rstrip(), stream)


def print_startup(settings: Any, active: list[str], stream: TextIO | None = None) -> None:
    flags = (
        f"AI_PERF_OPT={'1' if settings.perf_opt else '0'}  AI_PERF_CACHE={'1' if settings.perf_cache else '0'}"
    )
    _emit(f"[OPT] configuracion: {flags}", stream)
    _emit(f"[OPT] optimizaciones activas: {', '.join(active) if active else 'ninguna (comportamiento base)'}", stream)
    if settings.llm is not None:
        _emit(
            f"[OPT] razonamiento OpenAI: interpretar={settings.llm.reasoning_effort or 'por defecto'}  "
            f"explicar={settings.llm.explain_reasoning_effort or 'por defecto'}",
            stream,
        )


def run_warm_up(perf: Any, stream: TextIO | None = None) -> dict[str, str]:
    """Calentamiento con ``AI_PERF_OPT=1``: cada paso se mide y, si falla, se informa sin detener el arranque.

    Pasos (ninguno lee filas de negocio ni consume tokens): carga de E5 (consulta de prueba), índice local del
    catálogo de módulos, búsqueda vectorial en Milvus, sesión READ ONLY en Neon (``SHOW``/``SELECT 1``) y
    conexión TLS con OpenAI (``GET /v1/models``)."""
    probe = "consulta de calentamiento"
    steps: list[tuple[str, Callable[[], object]]] = []
    if perf.embedder is not None and hasattr(perf.embedder, "embed_queries"):
        steps.append(("e5", lambda: perf.embedder.embed_queries([probe])))
    if perf.module_retriever is not None:
        steps.append(("modulos", lambda: perf.module_retriever.retrieve(probe, 1)))
    if perf.retriever is not None:
        steps.append(("rag", lambda: _rag_warm(perf.retriever, probe)))
    if perf.executor is not None and hasattr(perf.executor, "warm_up"):
        steps.append(("neon", perf.executor.warm_up))
    if perf.provider is not None and hasattr(perf.provider, "warm_up"):
        steps.append(("openai_tls", perf.provider.warm_up))
    results: dict[str, str] = {}
    for name, step in steps:
        started = time.perf_counter()
        try:
            detail = step()
        except Exception as exc:  # sin mensaje: puede contener hosts o rutas
            results[name] = f"fallo ({getattr(exc, 'code', type(exc).__name__)})"
        else:
            ms = int((time.perf_counter() - started) * 1000)
            results[name] = f"{ms} ms" + (f" ({detail})" if isinstance(detail, str) else "")
    if results:
        _emit("[OPT] WARMUP " + "  ".join(f"{k}={v}" for k, v in results.items()), stream)
    return results


def _rag_warm(retriever: Any, probe: str) -> str:
    retriever.retrieve(probe, 1)
    return f"fuente={getattr(retriever, 'last_source', '-')}"
