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

import hashlib
import json
from pathlib import Path

from ai_service.orchestrator.ports import Fragment


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def table_fragment_id(table: str) -> str:
    return f"schema:table:{table}"


def relation_fragment_id(table: str, columns: list[str], target: str, target_columns: list[str]) -> str:
    return f"schema:relation:{table}.{','.join(columns)}->{target}.{','.join(target_columns)}"


def build_corpus(
    metadata: dict,
    glossary: dict,
    rules: dict,
    metrics: dict | None = None,
    examples: dict | None = None,
) -> list[Fragment]:
    """Fragmentos deterministas (mismo orden y contenido para las mismas entradas).

    ``metrics`` (``metric:<id>``) y ``examples`` (``example:<id>``, SQL sintético con parámetros) son
    opcionales para mantener intacto el corpus que referencia el conjunto Gold.
    """
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
            Fragment(
                tipo="regla", fuente=f"rule:{rule['id']}", version=rules["version"], contenido=rule["text"],
                evidencia_modelo=rule.get("model_evidence"),
            )
        )
    for metric in (metrics or {}).get("metrics", []):
        fragments.append(
            Fragment(
                tipo="metrica", fuente=f"metric:{metric['id']}", version=metrics["version"],  # type: ignore[index]
                contenido=metric["text"], evidencia_modelo=metric.get("model_evidence"),
            )
        )
    for example in (examples or {}).get("examples", []):
        fragments.append(
            Fragment(
                tipo="ejemplo",
                fuente=f"example:{example['id']}",
                version=examples["version"],  # type: ignore[index]
                contenido=f"Pregunta: {example['question']} SQL: {example['sql']}",
            )
        )
    return fragments


def corpus_fingerprint(fragments: list[Fragment]) -> str:
    """Huella SHA-256 del corpus exacto (tipo, fuente, versión y contenido de cada fragmento).

    Es lo que se aprueba antes de enviar el corpus a un índice remoto: cualquier cambio de texto
    produce otra huella y vuelve a requerir aprobación.
    """
    canonical = json.dumps(
        sorted([f.tipo, f.fuente, f.version, f.contenido] for f in fragments), ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
