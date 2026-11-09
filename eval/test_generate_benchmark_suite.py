from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE_SRC = ROOT / "agents-service" / "src"
if str(SERVICE_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICE_SRC))

from agents_service.agent_sql.agent import AGENT_TABLES, SYSTEM_PROMPT
from agents_service.validation.allowlist import load_allowlist
from eval.generate_benchmark_suite import (
    generate_350_test_suite,
    suite_document,
    validate_cases,
)


class BenchmarkSuiteTests(unittest.TestCase):
    def test_generated_cases_match_the_authorized_role_and_sql_validator(self) -> None:
        cases = generate_350_test_suite(date(2026, 11, 8))

        self.assertEqual(len(cases), 350)
        self.assertEqual(len({case["pregunta"] for case in cases}), 350)
        validate_cases(cases)

    def test_suite_is_balanced_across_supported_modules(self) -> None:
        document = suite_document(generate_350_test_suite(date(2026, 11, 8)))

        self.assertEqual(
            document["distribucion_modulo"],
            {
                "ventas": 70,
                "compras": 70,
                "caja": 70,
                "inventario": 70,
                "contabilidad": 70,
            },
        )

    def test_agent_scope_and_prompt_include_authorized_non_accounting_modules(self) -> None:
        allowlist = load_allowlist(
            ROOT / "agents-service" / "knowledge" / "allowlist.readonly_erp.json"
        )

        self.assertEqual(AGENT_TABLES, frozenset(allowlist.roles["contador_demo"]))
        self.assertIn("No rechaces preguntas de ventas o inventario", SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
