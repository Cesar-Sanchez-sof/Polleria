"""Construcción del prompt XiYan y de la plantilla ChatML del entrenamiento (solo biblioteca estándar).

Reproduce exactamente el ``PROMPT_TEMPLATE`` usado para construir el dataset y evaluar los
adaptadores, y la plantilla ChatML de Qwen sin herramientas con ``add_generation_prompt=True``.
El servicio de inferencia comprueba al cargar el tokenizer que :func:`render_chatml` coincide con
``tokenizer.apply_chat_template``; si no coincide, no pasa a estado ``ready``.

El mensaje de usuario original **nunca** forma parte del prompt: la pregunta es la solicitud JSON
1.0 construida de forma determinista desde el plan (``plan_to_request``).
"""

from __future__ import annotations

from ai_service.sqlgen.profile import DIALECT

INSTRUCTION = (
    "你是一名{dialect}专家，现在需要阅读并理解下面的〖数据库schema〗描述，以及可能用到的〖参考信息〗，"
    "并运用{dialect}知识生成sql语句回答〖用户问题〗。"
)
XIYAN_TEMPLATE = (
    INSTRUCTION
    + "\n〖用户问题〗\n{question}\n\n〖数据库schema〗\n{db_schema}\n\n〖参考信息〗\n{evidence}"
    + "\n\n〖用户问题〗\n{question}\n\n```sql"
)
PROMPT_HEADER = INSTRUCTION.format(dialect=DIALECT)
PROMPT_SUFFIX = "\n\n```sql"

DEFAULT_SYSTEM = "You are Qwen, created by Alibaba Cloud. You are a helpful assistant."
IM_START = "<|im_start|>"
IM_END = "<|im_end|>"
ENDOFTEXT = "<|endoftext|>"
STOP_TOKENS: tuple[str, ...] = (IM_END, ENDOFTEXT)
SPECIAL_MARKERS: tuple[str, ...] = (IM_START, IM_END, ENDOFTEXT, "<|fim_", "<tool_call>", "</tool_call>")

# Calibrado con el dataset v1.7: el prompt más largo (con SQL) tenía 3056 caracteres y el p95, 2562.
# El límite exacto en tokens lo aplica el servicio de inferencia con el tokenizer real.
MAX_USER_CONTENT_CHARS = 3000


class PromptError(ValueError):
    """El prompt no puede construirse de forma segura o fiel al entrenamiento."""


def _check_part(name: str, value: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise PromptError(f"La sección {name} está vacía.")
    if any(marker in value for marker in SPECIAL_MARKERS):
        raise PromptError(f"La sección {name} contiene marcadores especiales del modelo.")


def build_user_content(question: str, db_schema: str, evidence: str) -> str:
    """Mensaje de usuario XiYan; ``question`` es la solicitud JSON 1.0 ya serializada."""
    for name, value in (("question", question), ("db_schema", db_schema), ("evidence", evidence)):
        _check_part(name, value)
    if "\n" in question:
        raise PromptError("La solicitud JSON debe ir en una sola línea.")
    content = XIYAN_TEMPLATE.format(dialect=DIALECT, question=question, db_schema=db_schema, evidence=evidence)
    if len(content) > MAX_USER_CONTENT_CHARS:
        raise PromptError("El prompt supera la longitud usada en el entrenamiento.")
    return content


def is_xiyan_user_content(content: str) -> bool:
    """Comprobación estructural usada también por el servicio de inferencia."""
    return (
        isinstance(content, str)
        and content.startswith(PROMPT_HEADER + "\n〖用户问题〗\n")
        and content.endswith(PROMPT_SUFFIX)
        and not any(marker in content for marker in SPECIAL_MARKERS)
        and len(content) <= MAX_USER_CONTENT_CHARS
    )


def render_chatml(user_content: str) -> str:
    """Plantilla ChatML de Qwen (sin herramientas ni ``system`` propio) + prompt de generación."""
    return (
        f"{IM_START}system\n{DEFAULT_SYSTEM}{IM_END}\n"
        f"{IM_START}user\n{user_content}{IM_END}\n"
        f"{IM_START}assistant\n"
    )
