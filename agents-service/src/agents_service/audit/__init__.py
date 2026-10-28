"""Trazas de auditoría minimizadas y protegidas (C11, T015, FR-022, SEC-8).

ADVERTENCIA: este paquete define **cómo se construye** una traza mínima y segura. **No es un
sistema de auditoría de producción completo**: no persiste trazas, no implementa control de acceso
de lectura ni retención. Eso corresponde al ``AuditSink`` (T020) y a la política pendiente P-10
(almacén, plazo de retención, gestión de la clave HMAC y roles de auditoría).
"""
