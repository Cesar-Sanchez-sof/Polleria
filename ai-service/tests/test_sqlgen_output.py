"""``OutputParser``: una única sentencia SQL o rechazo (Fase 1). Sin red ni modelos."""

from __future__ import annotations

from guards import GuardedTestCase

from ai_service.orchestrator.model_calls import ModelUnavailable
from ai_service.orchestrator.ports import InvalidGeneratorOutput
from ai_service.sqlgen.output_parser import InvalidModelOutput, parse_sql_output

SQL = "SELECT aa.code FROM accounting_account aa WHERE aa.code = '101'"


class OutputParserTests(GuardedTestCase):
    def test_accepted_forms(self) -> None:
        cases = {
            "formato-entrenado": SQL + ";",
            "sin-punto-y-coma": SQL,
            "espacios": f"  \n{SQL};\n ",
            "cierre-de-cerco": f"{SQL};\n```",
            "cerco-sql": f"```sql\n{SQL};\n```",
            "cerco-simple": f"```\n{SQL}\n```\n",
            "cte": "WITH t AS (SELECT 1 AS x) SELECT x FROM t;",
            "punto-y-coma-en-literal": "SELECT aa.code FROM accounting_account aa WHERE aa.name = 'a;b';",
        }
        expected = {"cte": "WITH t AS (SELECT 1 AS x) SELECT x FROM t",
                    "punto-y-coma-en-literal": "SELECT aa.code FROM accounting_account aa WHERE aa.name = 'a;b'"}
        for name, text in cases.items():
            with self.subTest(case=name):
                self.assertEqual(parse_sql_output(text, "stop"), expected.get(name, SQL))

    def test_rejected_outputs(self) -> None:
        cases = {
            "TRUNCATED_OUTPUT": (SQL, "length"),
            "EMPTY_OUTPUT": ("   \n", "stop"),
            "EMPTY_OUTPUT-cerco": ("```sql\n```", "stop"),
            "AMBIGUOUS_OUTPUT": (f"{SQL};\n```\nEsta consulta suma los movimientos.", "stop"),
            "NOT_A_QUERY-prosa": (f"La consulta es: {SQL}", "stop"),
            "NOT_A_QUERY-dml": ("DELETE FROM journal_entry;", "stop"),
            "NOT_A_QUERY-explain": (f"EXPLAIN {SQL}", "stop"),
            "MULTIPLE_STATEMENTS": (f"{SQL}; DROP TABLE journal_entry;", "stop"),
            "MULTIPLE_STATEMENTS-doble": (f"{SQL};;", "stop"),
            "SPECIAL_TOKENS": (f"{SQL};<|im_end|>", "stop"),
            "OUTPUT_TOO_LONG": ("SELECT " + "x, " * 2000 + "y", "stop"),
            "UNPARSEABLE_OUTPUT": ("SELECT 'sin cerrar", "stop"),
        }
        for name, (text, finish) in cases.items():
            with self.subTest(case=name):
                with self.assertRaises(InvalidModelOutput) as ctx:
                    parse_sql_output(text, finish)
                self.assertEqual(ctx.exception.code, name.split("-")[0])
                # Formato inválido del modelo: no es indisponibilidad del servicio.
                self.assertIsInstance(ctx.exception, InvalidGeneratorOutput)
                self.assertNotIsInstance(ctx.exception, ModelUnavailable)
                self.assertEqual((ctx.exception.category, ctx.exception.transient), ("SQLGEN_INVALID_OUTPUT", False))
                self.assertNotIn("journal_entry", str(ctx.exception))  # sin la salida en el error
