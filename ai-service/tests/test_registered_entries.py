"""P-4: filtro determinista de asientos registrados (``journal_entry.status = TRUE``) sobre el AST."""

from __future__ import annotations

from pathlib import Path

import sqlglot
from sqlglot import exp

from guards import GuardedTestCase

from ai_service.policies.registered_entries import (
    RegisteredFilterError,
    apply_registered_entries_filter,
    has_registered_entries_filter,
)
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = SqlValidator(load_allowlist(ROOT / "knowledge" / "allowlist.readonly_erp.json"))
def saldo(where: str, *, entry: str = "je") -> str:
    """SQL de saldo con el alias de ``journal_entry`` indicado (``journal_entry`` = sin alias)."""
    entry_source = "journal_entry" if entry == "journal_entry" else f"journal_entry AS {entry}"
    return (
        "SELECT aa.code, SUM(jed.debit) AS total_debit FROM journal_entry_detail AS jed "
        "JOIN accounting_account AS aa ON aa.id = jed.account_id "
        f"JOIN {entry_source} ON {entry}.id = jed.entry_id WHERE {where} GROUP BY aa.code"
    )


def top_level_status(sql: str) -> list[str]:
    where = sqlglot.parse_one(sql, read="postgres").args["where"].this
    leaves = list(where.flatten()) if isinstance(where, exp.And) else [where]
    return [leaf.sql() for leaf in leaves if "status" in leaf.sql()]


class ApplyFilterTests(GuardedTestCase):
    def test_filter_is_added_with_the_alias_chosen_by_the_model(self) -> None:
        cases = {
            "alias-je": ("je", "je.status = TRUE"),
            "alias-e": ("e", "e.status = TRUE"),
            "sin-alias": ("journal_entry", "journal_entry.status = TRUE"),
        }
        for name, (alias, expected) in cases.items():
            with self.subTest(case=name):
                sql = saldo(f"aa.code = '101' AND {alias}.entry_date >= DATE '2026-09-01'", entry=alias)
                filtered = apply_registered_entries_filter(sql)
                self.assertEqual(top_level_status(filtered), [expected])
                self.assertTrue(has_registered_entries_filter(filtered))
                verdict = VALIDATOR.validate(filtered, "contador_demo")  # se vuelve a validar completo
                self.assertTrue(verdict.approved, verdict.reasons)
                self.assertTrue(has_registered_entries_filter(verdict.normalized_sql))

    def test_or_from_the_model_cannot_bypass_the_filter(self) -> None:
        sql = saldo("aa.code = '101' OR aa.code = '104'")
        filtered = apply_registered_entries_filter(sql)
        self.assertIn("(aa.code = '101' OR aa.code = '104') AND je.status = TRUE", filtered)

    def test_existing_registered_filter_is_kept_once(self) -> None:
        for predicate in ("je.status = TRUE", "TRUE = je.status"):
            with self.subTest(predicate=predicate):
                filtered = apply_registered_entries_filter(saldo(f"aa.code = '101' AND {predicate}"))
                self.assertEqual(filtered.count("status"), 1)

    def test_unguaranteed_filters_are_rejected(self) -> None:
        cases = {
            "anulados": saldo("je.status = FALSE"),
            "distinto": saldo("je.status <> TRUE"),
            "dentro-de-or": saldo("je.status = TRUE OR aa.code = '101'"),
            "negacion": saldo("NOT je.status"),
            "es-verdadero": saldo("je.status IS TRUE"),
            "sin-calificar": saldo("status = TRUE"),
            "en-la-proyeccion": saldo("aa.code = '101'").replace("SELECT aa.code,", "SELECT aa.code, je.status,"),
            "detalle-sin-asiento": "SELECT SUM(jed.debit) AS d FROM journal_entry_detail jed WHERE jed.account_id = 1",
            "subconsulta-sin-asiento": saldo("jed.account_id IN (SELECT d2.account_id FROM journal_entry_detail d2)"),
            "sin-tablas-contables": "SELECT aa.code FROM accounting_account aa",
            "no-es-consulta": "DELETE FROM journal_entry",
            "no-analizable": "SELECT (",
        }
        for name, sql in cases.items():
            with self.subTest(case=name), self.assertRaises(RegisteredFilterError):
                apply_registered_entries_filter(sql)

    def test_check_detects_missing_or_altered_filter(self) -> None:
        self.assertFalse(has_registered_entries_filter(saldo("aa.code = '101'")))
        self.assertFalse(has_registered_entries_filter(saldo("je.status = FALSE")))
        self.assertFalse(has_registered_entries_filter("SELECT SUM(jed.debit) FROM journal_entry_detail jed"))
        self.assertTrue(has_registered_entries_filter("SELECT aa.code FROM accounting_account aa"))  # no lee asientos
        self.assertTrue(has_registered_entries_filter(saldo("aa.code = '101' AND je.status = TRUE")))
