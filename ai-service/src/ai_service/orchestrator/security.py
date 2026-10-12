"""Incidentes de seguridad del orquestador (BR-13, SEC-6).

:class:`SecurityIncident` es una excepción **específica** (no deriva de ``AssertionError``). Cuando
se lanza, el pipeline **detiene el procesamiento**, no invoca más componentes, responde con un
error genérico que no revela datos y marca el resultado y la auditoría como incidente de seguridad.

Controles de producción incluidos aquí:

- :func:`ensure_no_sensitive_data`: segunda línea de defensa de BR-13 justo antes de enviar algo a
  un proveedor externo de inferencia. La primera línea es el prefiltro; si el prefiltro fallara,
  este control bloquea la llamada **antes** de reservar presupuesto o contactar al proveedor.
"""

from __future__ import annotations

from ai_service.audit.masking import contains_sensitive

SECURITY_INCIDENT = "SECURITY_INCIDENT"
SENSITIVE_DATA_BLOCKED = "SENSITIVE_DATA_BLOCKED"


class SecurityIncident(Exception):
    """Incidente de seguridad: el procesamiento debe detenerse. ``code`` es para auditoría."""

    code = SECURITY_INCIDENT

    def __init__(self, code: str | None = None) -> None:
        super().__init__(code or self.code)
        if code:
            self.code = code


class SensitiveDataBlocked(SecurityIncident):
    """Se intentó enviar datos sensibles a un proveedor externo; la llamada no se realizó."""

    code = SENSITIVE_DATA_BLOCKED


def ensure_no_sensitive_data(payload: str) -> None:
    """Lanza :class:`SensitiveDataBlocked` si ``payload`` contiene un patrón sensible conocido.

    El mensaje de la excepción nunca incluye el contenido detectado.
    """
    if contains_sensitive(payload):
        raise SensitiveDataBlocked()
