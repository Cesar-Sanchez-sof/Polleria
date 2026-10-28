"""Agente Gemini de consultas de SOLO LECTURA sobre el ERP (``POST /v1/agent/queries``).

Gemini recibe únicamente el **esquema permitido al rol** (tablas, columnas y tipos: nunca datos) y la
pregunta, y propone **un** ``SELECT``. Ese SQL atraviesa, sin excepciones, las mismas barreras que el
Modelo R: prefiltro, filtro determinista de asientos registrados (P-4), SQL Validator con allowlist
por rol, revalidación en el Executor y una transacción ``READ ONLY`` con la credencial de solo
lectura. Las filas **no vuelven a Gemini**: la respuesta se arma de forma determinista.
"""
