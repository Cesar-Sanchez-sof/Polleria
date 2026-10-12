"""Orquestador del asistente (C4, B3).

En B3 el orquestador funciona **solo con simulaciones**: proveedor LLM simulado, recuperación con
fragmentos ficticios, generador de SQL por plantillas y Executor con fixtures. Reutiliza los
componentes reales de B1/B2: SQL Validator, motor financiero, ``BudgetGuard`` y auditoría.
No hay modelos reales, embeddings, red ni bases de datos.
"""
