"""Proveedor real del Modelo 1: OpenAI Responses API (``POST /v1/responses``) con ``httpx``.

Implementa :class:`~ai_service.llm.provider.LlmProvider`; el orquestador no cambia. Se usa siempre
detrás de :class:`~ai_service.orchestrator.model_calls.ModelGateway`, que antes de llamar bloquea
datos sensibles (BR-13) y pide autorización de presupuesto a ``BudgetGuard``.

Controles:

- **Qué se envía**: solo la entrada validada de la tarea. ``interpretar`` lleva el mensaje del
  usuario ya prefiltrado y sus turnos previos; ``explicar`` lleva intención, período y
  **identificadores de marcador** (el contrato no tiene campo para cifras). Nunca SQL, filas ni
  importes. ``store: false``.
- **Salidas estructuradas estrictas** (``json_schema`` con ``strict: true``) que además se validan
  con los modelos Pydantic existentes; la cuenta debe cumplir el formato de ``QueryPlan`` y la
  explicación pasa después por ``render_verified`` (marcadores, sin cifras inventadas).
- **Costes**: ``max_output_tokens`` por tarea y coste calculado con el precio configurado a partir
  del uso informado por la API.
- **Red**: solo ``https://api.openai.com/v1``; sin proxies del entorno, sin redirecciones, con
  *timeout*. Los errores son códigos fijos: nunca la clave, el prompt ni la respuesta.
"""

from __future__ import annotations

import json
import re
import time
from collections.abc import Mapping
from typing import Any

import httpx
from pydantic import ValidationError

from ai_service.llm.budget import ModelPrice
from ai_service.sqlgen.families import FamilyCatalog
from ai_service.sqlgen.modules import ErpModules


_IDENT_RE = re.compile(r"^[a-z][a-z0-9_]{0,59}$")


def _sanitize_free_query(raw: dict[str, Any]) -> dict[str, Any]:
    """Recorta lo que excede los límites de ``FreeQuery`` en lugar de descartar toda la interpretación:
    listas a 6 elementos (4 en order_by), ``busqueda`` a 200 caracteres, filtros sin valor fuera y
    ``limit`` entre 1 y 50. La validación estricta de ``FreeQuery`` se aplica después igualmente."""
    out = dict(raw)
    for key in ("tablas", "metrics", "dimensions", "group_by", "conditions"):
        out[key] = [v for v in (out.get(key) or []) if isinstance(v, str) and _IDENT_RE.match(v)][:6]
    out["filters"] = [f for f in (out.get("filters") or []) if isinstance(f, dict) and str(f.get("value", "")).strip()][:6]
    out["order_by"] = list(out.get("order_by") or [])[:4]
    out["busqueda"] = str(out.get("busqueda") or "")[:200]
    out["pregunta_en"] = str(out.get("pregunta_en") or "")[:300]
    limit = out.get("limit")
    out["limit"] = max(1, min(50, limit)) if isinstance(limit, int) and not isinstance(limit, bool) else None
    time_concept = out.get("concepto_tiempo")
    out["concepto_tiempo"] = time_concept if isinstance(time_concept, str) and _IDENT_RE.match(time_concept) else None
    return out


def _module_menu(modules: ErpModules) -> str:
    return "\n".join(
        f"- {module}: {modules.module_name(module)} → " + ", ".join(sorted(modules.tables_for([module])))
        for module in modules.modules
    )


def _business_rules(modules: ErpModules) -> str:
    """Notas de negocio del catálogo (las mismas que recibe XiYanSQL como evidencia), por tabla: sin ellas el
    intérprete escribía objetivos que las contradecían ("do not filter by active" en "por agotarse")."""
    return "\n".join(f"- {name}: " + " ".join(table.notes.values())
                     for name, table in sorted(modules.tables.items()) if table.notes)
from ai_service.llm.provider import (
    FREE_INTENTS,
    FREE_OPERATORS,
    Entities,
    FreeQuery,
    ExplainOutput,
    InterpretOutput,
    LlmRequest,
    LlmResponse,
)

OPENAI_BASE_URL = "https://api.openai.com/v1"
RESPONSES_PATH = "/responses"
MAX_RESPONSE_BYTES = 256 * 1024
REASONING_EFFORTS = frozenset({"minimal", "low", "medium", "high"})

INTERPRET_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "intencion": {"type": "string", "enum": ["consulta_financiera", "seguimiento", "escritura", "fuera_de_dominio"]},
        "cuenta": {"type": ["string", "null"]},
        "indicador": {"type": ["string", "null"]},
        "necesita_aclaracion": {"type": "boolean"},
    },
    "required": ["intencion", "cuenta", "indicador", "necesita_aclaracion"],
}


