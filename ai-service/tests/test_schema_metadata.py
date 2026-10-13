"""Pruebas de la extracción de metadatos del esquema Prisma (T030)."""

from __future__ import annotations

import json
from pathlib import Path

from guards import GuardedTestCase

from ai_service.knowledge.schema_metadata import (
    FINANCIAL_MODELS,
    SchemaParseError,
    extract_metadata,
    schema_sha256,
)

ROOT = Path(__file__).resolve().parents[1]
REPO_SCHEMA = ROOT.parent / "prisma" / "schema.prisma"
COMMITTED = ROOT / "knowledge" / "erp_schema_metadata.json"

FICTITIOUS_SCHEMA = """
// Esquema FICTICIO de prueba
enum Estado {
  ACTIVO
  INACTIVO
}

model Cabecera {
  id        Int       @id @default(autoincrement())
  codigo    String    @unique @db.VarChar(10)
  estado    Estado    @default(ACTIVO)
  nota      String?   @default("valor por defecto") // comentario
  lineas    Linea[]
  @@map("cabecera")
}

model Linea {
  id            Int      @id
  cabeceraId    Int      @map("cabecera_id")
  monto         Decimal  @db.Decimal(12, 2)
  passwordHash  String   @map("password_hash")
  cabecera      Cabecera @relation(fields: [cabeceraId], references: [id], onDelete: Cascade)
  @@index([cabeceraId])
  @@map("linea")
}
"""


class ExtractionTests(GuardedTestCase):
    def test_structure_from_fictitious_schema(self) -> None:
        metadata = extract_metadata(FICTITIOUS_SCHEMA, models=("Cabecera", "Linea"))
        cabecera, linea = metadata["models"]
        self.assertEqual((cabecera["table"], linea["table"]), ("cabecera", "linea"))
        columns = {c["column"]: c for c in linea["columns"]}
        self.assertEqual(columns["cabecera_id"]["type"], "Int")
        self.assertEqual(columns["monto"]["db_type"], "Decimal(12, 2)")
        self.assertTrue({c["column"]: c for c in cabecera["columns"]}["codigo"]["unique"])
        self.assertTrue({c["column"]: c for c in cabecera["columns"]}["nota"]["nullable"])
        self.assertEqual(
            linea["relations"],
            [{
                "field": "cabecera", "target_model": "Cabecera", "target_table": "cabecera",
                "columns": ["cabecera_id"], "target_columns": ["id"], "target_included": True,
            }],
        )
        self.assertEqual(cabecera["relations"], [])  # el lado "muchos" no duplica la relación
        self.assertEqual(metadata["enums"], {"Estado": ["ACTIVO", "INACTIVO"]})

    def test_no_defaults_comments_or_credentials(self) -> None:
        # Solo la parte extraída del esquema (las notas fijas del documento mencionan "comentarios").
        metadata = extract_metadata(FICTITIOUS_SCHEMA, models=("Cabecera", "Linea"))
        dumped = json.dumps({"models": metadata["models"], "enums": metadata["enums"]}, ensure_ascii=False)
        for forbidden in ("valor por defecto", "comentario", "autoincrement", "password", '"default"'):
            self.assertNotIn(forbidden, dumped)

    def test_hash_is_stable_across_line_endings(self) -> None:
        self.assertEqual(schema_sha256(FICTITIOUS_SCHEMA), schema_sha256(FICTITIOUS_SCHEMA.replace("\n", "\r\n")))
        self.assertNotEqual(schema_sha256(FICTITIOUS_SCHEMA), schema_sha256(FICTITIOUS_SCHEMA + " "))

    def test_missing_model_is_an_error(self) -> None:
        with self.assertRaises(SchemaParseError):
            extract_metadata(FICTITIOUS_SCHEMA, models=("NoExiste",))


class RepositorySchemaTests(GuardedTestCase):
    """Lectura del esquema real del ERP (solo lectura; nunca se modifica)."""

    def test_committed_metadata_matches_current_schema(self) -> None:
        current = extract_metadata(REPO_SCHEMA.read_text(encoding="utf-8"))
        committed = json.loads(COMMITTED.read_text(encoding="utf-8"))
        self.assertEqual(
            committed, current,
            "knowledge/erp_schema_metadata.json está desactualizado respecto de prisma/schema.prisma; "
            "regenerarlo con python -m ai_service.knowledge.schema_metadata.",
        )

    def test_only_financial_models_without_sensitive_columns(self) -> None:
        committed = json.loads(COMMITTED.read_text(encoding="utf-8"))
        self.assertEqual(tuple(m["model"] for m in committed["models"]), FINANCIAL_MODELS)
        self.assertEqual(
            {m["table"] for m in committed["models"]},
            {"accounting_account", "accounting_period", "journal_entry", "journal_entry_detail"},
        )
        columns = [c["column"].lower() for m in committed["models"] for c in m["columns"]]
        for column in columns:
            for word in ("password", "token", "secret", "hash", "clave"):
                self.assertNotIn(word, column)
        # Las tablas externas (p. ej. usuarios) solo aparecen como destino de relaciones, sin columnas.
        external = {r["target_table"] for m in committed["models"] for r in m["relations"] if not r["target_included"]}
        self.assertFalse(external & {m["table"] for m in committed["models"]})
        self.assertEqual(len(committed["schema_sha256"]), 64)
