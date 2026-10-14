"""Servicio de inferencia XiYanSQL + QLoRA para WSL2 (SPEC-023, Modelo 2, Fase 1).

Se ejecuta **manualmente** dentro de WSL con el entorno del proyecto de entrenamiento y escucha solo
en ``127.0.0.1``. Ningún módulo importa ``torch``/``transformers``/``peft`` al importarse: el modelo
solo se carga en :meth:`inference_server.engine.TransformersEngine.load`, al arrancar el servidor.

El repositorio no contiene pesos, adaptadores, rutas locales ni credenciales: todo se recibe por
variables de entorno en tiempo de ejecución (``inference_server.config``).
"""
