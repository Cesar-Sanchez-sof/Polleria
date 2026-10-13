"""``OutputParser``: extrae **una** sentencia SQL de la salida del Modelo 2 o la rechaza.

Formato aprendido: una sola sentencia en una línea, terminada en ``;``, sin cerco de código (el
prompt ya abre ```` ```sql ````). Se aceptan las variantes que el script de evaluación del
entrenamiento limpiaba (cerco inicial ```` ```sql ```` o ```` ``` ```` y cierre ```` ``` ````), pero
cualquier texto después del cierre, una salida truncada o más de una sentencia se rechazan: no se
"adivina" cuál era el SQL.

Este parser **no** decide si el SQL es seguro: eso lo hace siempre el SQL Validator después.
Una salida rechazada es un **formato inválido del modelo**, no una indisponibilidad del servicio:
la consulta queda ``no_resoluble`` (categoría ``SQLGEN_INVALID_OUTPUT``).
"""

from __future__ import annotations

from sqlglot import tokens as sqlglot_tokens
from sqlglot.errors import TokenError

from ai_service.orchestrator.ports import InvalidGeneratorOutput
from ai_service.sqlgen.prompt import SPECIAL_MARKERS
from ai_service.sqlgen.wire import MAX_OUTPUT_CHARS

FENCE = "```"


class InvalidModelOutput(InvalidGeneratorOutput):
    """La salida del Modelo 2 no es una única sentencia SQL utilizable. No incluye la salida."""


def parse_sql_output(text: str, finish_reason: str) -> str:
    if finish_reason != "stop":
        raise InvalidModelOutput("TRUNCATED_OUTPUT")
    if not isinstance(text, str) or len(text) > MAX_OUTPUT_CHARS:
        raise InvalidModelOutput("OUTPUT_TOO_LONG")
    if any(marker in text for marker in SPECIAL_MARKERS):
        raise InvalidModelOutput("SPECIAL_TOKENS")

    candidate = text.strip()
    if candidate.startswith(FENCE + "sql"):
        candidate = candidate[len(FENCE) + 3 :].strip()
    elif candidate.startswith(FENCE):
        candidate = candidate[len(FENCE) :].strip()
    if FENCE in candidate:
        candidate, trailing = candidate.split(FENCE, 1)
        if trailing.strip():
            raise InvalidModelOutput("AMBIGUOUS_OUTPUT")
        candidate = candidate.strip()
    if not candidate:
        raise InvalidModelOutput("EMPTY_OUTPUT")

    try:
        token_list = sqlglot_tokens.Tokenizer(dialect="postgres").tokenize(candidate)
    except TokenError as exc:
        raise InvalidModelOutput("UNPARSEABLE_OUTPUT") from exc
    if not token_list or token_list[0].token_type not in (
        sqlglot_tokens.TokenType.SELECT,
        sqlglot_tokens.TokenType.WITH,
    ):
        raise InvalidModelOutput("NOT_A_QUERY")
    semicolons = [i for i, token in enumerate(token_list) if token.token_type == sqlglot_tokens.TokenType.SEMICOLON]
    if semicolons and semicolons != [len(token_list) - 1]:
        raise InvalidModelOutput("MULTIPLE_STATEMENTS")

    return candidate.rstrip().removesuffix(";").rstrip()
