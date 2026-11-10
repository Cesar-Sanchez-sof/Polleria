from __future__ import annotations

import json
import unittest
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from eval.sql.evaluate_agents import (
    ANSI_BLUE,
    ANSI_CYAN,
    ANSI_GREEN,
    ANSI_PURPLE,
    ANSI_RED,
    ANSI_RESET,
    ANSI_YELLOW,
    canonical_rows,
    evaluate_agent,
    format_result_rows,
    normalize_sql,
    valid_efficiency_score,
    write_reports,
)


class EvaluationMetricTests(unittest.TestCase):
    def test_exact_match_normalizes_whitespace_and_trailing_semicolon(self) -> None:
        self.assertEqual(
            normalize_sql(" SELECT  a.id \nFROM public.account a; "),
            normalize_sql("SELECT a.id FROM public.account a"),
        )

    def test_execution_comparison_ignores_row_order_and_column_labels(self) -> None:
        generated = [{"generated_name": "A", "total": "1.00"}, {"generated_name": "B", "total": "2"}]
        gold = [{"name": "B", "sum": Decimal("2.0")}, {"name": "A", "sum": Decimal("1")}]

        self.assertEqual(canonical_rows(generated), canonical_rows(gold))

    def test_execution_comparison_preserves_duplicate_rows(self) -> None:
        self.assertNotEqual(
            canonical_rows([{"value": "A"}, {"value": "A"}]),
            canonical_rows([{"value": "A"}]),
        )

    def test_valid_efficiency_score_requires_correct_result_and_timing(self) -> None:
        self.assertEqual(valid_efficiency_score(4.0, 1.0, True), 1.0)
        self.assertEqual(valid_efficiency_score(1.0, 4.0, True), 0.5)
        self.assertEqual(valid_efficiency_score(1.0, 4.0, False), 0.0)
        self.assertEqual(valid_efficiency_score(1.0, 0.0, False), 0.0)
        self.assertIsNone(valid_efficiency_score(None, 1.0, True))

    def test_evaluate_agent_scores_and_displays_both_queries_without_network(self) -> None:
        expected_sql = "SELECT 1 AS total"
        answer = SimpleNamespace(
            sql=expected_sql,
            columnas=["total"],
            filas=[["1"]],
        )
        agent = SimpleNamespace(
            last_sql_execution_seconds=0.000001,
            last_token_usage={"total_tokens": 12, "prompt_tokens": 10, "completion_tokens": 2},
            permitted_tables=lambda *_: set(),
            build_prompt=lambda *_: "",
            answer=lambda *_: answer,
        )
        builder = lambda **_: agent
        validator = SimpleNamespace(
            validate=lambda sql, _: SimpleNamespace(
                approved=True,
                normalized_sql=sql,
                reasons=[],
            )
        )
        executor = SimpleNamespace(
            execute_authorized=lambda *_: [{"gold_total": Decimal("1.0")}],
        )
        settings = SimpleNamespace(api_key="test-key", readonly_dsn="test-dsn")

        with patch("eval.sql.evaluate_agents._build_gold_executor", return_value=(validator, executor)):
            with patch("builtins.print") as print_mock:
                result = evaluate_agent(
                    "gemini",
                    builder,
                    settings,
                    [{"id": "test-1", "question": "count", "expected_sql": expected_sql}],
                )

        case_result = result["cases"][0]
        self.assertTrue(case_result["exact_match"])
        self.assertTrue(case_result["execution_accuracy"])
        self.assertEqual(case_result["gold_rows"], [{"gold_total": Decimal("1.0")}])
        self.assertEqual(case_result["generated_rows"], [{"total": "1"}])
        self.assertEqual(case_result["ves"], 1.0)
        self.assertIsNone(result["test_suite_accuracy"])
        printed = "\n".join(str(call.args[0]) for call in print_mock.call_args_list)
        self.assertIn(f"SQL gold:\n{expected_sql}", printed)
        self.assertIn(f"SQL generada:\n{expected_sql}", printed)
        self.assertIn(f"{ANSI_PURPLE}  Respuesta SQL gold:\n", printed)
        self.assertIn('"gold_total": "1.0"', printed)
        self.assertIn(f"{ANSI_CYAN}  Respuesta SQL generada:\n", printed)
        self.assertIn('"total": "1"', printed)
        case_line = print_mock.call_args_list[0].args[0]
        self.assertIn(f"{ANSI_GREEN}EM=OK{ANSI_RESET}", case_line)
        self.assertIn(f"{ANSI_GREEN}EX=OK{ANSI_RESET}", case_line)
        self.assertIn(f"{ANSI_BLUE}tiempo=", case_line)

    def test_groq_tag_and_failed_metrics_use_requested_colors(self) -> None:
        answer = SimpleNamespace(
            sql="SELECT 1 AS total",
            columnas=["total"],
            filas=[["1"]],
        )
        agent = SimpleNamespace(
            last_sql_execution_seconds=0.01,
            last_token_usage=None,
            permitted_tables=lambda *_: set(),
            build_prompt=lambda *_: "",
            answer=lambda *_: answer,
        )
        validator = SimpleNamespace(
            validate=lambda sql, _: SimpleNamespace(
                approved=True,
                normalized_sql=sql,
                reasons=[],
            )
        )
        executor = SimpleNamespace(execute_authorized=lambda *_: [{"gold_total": Decimal("2")}])
        settings = SimpleNamespace(api_key="test-key", readonly_dsn="test-dsn")

        with patch("eval.sql.evaluate_agents._build_gold_executor", return_value=(validator, executor)):
            with patch("builtins.print") as print_mock:
                evaluate_agent(
                    "groq",
                    lambda **_: agent,
                    settings,
                    [{"id": "test-1", "question": "count", "expected_sql": "SELECT 2"}],
                )

        case_line = print_mock.call_args_list[0].args[0]
        self.assertIn(f"{ANSI_YELLOW}[groq]{ANSI_RESET}", case_line)
        self.assertIn(f"{ANSI_RED}EM=X{ANSI_RESET}", case_line)
        self.assertIn(f"{ANSI_RED}EX=X{ANSI_RESET}", case_line)
        self.assertIn(f"{ANSI_BLUE}tiempo=", case_line)

    def test_format_result_rows_distinguishes_empty_from_unexecuted(self) -> None:
        self.assertEqual(format_result_rows([]), "[]")
        self.assertEqual(format_result_rows(None), "[NO EJECUTADA]")

    def test_write_reports_accumulates_cases_and_replaces_matching_ids(self) -> None:
        def result(case_id: str, generated_sql: str) -> dict:
            case = {
                "id": case_id,
                "expected_sql": f"SELECT {case_id}",
                "generated_sql": generated_sql,
                "gold_rows": [{"gold_total": Decimal("1.0")}],
                "generated_rows": [{"total": generated_sql}],
                "exact_match": False,
                "execution_succeeded": True,
                "execution_accuracy": True,
                "ves": 0.5,
                "elapsed_seconds": 1.0,
                "sql_execution_seconds": 0.5,
                "gold_execution_seconds": 0.5,
            }
            return {
                "agent": "gemini",
                "interrupted": False,
                "cases": [case],
            }

        with TemporaryDirectory() as temp_dir:
            reports_dir = Path(temp_dir) / "reports"
            results_dir = Path(temp_dir) / "results"
            initial_result = result("TEST-003", "SELECT 3")
            initial_result["cases"].append(result("TEST-001", "SELECT old")["cases"][0])
            initial_result["cases"].append(result("TEST-002", "SELECT 2")["cases"][0])
            write_reports(
                [initial_result],
                reports_dir,
                results_dir,
            )
            updated_result = result("TEST-001", "SELECT updated")
            updated_result["cases"].append(result("TEST-003", "SELECT 3")["cases"][0])
            markdown_paths, _ = write_reports([updated_result], reports_dir, results_dir)

            report = (reports_dir / "report_gemini.md").read_text(encoding="utf-8")
            cumulative = json.loads(
                (results_dir / "report_gemini.json").read_text(encoding="utf-8")
            )

        self.assertEqual(markdown_paths, [reports_dir / "report_gemini.md"])
        self.assertEqual(cumulative["total_cases"], 3)
        self.assertEqual(
            [case["id"] for case in cumulative["cases"]],
            ["TEST-001", "TEST-002", "TEST-003"],
        )
        self.assertEqual(cumulative["cases"][0]["generated_sql"], "SELECT updated")
        self.assertEqual(
            cumulative["cases"][0]["gold_rows"],
            [{"gold_total": "1.0"}],
        )
        self.assertEqual(report.count("<summary>TEST-001"), 1)
        self.assertIn("SELECT updated", report)
        self.assertIn('"gold_total": "1.0"', report)
        self.assertIn('"total": "SELECT updated"', report)
        self.assertIn("TEST-002", report)
        self.assertIn("TEST-003", report)
        self.assertLess(report.index("<summary>TEST-001"), report.index("<summary>TEST-002"))
        self.assertLess(report.index("<summary>TEST-002"), report.index("<summary>TEST-003"))


if __name__ == "__main__":
    unittest.main()
