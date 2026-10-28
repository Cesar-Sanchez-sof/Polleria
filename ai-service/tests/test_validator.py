"""Pruebas del SQL Validator (T011–T013). Nunca se ejecuta SQL contra PostgreSQL."""

from __future__ import annotations

import json
from pathlib import Path

from guards import GuardedTestCase

import sqlglot
from sqlglot import exp

from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import (
    DEFAULT_LIMITS,
    EMPTY,
    LIMIT_EXCEEDED,
    TOO_LONG,
    WRITE_NODES,
    SqlValidator,
    ValidatorLimits,
)

ROOT = Path(__file__).resolve().parents[1]
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.example.json")
CASES = json.loads((Path(__file__).resolve().parent / "fixtures" / "sql_cases.json").read_text(encoding="utf-8"))
DEFAULT_ROLE = CASES["default_role"]


def _role(case: dict) -> str:
    return case.get("role", DEFAULT_ROLE)


class FixtureCasesTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.validator = SqlValidator(ALLOWLIST)

    def test_valid_cases_are_approved(self) -> None:
        for case in CASES["valid"]:
            with self.subTest(case=case["id"]):
                verdict = self.validator.validate(case["sql"], _role(case))
                self.assertTrue(verdict.approved, verdict.reasons)
                self.assertEqual(verdict.reasons, ())
                self.assertIsNotNone(verdict.normalized_sql)

    def test_invalid_and_adversarial_cases_are_rejected(self) -> None:
        for group in ("invalid", "adversarial"):
            for case in CASES[group]:
                with self.subTest(group=group, case=case["id"]):
                    verdict = self.validator.validate(case["sql"], _role(case))
                    self.assertFalse(verdict.approved, f"aceptada indebidamente: {case['sql']}")
                    self.assertIn(case["reason"], verdict.reasons)
                    self.assertIsNone(verdict.normalized_sql)

    def test_no_forbidden_case_is_accepted(self) -> None:
        forbidden = CASES["invalid"] + CASES["adversarial"]
        accepted = [c["id"] for c in forbidden if self.validator.validate(c["sql"], _role(c)).approved]
        self.assertEqual(accepted, [])
        self.assertGreaterEqual(len(forbidden), 60)


class ApprovedSqlPropertiesTests(GuardedTestCase):
    """Propiedades del SQL que se entregaría al Executor."""

    def setUp(self) -> None:
        super().setUp()
        self.validator = SqlValidator(ALLOWLIST)
        self.approved = [
            (case, self.validator.validate(case["sql"], _role(case))) for case in CASES["valid"]
        ]

    def test_regenerated_sql_is_single_select_without_writes(self) -> None:
        for case, verdict in self.approved:
            with self.subTest(case=case["id"]):
                statements = sqlglot.parse(verdict.normalized_sql, read="postgres")
                self.assertEqual(len(statements), 1)
                root = statements[0]
                self.assertIsInstance(root, exp.Select)
                self.assertFalse(any(isinstance(n, WRITE_NODES) for n in root.walk()))

    def test_regenerated_sql_has_bounded_limit(self) -> None:
        for case, verdict in self.approved:
            with self.subTest(case=case["id"]):
                root = sqlglot.parse_one(verdict.normalized_sql, read="postgres")
                limit = root.args.get("limit")
                self.assertIsNotNone(limit)
                self.assertLessEqual(int(limit.expression.this), DEFAULT_LIMITS.max_limit)

    def test_regenerated_sql_is_stable(self) -> None:
        for case, verdict in self.approved:
            with self.subTest(case=case["id"]):
                again = self.validator.validate(verdict.normalized_sql, _role(case))
                self.assertTrue(again.approved, again.reasons)
                self.assertEqual(again.normalized_sql, verdict.normalized_sql)

    def test_tables_are_within_role_allowlist(self) -> None:
        for case, verdict in self.approved:
            with self.subTest(case=case["id"]):
                allowed = {f"{ALLOWLIST.schema}.{t}" for t in ALLOWLIST.allowed_tables(_role(case))}
                self.assertTrue(verdict.tables <= allowed)

    def test_missing_limit_is_added(self) -> None:
        verdict = self.validator.validate("SELECT codigo FROM cuenta_demo", DEFAULT_ROLE)
        self.assertTrue(verdict.normalized_sql.endswith(f"LIMIT {DEFAULT_LIMITS.max_limit}"))


class LimitsTests(GuardedTestCase):
    def test_custom_limits(self) -> None:
        validator = SqlValidator(ALLOWLIST, ValidatorLimits(max_limit=10))
        verdict = validator.validate("SELECT codigo FROM cuenta_demo LIMIT 11", DEFAULT_ROLE)
        self.assertIn(LIMIT_EXCEEDED, verdict.reasons)

    def test_too_long(self) -> None:
        validator = SqlValidator(ALLOWLIST, ValidatorLimits(max_sql_chars=20))
        verdict = validator.validate("SELECT codigo FROM cuenta_demo", DEFAULT_ROLE)
        self.assertEqual(verdict.reasons, (TOO_LONG,))

    def test_non_string_input(self) -> None:
        verdict = SqlValidator(ALLOWLIST).validate(None, DEFAULT_ROLE)  # type: ignore[arg-type]
        self.assertEqual(verdict.reasons, (EMPTY,))


class CartesianJoinTests(GuardedTestCase):
    """Los JOIN deben relacionar tablas por columnas; el producto cartesiano se rechaza."""

    def _table_and_column(self) -> tuple[str, str]:
        table = next(iter(ALLOWLIST.allowed_tables(DEFAULT_ROLE)))
        return table, next(iter(ALLOWLIST.schema_for_role(DEFAULT_ROLE)[ALLOWLIST.schema][table]))

    def test_cartesian_joins_are_rejected(self) -> None:
        validator = SqlValidator(ALLOWLIST)
        table, column = self._table_and_column()
        for join in ("JOIN {t} b ON TRUE", "JOIN {t} b ON 1 = 1", "CROSS JOIN {t} b", ", {t} b"):
            sql = f"SELECT a.{column} FROM {table} a {join.format(t=table)}"
            self.assertFalse(validator.validate(sql, DEFAULT_ROLE).approved, sql)

    def test_join_on_columns_is_still_allowed(self) -> None:
        validator = SqlValidator(ALLOWLIST)
        table, column = self._table_and_column()
        sql = f"SELECT a.{column} FROM {table} a JOIN {table} b ON a.{column} = b.{column}"
        self.assertTrue(validator.validate(sql, DEFAULT_ROLE).approved)
