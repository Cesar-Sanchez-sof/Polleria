"""Extracción de metadatos estructurales de ``prisma/schema.prisma`` (T030, RSK-09).

Lee el esquema **solo en lectura** y produce metadatos de los modelos contables seleccionados:
tabla, columnas (nombre en BD, tipo Prisma, tipo de BD, nulabilidad, clave primaria, unicidad) y
relaciones (columnas origen y destino). Registra el **SHA-256 del archivo** para detectar desfases
entre ramas (``main`` y ``develop`` divergen).

Deliberadamente **no** se extraen: valores por defecto, comentarios, registros ni nada de la base
de datos; tampoco columnas con aspecto de credencial. Los metadatos no son la lista de objetos
permitidos: los objetos reales autorizados siguen pendientes de P-14.

Uso (genera ``knowledge/erp_schema_metadata.json``)::

    python -m ai_service.knowledge.schema_metadata --schema ../prisma/schema.prisma \
        --out knowledge/erp_schema_metadata.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from ai_service.validation.allowlist import FORBIDDEN_COLUMN_WORDS

METADATA_VERSION = "erp-schema-metadata-v1"

# Modelos del módulo contable relevantes para el MVP (saldos, movimientos, períodos).
FINANCIAL_MODELS: tuple[str, ...] = (
    "AccountingAccount",
    "AccountingPeriod",
    "JournalEntry",
    "JournalEntryDetail",
)

SCALAR_TYPES = frozenset({"Int", "BigInt", "String", "Boolean", "DateTime", "Decimal", "Float", "Json", "Bytes"})

_BLOCK_RE = re.compile(r"^(model|enum)\s+(\w+)\s*\{(.*?)^\}", re.MULTILINE | re.DOTALL)
_FIELD_RE = re.compile(r"^\s*(\w+)\s+(\w+)(\[\])?(\?)?(.*)$")
_MAP_RE = re.compile(r"@map\(\s*\"([^\"]+)\"\s*\)")
_TABLE_MAP_RE = re.compile(r"@@map\(\s*\"([^\"]+)\"\s*\)")
_DB_TYPE_RE = re.compile(r"@db\.(\w+(?:\([^)]*\))?)")
_RELATION_RE = re.compile(r"@relation\(([^)]*)\)")  # sus argumentos usan [], nunca ")"
_LIST_ARG_RE = re.compile(r"(fields|references)\s*:\s*\[([^\]]*)\]")


class SchemaParseError(ValueError):
    """El esquema no tiene la forma esperada."""


@dataclass
class _Field:
    name: str
    type: str
    is_list: bool
    optional: bool
    attributes: str


@dataclass
class _Model:
    name: str
    table: str
    fields: list[_Field] = field(default_factory=list)


def schema_sha256(text: str) -> str:
    """SHA-256 del contenido del esquema (con saltos de línea normalizados a ``\\n``)."""
    return hashlib.sha256(text.replace("\r\n", "\n").encode("utf-8")).hexdigest()


def _strip_comment(line: str) -> str:
    in_string = False
    for index, char in enumerate(line):
        if char == '"':
            in_string = not in_string
        elif not in_string and line.startswith("//", index):
            return line[:index]
    return line


def _parse_blocks(text: str) -> tuple[dict[str, _Model], dict[str, list[str]]]:
    models: dict[str, _Model] = {}
    enums: dict[str, list[str]] = {}
    for kind, name, body in _BLOCK_RE.findall(text.replace("\r\n", "\n")):
        lines = [_strip_comment(line).strip() for line in body.splitlines()]
        lines = [line for line in lines if line]
        if kind == "enum":
            enums[name] = [line.split()[0] for line in lines if not line.startswith("@@")]
            continue
        table_match = next((_TABLE_MAP_RE.search(line) for line in lines if line.startswith("@@map")), None)
        model = _Model(name=name, table=table_match.group(1) if table_match else name)
        for line in lines:
            if line.startswith("@@"):
                continue
            match = _FIELD_RE.match(line)
            if not match:
                raise SchemaParseError(f"Línea de campo no reconocida en el modelo {name}.")
            field_name, field_type, is_list, optional, attributes = match.groups()
            model.fields.append(_Field(field_name, field_type, bool(is_list), bool(optional), attributes))
        models[name] = model
    return models, enums


def _column_name(f: _Field) -> str:
    match = _MAP_RE.search(f.attributes)
    return match.group(1) if match else f.name


def _is_sensitive(column: str) -> bool:
    return bool(set(column.lower().split("_")) & FORBIDDEN_COLUMN_WORDS)


def extract_metadata(text: str, models: tuple[str, ...] = FINANCIAL_MODELS, source: str = "prisma/schema.prisma") -> dict:
    """Metadatos estructurales de ``models`` (solo estructura; sin valores ni comentarios)."""
    parsed, enums = _parse_blocks(text)
    missing = [m for m in models if m not in parsed]
    if missing:
        raise SchemaParseError(f"Modelos no encontrados en el esquema: {missing}.")

    columns_by_model = {
        name: {f.name: _column_name(f) for f in model.fields} for name, model in parsed.items()
    }
    used_enums: set[str] = set()
    result_models = []
    for name in models:
        model = parsed[name]
        columns = []
        relations = []
        for f in model.fields:
            if f.type in SCALAR_TYPES or f.type in enums:
                column = _column_name(f)
                if _is_sensitive(column):
                    continue
                if f.type in enums:
                    used_enums.add(f.type)
                db_type = _DB_TYPE_RE.search(f.attributes)
                columns.append(
                    {
                        "field": f.name,
                        "column": column,
                        "type": f.type,
                        "db_type": db_type.group(1) if db_type else None,
                        "nullable": f.optional,
                        "primary_key": "@id" in f.attributes.split(),
                        "unique": "@unique" in f.attributes.split(),
                    }
                )
                continue
            if f.type not in parsed or f.is_list:
                continue  # lado "muchos" de la relación: se registra desde el modelo que tiene la FK
            relation = _RELATION_RE.search(f.attributes)
            args = dict(_LIST_ARG_RE.findall(relation.group(1))) if relation else {}
            if "fields" not in args:
                continue
            source_fields = [x.strip() for x in args["fields"].split(",") if x.strip()]
            target_fields = [x.strip() for x in args.get("references", "").split(",") if x.strip()]
            relations.append(
                {
                    "field": f.name,
                    "target_model": f.type,
                    "target_table": parsed[f.type].table,
                    "columns": [columns_by_model[name][x] for x in source_fields],
                    "target_columns": [columns_by_model[f.type][x] for x in target_fields],
                    "target_included": f.type in models,
                }
            )
        result_models.append({"model": name, "table": model.table, "columns": columns, "relations": relations})

    return {
        "version": METADATA_VERSION,
        "source": source,
        "schema_sha256": schema_sha256(text),
        "models": result_models,
        "enums": {name: enums[name] for name in sorted(used_enums)},
        "notes": [
            "Solo estructura: sin valores por defecto, comentarios, registros ni credenciales.",
            "No es la lista de objetos permitidos del asistente (P-14 pendiente).",
            "El significado contable de journal_entry.status (anulados) está pendiente (P-4).",
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Extrae metadatos estructurales del esquema Prisma.")
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)
    text = args.schema.read_text(encoding="utf-8")
    metadata = extract_metadata(text)
    args.out.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