_IDENT = {"type": "string", "pattern": "^[a-z][a-z0-9_]{0,59}$"}


def free_query_schema(modules: list[str], tables: list[str]) -> dict[str, Any]:
    """``consulta_libre`` (ruta ampliada): forma del contrato 1.0 con módulos y tablas de listas cerradas."""
    query = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "modulo": {"type": "string", "enum": modules},
            "tablas": {"type": "array", "items": {"type": "string", "enum": tables}},
            "intent": {"type": "string", "enum": list(FREE_INTENTS)},
            "subject": _IDENT,
            "metrics": {"type": "array", "items": _IDENT},
            "dimensions": {"type": "array", "items": _IDENT},
            "group_by": {"type": "array", "items": _IDENT},
            "filters": {"type": "array", "items": {
                "type": "object", "additionalProperties": False,
                "properties": {"field": _IDENT, "operator": {"type": "string", "enum": list(FREE_OPERATORS)},
                               "value": {"type": "string"}},
                "required": ["field", "operator", "value"]}},
            "conditions": {"type": "array", "items": _IDENT},
            "order_by": {"type": "array", "items": {
                "type": "object", "additionalProperties": False,
                "properties": {"field": _IDENT, "direction": {"type": "string", "enum": ["asc", "desc"]}},
                "required": ["field", "direction"]}},
            "limit": {"type": ["integer", "null"]},
            "usa_periodo": {"type": "boolean"},
            "concepto_tiempo": {"type": ["string", "null"]},
            "busqueda": {"type": "string"},
            "pregunta_en": {"type": "string"},
        },
    }
    query["required"] = list(query["properties"])
    return {"anyOf": [query, {"type": "null"}]}


def interpret_schema(
    family_ids: list[str], concept_ids: list[str] | None = None, free: tuple[list[str], list[str]] | None = None
) -> dict[str, Any]:
    """Esquema estricto de ``interpretar``; con familias añade ``consulta``; con conceptos, ``concepto``;
    con la ruta ampliada, ``restringido`` y ``consulta_libre`` (todo cerrado o null)."""
    if not family_ids:
        return INTERPRET_SCHEMA
    properties = {**INTERPRET_SCHEMA["properties"], "consulta": {"type": ["string", "null"], "enum": [*family_ids, None]}}
    required = [*INTERPRET_SCHEMA["required"], "consulta"]
    if concept_ids:
        properties["concepto"] = {"type": ["string", "null"], "enum": [*concept_ids, None]}
        required.append("concepto")
    if free:
        properties["restringido"] = {"type": "boolean"}
        properties["historico"] = {"type": "boolean"}
        properties["consulta_libre"] = free_query_schema(*free)
        required += ["restringido", "historico", "consulta_libre"]
    return {**INTERPRET_SCHEMA, "properties": properties, "required": required}


EXPLAIN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {"texto": {"type": "string"}},
    "required": ["texto"],
}

INTERPRET_INSTRUCTIONS = """Eres el intérprete del asistente financiero de SOLO LECTURA del ERP de una pollería en Perú.
Recibes un JSON con el mensaje del usuario, sus mensajes previos y el contexto de pantalla. Responde solo con el JSON del esquema.
- intencion: "consulta_financiera" si pregunta por saldos, movimientos contables, ventas, cobros, compras, pagos, platos vendidos o la situación financiera; "seguimiento" si continúa una consulta previa sin repetir la cuenta; "escritura" si pide registrar, modificar, anular o eliminar algo; "fuera_de_dominio" para cualquier otro tema.
- cuenta: código numérico de la cuenta contable solo si el usuario lo escribe o si coincide con este catálogo: {catalogo}. Si no, null. No inventes códigos.
- indicador: null, salvo que pida un indicador financiero con nombre propio (por ejemplo, liquidez); en ese caso su nombre corto.
- necesita_aclaracion: true si la consulta financiera no permite identificar la cuenta.
No calcules, estimes ni menciones importes. Las fechas y períodos los resuelve el sistema."""

FAMILY_INSTRUCTIONS = """
- consulta: si la pregunta corresponde a uno de estos tipos de consulta, su identificador; si no, null. Elige el más cercano aunque la pregunta use otras palabras:
{familias}
  Si el usuario pregunta por el saldo o el movimiento de una cuenta contable concreta (por su código, por ejemplo "cuenta 40111", o por un nombre del catálogo), usa cuenta y deja consulta en null. En los demás casos, si eliges una consulta, deja cuenta en null."""

