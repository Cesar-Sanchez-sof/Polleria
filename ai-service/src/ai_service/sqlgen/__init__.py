"""Conector del Modelo 2 (XiYanSQL + QLoRA) para generar SQL PostgreSQL (SPEC-023, Fase 1).

El Modelo 2 solo **propone** SQL: nunca lo ejecuta, nunca ve filas ni cifras y nunca decide
permisos. Todo SQL generado pasa por el SQL Validator existente antes del Executor.

Los módulos de este paquete usan solo la biblioteca estándar, ``pydantic`` y ``httpx``. Ninguno
importa ``torch``, ``transformers``, ``peft`` ni ``bitsandbytes``: el modelo vive en el servicio de
inferencia de WSL (``ai-service/inference_server``) y solo se carga allí, al arrancarlo.
"""
