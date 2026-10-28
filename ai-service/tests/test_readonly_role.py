"""El SQL del rol de solo lectura concede únicamente SELECT por columna de la allowlist."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

from ai_service.execution.readonly_role import ROLE_NAME, build_role_sql, granted_columns
from ai_service.validation.allowlist import load_allowlist

ROOT = Path(__file__).resolve().parents[1]
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.readonly_erp.json")
SQL = build_role_sql(ALLOWLIST)


class ReadonlyRoleSqlTests(unittest.TestCase):
    def test_role_has_no_dangerous_attributes_and_no_password_in_file(self) -> None:
        for attribute in ("NOSUPERUSER", "NOCREATEDB", "NOCREATEROLE", "NOREPLICATION", "NOBYPASSRLS"):
            self.assertIn(attribute, SQL)
        self.assertIn(":'ai_password'", SQL)
        self.assertNotRegex(SQL, r"PASSWORD\s+'")

    def test_only_select_is_ever_granted_and_never_with_grant_option(self) -> None:
        grants = [line for line in SQL.splitlines() if line.startswith("GRANT")]
        self.assertTrue(grants)
        for line in grants:
            self.assertRegex(line, r"^GRANT (SELECT \(|USAGE ON SCHEMA )")
            self.assertNotIn("WITH GRANT OPTION", line)
        self.assertNotRegex(SQL, r"(?i)GRANT[^;]*\b(INSERT|UPDATE|DELETE|TRUNCATE|ALL PRIVILEGES|CREATE)\b")

    def test_column_grants_match_the_allowlist_exactly(self) -> None:
        expected = granted_columns(ALLOWLIST)
        pattern = r"GRANT SELECT \(([^)]*)\) ON public\.(\w+) TO " + ROLE_NAME
        found = {m.group(2): tuple(c.strip() for c in m.group(1).split(",")) for m in re.finditer(pattern, SQL)}
        self.assertEqual(found, expected)

    def test_session_defaults_force_read_only(self) -> None:
        self.assertIn(f"ALTER ROLE {ROLE_NAME} SET default_transaction_read_only = on;", SQL)
        self.assertIn(f"ALTER ROLE {ROLE_NAME} SET statement_timeout = '5s';", SQL)


if __name__ == "__main__":
    unittest.main()
