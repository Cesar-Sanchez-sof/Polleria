"""Traza técnica de una consulta (P0: demostrar el procesamiento real sin respuestas preparadas).

:class:`TraceRecorder` acumula, por petición, qué etapas se ejecutaron, cuánto tardaron, con qué
código terminaron, qué modelo de SQL respondió (adaptador, latencia y tokens que informa el servicio
de inferencia), el SQL generado y el validado y el número de filas. Vive en un ``ContextVar``: el
pipeline lo abre en ``handle`` y el generador XiYanSQL lo rellena sin cambiar las interfaces.

Qué **nunca** registra: prompts, M-Schema, evidencia, la pregunta, el historial, filas ni cifras.
El SQL generado se oculta si contiene un patrón sensible (``contains_sensitive``).

Usos:

- Siempre: una línea JSON por consulta en el log del servicio (con la plantilla SQL parametrizada
  de la auditoría, nunca el SQL con literales).
- Solo con el modo diagnóstico autorizado (``AI_SERVICE_DIAGNOSTICS=1``, identidad P-9 verificada y
  cuenta evaluadora): se adjunta a la respuesta como ``diagnostico``.
"""

from __future__ import annotations

import re
import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field

from ai_service.audit.masking import contains_sensitive
from ai_service.http.schemas import Diagnostic, DiagnosticSqlModel, DiagnosticStage, Period, StageName

MAX_SQL_CHARS = 4000
_CODE_RE = re.compile(r"^[A-Z_]{3,40}$")
HIDDEN_SQL = "(oculto: el texto contenía un patrón sensible)"

_current: ContextVar["TraceRecorder | None"] = ContextVar("ai_service_trace", default=None)


def _safe_code(code: str | None) -> str | None:
    return code if code and _CODE_RE.match(code) else None


def _safe_sql(sql: str | None) -> str | None:
    if sql is None:
        return None
    return HIDDEN_SQL if contains_sensitive(sql) else sql[:MAX_SQL_CHARS]


@dataclass
class TraceRecorder:
    stages: list[DiagnosticStage] = field(default_factory=list)
    sql_model: DiagnosticSqlModel | None = None
    generated_sql: str | None = None
    validated_sql: str | None = None
    rejection_reasons: list[str] = field(default_factory=list)
    rows: int | None = None
    fragments: int | None = None
    rag_source: str | None = None
    rag_index: str | None = None
    intencion: str | None = None
    consulta: str | None = None
    concepto: str | None = None
    ajuste: str | None = None
    ruta: str | None = None
    tablas_rag: tuple[str, ...] = ()
    tablas_prompt: tuple[str, ...] = ()
    reintento: str | None = None
    sql_previo: str | None = None
    cuenta: str | None = None
    periodo: Period | None = None
    started: float = field(default_factory=time.perf_counter)

    @contextmanager
    def stage(self, name: StageName) -> Iterator[None]:
        """Registra la etapa como ``ok`` o ``fallo`` (si propaga una excepción) con su duración."""
        start = time.perf_counter()
        try:
            yield
        except Exception as exc:
            # Categoría del error clasificado (p. ej. SQLGEN_UNAVAILABLE) o su código fijo; nunca el mensaje.
            code = getattr(exc, "category", None) or getattr(exc, "code", None)
            self.add(name, "fallo", code if isinstance(code, str) else type(exc).__name__.upper()[:40], start)
            raise
        else:
            self.add(name, "ok", None, start)  # una etapa puede repetirse (comparación de dos períodos)

    def add(self, name: StageName, estado: str, code: str | None = None, start: float | None = None) -> None:
        ms = int((time.perf_counter() - start) * 1000) if start is not None else 0
        self.stages.append(DiagnosticStage(etapa=name, estado=estado, codigo=_safe_code(code), ms=ms))  # type: ignore[arg-type]

    def fail(self, name: StageName, code: str) -> None:
        """Marca como fallida una etapa ya registrada (p. ej., validación que rechaza sin excepción)."""
        index = next((i for i in range(len(self.stages) - 1, -1, -1) if self.stages[i].etapa == name), None)
        ms = self.stages.pop(index).ms if index is not None else 0  # solo la última aparición
        self.stages.append(DiagnosticStage(etapa=name, estado="fallo", codigo=_safe_code(code), ms=ms))

    def record_generation(
        self, *, adapter: str, latency_ms: int, prompt_tokens: int, output_tokens: int, finish_reason: str
    ) -> None:
        from ai_service.sqlgen.profile import BASE_MODEL_ID

        self.sql_model = DiagnosticSqlModel(
            base=BASE_MODEL_ID,
            adaptador=adapter[:80],
            latencia_ms=max(0, latency_ms),
            tokens_prompt=max(0, prompt_tokens),
            tokens_salida=max(0, output_tokens),
            fin=finish_reason if finish_reason in ("stop", "length") else "stop",  # type: ignore[arg-type]
        )

    def total_ms(self) -> int:
        return int((time.perf_counter() - self.started) * 1000)

    def build(self) -> Diagnostic:
        return Diagnostic(
            etapas=self.stages[:20],
            intencion=self.intencion,
            consulta=self.consulta,
            concepto=self.concepto,
            ajuste=self.ajuste if self.ajuste and _CODE_RE.match(self.ajuste) else None,
            ruta=self.ruta if self.ruta in ("entrenada", "saldo", "ampliada") else None,  # type: ignore[arg-type]
            tablas_rag=list(self.tablas_rag)[:10],
            tablas_prompt=list(self.tablas_prompt)[:10],
            reintento=_safe_code(self.reintento),
            sql_previo=_safe_sql(self.sql_previo),
            cuenta=self.cuenta,
            periodo=self.periodo,
            fragmentos_rag=self.fragments,
            fuente_rag=self.rag_source if self.rag_source in ("semantico", "lexico", "ninguno") else None,  # type: ignore[arg-type]
            indice_rag=self.rag_index if self.rag_index in ("milvus", "local") else None,  # type: ignore[arg-type]
            modelo_sql=self.sql_model,
            sql_generado=_safe_sql(self.generated_sql),
            sql_validado=_safe_sql(self.validated_sql),
            motivos_rechazo=self.rejection_reasons[:20],
            filas=self.rows,
            duracion_total_ms=self.total_ms(),
        )


def current() -> TraceRecorder | None:
    """Registrador de la petición en curso (``None`` fuera de ``Orchestrator.handle``)."""
    return _current.get()


@contextmanager
def recording() -> Iterator[TraceRecorder]:
    recorder = TraceRecorder()
    token = _current.set(recorder)
    try:
        yield recorder
    finally:
        _current.reset(token)
