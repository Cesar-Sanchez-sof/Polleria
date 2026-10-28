"""SQL Validator del asistente (C8, FR-017, D-7).

Defensa en profundidad: allowlist de objetos por rol (T010), validación estructural sobre el AST
de ``sqlglot`` con dialecto PostgreSQL (T011) y validación semántica contra metadatos controlados
(T012). Ningún análisis de este paquete sustituye la credencial PostgreSQL restringida de solo
lectura (DE-3, P-16) ni los límites de ejecución del SQL Executor (SEC-2).
"""