CONCEPT_INSTRUCTIONS = """
- concepto: la magnitud contable que pide la pregunta, de esta lista (null si no es una consulta financiera). Son conceptos DISTINTOS y no se sustituyen entre sí:
{conceptos}
  Criterios (los conceptos solo aplican a consultas financieras; para el resto del ERP usa null): "vender", "facturar" e "ingresos por ventas" son ventas_facturadas; "cobrar", "dinero que entró" y "medios de pago" son cobros; "comprar" y "gastar en compras" son compras_facturadas; "pagar a proveedores" es pagos_proveedores; alquiler, luz, agua, sueldos o servicios son gastos_operativos (no son compras). Los ingresos por día se consultan con cobros. La consulta elegida debe medir el mismo concepto."""

FREE_INSTRUCTIONS = """
El asistente consulta (solo lectura) TODO el ERP de la pollería, no solo las finanzas. Las preguntas sobre productos, stock, pedidos, mesas, compras, proveedores, inventario, caja (cajas registradoras, aperturas y cierres, ingresos y egresos de caja) o contabilidad son "consulta_financiera" aunque no sean contables; "fuera_de_dominio" es solo lo que no trata de datos del restaurante.
- restringido: true si pide usuarios del sistema, contraseñas, roles o permisos, auditoría, empleados, sueldos o planillas, o datos personales de clientes o proveedores (DNI, RUC, teléfono, correo, dirección). En ese caso usa intencion "consulta_financiera" (NO "fuera_de_dominio") y deja consulta y consulta_libre en null.
- En filters, escribe los valores de estado tal como los guarda el sistema (por ejemplo Pending, OPEN, Cancelled, OperatingExpense).
- historico: true si la pregunta NO delimita fechas y se refiere a todo el historial (por ejemplo "en total", "desde siempre", "los productos más vendidos", "cuántos productos tenemos"); false si delimita un período o habla de algo reciente.
- Si una "consulta" de la lista no puede aplicar un filtro que la pregunta pide (un medio de pago, un producto, un proveedor o un estado concretos), deja consulta en null y usa consulta_libre con ese filtro.
- "más vendido" o "más ventas" sin mencionar dinero se refiere a unidades vendidas; "mayores ingresos" se refiere a importe.
- tablas: solo las necesarias para responder, empezando por la que contiene la respuesta; no añadas tablas relacionadas por si acaso. Los importes de pedidos están en order_item (sales_order no tiene importes); los gastos operativos están en informal_purchase (purchase_type OperatingExpense, sin anulados), no en la contabilidad; no combines tablas que no se relacionan entre sí.
- pregunta_en: una o dos frases en inglés que digan EXACTAMENTE qué calcular: la tabla principal, las columnas y los filtros con sus valores exactos, aplicando las reglas del negocio de abajo (por ejemplo "Sum sales_payment.amount where payment_type.name is Yape."). No escribas "do not filter by …" salvo que el usuario lo pida. Sin datos personales.
- consulta_libre: complétala SIEMPRE que la pregunta sea una consulta legítima del ERP, también si eliges una "consulta" de la lista (el sistema decide qué ruta usa). Describe QUÉ se quiere, con la forma del contrato de consultas; no escribas SQL:
  modulo: el módulo; tablas: las tablas que probablemente se necesitan (de la lista); intent: aggregate (total, conteo o promedio), list, ranking, comparison, timeseries o detail; subject: entidad principal en inglés snake_case (p. ej. product, sales_order); metrics: magnitudes en inglés snake_case (p. ej. product_count, average_order_amount); dimensions y group_by: por qué se agrupa; filters: condiciones con campo, operador y valor (p. ej. status neq Cancelled); conditions: condiciones con nombre en snake_case (p. ej. stock_below_minimum, no_sales_in_period); order_by y limit para rankings o "el último"; usa_periodo: true si la pregunta delimita fechas o habla de hoy, ayer, este mes, etc.; concepto_tiempo: columna de fecha más adecuada o null; busqueda: frase breve en español que describa los datos buscados.
Módulos y tablas que se pueden consultar:
{modulos}
Reglas del negocio (por tabla):
{reglas}"""

