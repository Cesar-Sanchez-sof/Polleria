"""Prefiltro determinista (T021, FR-009, FR-012, BR-12, BR-13).

Se ejecuta **antes de cualquier llamada a un modelo**. Si rechaza la solicitud, el pipeline responde
con un estado controlado y **no invoca ningún modelo** (0 llamadas facturables).

Reglas, en orden:

1. Mensaje vacío o demasiado largo.
2. Datos sensibles en el mensaje o en los turnos del usuario (DNI, RUC, correos, credenciales,
   importes): mientras P-21 siga pendiente no se envían a proveedores externos (BR-13).
3. Instrucciones de inyección (``ignora tus reglas``, ``actúa como``…) o SQL escrito por el usuario.
4. Peticiones evidentes de escritura o modificación → ``solo_lectura``.
4b. Datos restringidos (usuarios, contraseñas, auditoría, empleados, sueldos, datos personales) →
   ``no_resoluble`` con ``RESTRICTED_DATA``.
5. Preguntas claramente ajenas al dominio financiero y contable → ``fuera_de_dominio``.

Las reglas son **conservadoras y no exhaustivas**: lo que pase el prefiltro sigue sujeto a la
interpretación, al SQL Validator y a la credencial de solo lectura.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from ai_service.audit.masking import contains_sensitive
from ai_service.http.schemas import MAX_MESSAGE_CHARS, QueryRequest, ResponseState

EMPTY_MESSAGE = "EMPTY_MESSAGE"
MESSAGE_TOO_LONG = "MESSAGE_TOO_LONG"
SENSITIVE_DATA = "SENSITIVE_DATA"
PROMPT_INJECTION = "PROMPT_INJECTION"
SQL_IN_MESSAGE = "SQL_IN_MESSAGE"
WRITE_REQUEST = "WRITE_REQUEST"
OUT_OF_DOMAIN = "OUT_OF_DOMAIN"
RESTRICTED_DATA = "RESTRICTED_DATA"

_WRITE_RE = re.compile(
    # Solo formas verbales: "registros" o "asientos anulados" son preguntas legítimas.
    r"\b(?:(?:registr|modific|elimin|borr|anul|actualiz|insert|edit)(?:a|ar|e|en|es|ue|uen|ame|alo|ala)|"
    r"cambi\w*\s+(?:el|la|los|las)\s+(?:saldo|asiento|cuenta|monto|importe)|"
    r"crea\w*\s+(?:una?\s+)?(?:cuenta|asiento|per[ií]odo)|"
    r"(?:cierra|cerrar|reabre|reabrir)\s+(?:el\s+)?per[ií]odo)\b",
    re.IGNORECASE,
)
_INJECTION_RE = re.compile(
    r"(?:ignora|olvida|omite|desobedece)\w*\s+(?:\w+\s+){0,3}(?:instrucciones|reglas|restricciones)|"
    r"system\s*prompt|prompt\s+del\s+sistema|act[uú]a\s+como|eres\s+ahora|jailbreak|"
    r"modo\s+desarrollador|developer\s+mode|</?\s*(?:system|assistant|user)\s*>",
    re.IGNORECASE,
)
_SQL_RE = re.compile(
    r"\b(?:select\s+.+\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+table|"
    r"truncate|alter\s+table|grant\s+|union\s+select)\b|;\s*--|/\*",
    re.IGNORECASE | re.DOTALL,
)
_FINANCE_RE = re.compile(
    r"\b(?:saldo|cajas?|registradoras?|banco\w*|cuenta\w*|asiento\w*|debe|haber|balance|ingreso\w*|gasto\w*|"
    r"costo\w*|venta\w*|compra\w*|proveedor\w*|cliente\w*|deuda\w*|debo|deben|pag\w+|cobr\w+|"
    r"dinero|plata|efectivo|libro|mayor|diario|utilidad\w*|ganancia\w*|p[eé]rdida\w*|margen|"
    r"liquidez|patrimonio|activo\w*|pasivo\w*|impuesto\w*|igv|factura\w*|contab\w*|financ\w*|"
    r"movimiento\w*|total\w*|per[ií]odo\w*|"
    # Formas verbales y conceptos del negocio ("¿cuánto vendimos?", "gastamos", "ganamos"): sin ellas
    # preguntas financieras legítimas se cerraban como fuera de dominio antes de llegar al modelo.
    r"vend\w*|gast\w*|gan(?:amos|ando)|compr(?:a|as|amos|aron|[oó]|ado|ados)|ingres\w*|egreso\w*|"
    r"invert\w*|inversi[oó]n\w*|rentab\w*|platos?|productos?|insumos?|planilla\w*|sueldo\w*|salario\w*|"
    r"recaud\w*|facturamos|facturaron|resultado\w*|situaci[oó]n\s+financiera|"
    r"pedid\w*|comprobante\w*|boleta\w*|delivery|"
    # Resto de módulos del ERP (ruta ampliada). Usuarios, empleados y clientes pasan para que el
    # intérprete los rechace de forma explícita como datos restringidos (no como "fuera de dominio").
    r"inventario\w*|stock|existencias?|agot\w*|receta\w*|ingredientes?|merma\w*|transformaci\w*|mesas?|"
    r"[oó]rden(?:es)?\s+de\s+compra|turnos?\s+de\s+caja|apertura\w*|cierres?|arqueo\w*|registrad[oa]s?|"
    r"usuarios?|empleados?|personal|clientes?|carta|men[uú]|precios?|categor[ií]as?)\b",
    re.IGNORECASE,
)
# Datos que el asistente nunca consulta (tablas y columnas fuera de la allowlist): se rechazan antes de
# cualquier modelo con un motivo explícito, no como "fuera de dominio".
_RESTRICTED_RE = re.compile(
    r"\b(?:contrase[nñ]as?|passwords?|claves?\s+de\s+acceso|usuarios?(?:\s+del\s+sistema)?|roles?\s+y\s+permisos|"
    r"permisos\s+de\s+usuarios?|auditor[ií]a|bit[aá]cora\s+de\s+accesos|sueldos?|salarios?|planillas?|"
    r"remuneraci[oó]n\w*|empleados?|trabajadores?|dni|datos\s+personales|tel[eé]fonos?|correos?)\b",
    re.IGNORECASE,
)
_PERIOD_HINT_RE = re.compile(
    r"\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|"
    r"noviembre|diciembre|mes|año|trimestre|ayer|hoy)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class PrefilterDecision:
    """``allowed=False`` ⇒ el pipeline responde con ``estado`` sin invocar modelos."""

    allowed: bool
    estado: ResponseState | None = None
    reason: str | None = None


ALLOW = PrefilterDecision(allowed=True)


def _block(estado: ResponseState, reason: str) -> PrefilterDecision:
    return PrefilterDecision(allowed=False, estado=estado, reason=reason)


def user_turns(request: QueryRequest) -> list[str]:
    """Turnos del **usuario** del historial. Los del asistente nunca se reenvían a un modelo
    porque pueden contener cifras reales ya formateadas (BR-13)."""
    return [turn.texto for turn in request.historial if turn.rol == "usuario"]


def prefilter(request: QueryRequest, max_chars: int = MAX_MESSAGE_CHARS) -> PrefilterDecision:
    """Aplica las reglas deterministas del módulo; no llama a ningún modelo."""
    message = request.mensaje
    if not message.strip():
        return _block("requiere_aclaracion", EMPTY_MESSAGE)
    if len(message) > max_chars:
        return _block("no_resoluble", MESSAGE_TOO_LONG)

    if contains_sensitive(message) or any(contains_sensitive(t) for t in user_turns(request)):
        return _block("no_resoluble", SENSITIVE_DATA)

    is_write = bool(_WRITE_RE.search(message))
    if _INJECTION_RE.search(message):
        return _block("solo_lectura" if is_write else "fuera_de_dominio", PROMPT_INJECTION)
    if _SQL_RE.search(message):
        return _block("solo_lectura" if is_write else "fuera_de_dominio", SQL_IN_MESSAGE)
    if is_write:
        return _block("solo_lectura", WRITE_REQUEST)
    if _RESTRICTED_RE.search(message):
        return _block("no_resoluble", RESTRICTED_DATA)

    if not _FINANCE_RE.search(message):
        is_follow_up = bool(user_turns(request)) and bool(_PERIOD_HINT_RE.search(message))
        if not is_follow_up:
            return _block("fuera_de_dominio", OUT_OF_DOMAIN)
    return ALLOW
