"""Corpus de fragmentos para RAG (T030 → T032).

Convierte los metadatos del esquema, el glosario curado y las reglas confirmadas en
:class:`~ai_service.orchestrator.ports.Fragment`. Cada fragmento usa ``fuente`` como
**identificador estable**, que el conjunto Gold referencia para medir Recall@k y MRR:

- ``schema:table:<tabla>``
- ``schema:relation:<tabla>.<columna>-><tabla>.<columna>`` (solo entre tablas incluidas)
- ``rule:<id>``

No se generan ejemplos Text-to-SQL sobre tablas reales: los objetos permitidos reales siguen
pendientes (P-14).
"""

from __future__ import annotations

import json
from pathlib import Path

from ai_service.orchestrator.ports import Fragment


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def table_fragment_id(table: str) -> str:
    return f"schema:table:{table}"


def relation_fragment_id(table: str, columns: list[str], target: str, target_columns: list[str]) -> str:
    return f"schema:relation:{table}.{','.join(columns)}->{target}.{','.join(target_columns)}"


def build_corpus(metadata: dict, glossary: dict, rules: dict) -> list[Fragment]:
    """Fragmentos deterministas (mismo orden y contenido para las mismas entradas)."""
    schema_version = metadata["schema_sha256"][:12]
    table_terms: dict[str, str] = glossary.get("tables", {})
    column_terms: dict[str, str] = glossary.get("columns", {})
    fragments: list[Fragment] = []

    for model in metadata["models"]:
        table = model["table"]
        column_texts = []
        for column in model["columns"]:
            description = column_terms.get(f"{table}.{column['column']}")
            column_texts.append(f"{column['column']} ({description})" if description else column["column"])
        contenido = (
            f"Tabla {table}: {table_terms.get(table, '')}. "
            f"Columnas: {', '.join(column_texts)}."
        )
        fragments.append(
            Fragment(tipo="esquema", fuente=table_fragment_id(table), version=schema_version, contenido=contenido)
        )

    for model in metadata["models"]:
        table = model["table"]
        for relation in model["relations"]:
            if not relation["target_included"]:
                continue
            target = relation["target_table"]
            contenido = (
                f"Relación: {table}.{', '.join(relation['columns'])} referencia "
                f"{target}.{', '.join(relation['target_columns'])}. "
                f"Cada {table_terms.get(table, table).split(':')[0].split(',')[0]} se vincula con "
                f"{table_terms.get(target, target).split(':')[0].split(',')[0]}."
            )
            fragments.append(
                Fragment(
                    tipo="relacion",
                    fuente=relation_fragment_id(table, relation["columns"], target, relation["target_columns"]),
                    version=schema_version,
                    contenido=contenido,
                )
            )

    for rule in rules["rules"]:
        fragments.append(
            Fragment(tipo="regla", fuente=f"rule:{rule['id']}", version=rules["version"], contenido=rule["text"])
        )
    return fragments