EXPLAIN_INSTRUCTIONS = """Redactas en español la respuesta del asistente financiero de un ERP para personas SIN conocimientos de contabilidad.
Recibes la intención, el período, el nombre de la cuenta o el título de la consulta (si existen) y una lista de marcadores. NO conoces las cifras: escribe cada cifra solo como su marcador entre llaves dobles, por ejemplo {{c1}}.
Si recibes "significados", cada marcador cN es la cifra descrita y cada marcador eN es un texto (un nombre o una fecha) que el sistema insertará; usa los eN cuando ayuden a la frase.
Sin "significados": c1 = saldo NETO de los movimientos del período (NO es el saldo final de la cuenta: no incluye saldos anteriores); c2 = total del debe; c3 = total del haber.
Reglas:
- Una o dos oraciones breves y naturales que empiecen por el resultado. Ejemplo: "Durante septiembre de 2026, los movimientos de Caja tuvieron un saldo neto de {{c1}}."
- Nunca digas "saldo final" ni "saldo de la cuenta" para c1.
- Si el período es un mes completo, escríbelo como "septiembre de 2026"; si no, como "del dd/mm/aaaa al dd/mm/aaaa".
- Usa cada marcador cN recibido exactamente una vez y no inventes otros.
- No escribas números (salvo años y fechas), montos, monedas ni porcentajes. Sin tecnicismos ni conclusiones que no se deduzcan del resultado (por ejemplo, una diferencia entre ventas y compras no es la utilidad contable)."""


class OpenAiProviderError(Exception):
    """Fallo del proveedor con código fijo; el ``ModelGateway`` lo convierte en ``ModelUnavailable``."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class OpenAiResponsesProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        price: ModelPrice,
        account_catalog: Mapping[str, str],
        reasoning_effort: str | None = None,
        transport: httpx.BaseTransport | None = None,
        families: FamilyCatalog | None = None,
        modules: ErpModules | None = None,
    ) -> None:
        if reasoning_effort is not None and reasoning_effort not in REASONING_EFFORTS:
            raise ValueError("Esfuerzo de razonamiento no válido.")
        self.model = model
        self._api_key = api_key
        self._price = price
        self._catalog = ", ".join(f"{name}={code}" for name, code in sorted(account_catalog.items())) or "(vacío)"
        # Lista cerrada de familias (P1): el esquema estricto solo admite sus ids o null.
        self._family_ids = list(families.ids) if families else []
        self._concept_ids = list(families.concepts) if families else []
        # Ruta ampliada: módulos y tablas consultables (sin columnas personales ni tablas de seguridad).
        self._free = (sorted(modules.modules), sorted(modules.tables)) if modules and families else None
        self._interpret_schema = interpret_schema(self._family_ids, self._concept_ids, self._free)
        self._interpret_instructions = INTERPRET_INSTRUCTIONS.format(catalogo=self._catalog) + (
            FAMILY_INSTRUCTIONS.format(familias=families.menu()) if families else ""
        ) + (CONCEPT_INSTRUCTIONS.format(conceptos=families.concept_menu()) if self._concept_ids else "") + (
            FREE_INSTRUCTIONS.format(modulos=_module_menu(modules), reglas=_business_rules(modules)) if self._free else ""
        )
        self._reasoning_effort = reasoning_effort
        self._client = httpx.Client(
            base_url=OPENAI_BASE_URL, transport=transport, trust_env=False, follow_redirects=False
        )

    def __repr__(self) -> str:
        return f"OpenAiResponsesProvider(model={self.model!r}, api_key='***')"

    def close(self) -> None:
        self._client.close()

    # ----------------------------------------------------------------- LlmProvider
    def complete(self, request: LlmRequest) -> LlmResponse:
        task = request.entrada.tarea
        body: dict[str, Any] = {
            "model": self.model,
            "instructions": self._interpret_instructions if task == "interpretar" else EXPLAIN_INSTRUCTIONS,
            "input": request.entrada.model_dump_json(exclude={"tarea"}),
            "max_output_tokens": request.max_tokens_salida,
            "store": False,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "interpretacion" if task == "interpretar" else "explicacion",
                    "schema": self._interpret_schema if task == "interpretar" else EXPLAIN_SCHEMA,
                    "strict": True,
                }
            },
        }
        if self._reasoning_effort:
            body["reasoning"] = {"effort": self._reasoning_effort}

        started = time.perf_counter()
        data = self._post(body, timeout_s=request.timeout_ms / 1000)
        latency_ms = int((time.perf_counter() - started) * 1000)

        if data.get("status") != "completed":
            raise OpenAiProviderError("INCOMPLETE_RESPONSE")
        text = self._output_text(data)
        usage = data.get("usage") or {}
        input_tokens, output_tokens = usage.get("input_tokens"), usage.get("output_tokens")
        if not isinstance(input_tokens, int) or not isinstance(output_tokens, int) or input_tokens < 0 or output_tokens < 0:
            raise OpenAiProviderError("MISSING_USAGE")

        try:
            payload = json.loads(text)
            salida = self._to_output(task, payload, self._family_ids, self._concept_ids, self._free)
            return LlmResponse(
                id_traza=request.id_traza,
                salida=salida,
                tokens_entrada=input_tokens,
                tokens_salida=output_tokens,
                modelo=self.model,
                version=str(data.get("model") or self.model)[:80],
                latencia_ms=latency_ms,
                costo_estimado=self._price.cost(input_tokens, output_tokens),
            )
        except (ValueError, ValidationError):
            raise OpenAiProviderError("INVALID_STRUCTURED_OUTPUT") from None

    # ----------------------------------------------------------------- detalles
    def _post(self, body: dict[str, Any], *, timeout_s: float) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        try:
            with self._client.stream(
                "POST", RESPONSES_PATH, content=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                headers=headers, timeout=httpx.Timeout(timeout_s, connect=min(5.0, timeout_s)),
            ) as response:
                raw = bytearray()
                for chunk in response.iter_bytes():
                    raw += chunk
                    if len(raw) > MAX_RESPONSE_BYTES:
                        raise OpenAiProviderError("RESPONSE_TOO_LARGE")
                status = response.status_code
        except httpx.TimeoutException:
            raise OpenAiProviderError("TIMEOUT") from None
        except httpx.HTTPError:
            raise OpenAiProviderError("CONNECTION_FAILED") from None
        if status != 200:
            code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "MODEL_NOT_FOUND", 429: "RATE_LIMITED_OR_NO_CREDIT"}
            raise OpenAiProviderError(code.get(status, "HTTP_ERROR_STATUS"))
        try:
            data = json.loads(bytes(raw))
        except ValueError:
            raise OpenAiProviderError("INVALID_RESPONSE") from None
        if not isinstance(data, dict):
            raise OpenAiProviderError("INVALID_RESPONSE")
        return data

    @staticmethod
    def _output_text(data: Mapping[str, Any]) -> str:
        texts, refused = [], False
        for item in data.get("output") or []:
            if not isinstance(item, dict) or item.get("type") != "message":
                continue
            for part in item.get("content") or []:
                if isinstance(part, dict) and part.get("type") == "output_text" and isinstance(part.get("text"), str):
                    texts.append(part["text"])
                elif isinstance(part, dict) and part.get("type") == "refusal":
                    refused = True
        if refused:
            raise OpenAiProviderError("REFUSAL")
        if len(texts) != 1:
            raise OpenAiProviderError("INVALID_RESPONSE")
        return texts[0]

    @staticmethod
    def _to_output(
        task: str, payload: Any, family_ids: list[str] | None = None, concept_ids: list[str] | None = None,
        free: tuple[list[str], list[str]] | None = None,
    ) -> InterpretOutput | ExplainOutput:
        if not isinstance(payload, dict):
            raise ValueError("Salida no es un objeto.")
        if task == "interpretar":
            family_ids, concept_ids = family_ids or [], concept_ids or []
            if set(payload) != set(interpret_schema(family_ids, concept_ids, free)["required"]):
                raise ValueError("Campos inesperados.")
            consulta, concepto = payload.get("consulta"), payload.get("concepto")
            if consulta is not None and consulta not in family_ids:
                raise ValueError("Consulta fuera de la lista cerrada.")
            if concepto is not None and concepto not in concept_ids:
                raise ValueError("Concepto fuera de la lista cerrada.")
            libre = payload.get("consulta_libre")
            if libre is not None and free is not None:
                modules, tables = free
                if libre.get("modulo") not in modules or any(t not in tables for t in libre.get("tablas", [])):
                    raise ValueError("Módulo o tabla fuera de la lista cerrada.")
                libre = FreeQuery.model_validate(_sanitize_free_query(libre), strict=False)
            return InterpretOutput(
                tarea="interpretar",
                intencion=payload["intencion"],
                entidades=Entities(cuenta=payload["cuenta"], indicador=payload["indicador"], consulta=consulta,
                                   concepto=concepto, consulta_libre=libre if free else None,
                                   restringido=bool(payload.get("restringido", False)),
                                   historico=bool(payload.get("historico", False))),
                necesita_aclaracion=payload["necesita_aclaracion"],
            )
        if set(payload) != {"texto"}:
            raise ValueError("Campos inesperados.")
        return ExplainOutput(tarea="explicar", texto=payload["texto"])
