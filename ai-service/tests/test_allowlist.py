"""Pruebas de la allowlist de objetos por rol (T010)."""

from __future__ import annotations

import copy
import json
from pathlib import Path

from guards import GuardedTestCase

from ai_service.validation.allowlist import AllowlistError, load_allowlist, parse_allowlist

EXAMPLE = Path(__file__).resolve().parents[1] / "knowledge" / "allowlist.example.json"
BASE = json.loads(EXAMPLE.read_text(encoding="utf-8"))


def _with(mutator) -> dict:
    data = copy.deepcopy(BASE)
    mutator(data)
    return data


class ExampleAllowlistTests(GuardedTestCase):
    def test_example_loads(self) -> None:
        allowlist = load_allowlist(EXAMPLE)
        self.assertEqual(allowlist.schema, "ficticio")
        self.assertTrue(allowlist.has_role("contador_demo"))
        self.assertFalse(allowlist.has_role("admin"))

    def test_schema_for_role_only_contains_granted_columns(self) -> None:
        allowlist = load_allowlist(EXAMPLE)
        schema = allowlist.schema_for_role("lector_demo")
        self.assertEqual(schema, {"ficticio": {"cuenta_demo": {"codigo": "TEXT", "nombre": "TEXT"}}})
        self.assertEqual(allowlist.allowed_tables("lector_demo"), frozenset({"cuenta_demo"}))
        self.assertEqual(allowlist.allowed_tables("inexistente"), frozenset())

    def test_allowlist_is_immutable(self) -> None:
        allowlist = load_allowlist(EXAMPLE)
        with self.assertRaises(TypeError):
            allowlist.tables["nueva"] = {}  # type: ignore[index]


class RejectedAllowlistTests(GuardedTestCase):
    def assert_rejected(self, data: dict) -> None:
        with self.assertRaises(AllowlistError):
            parse_allowlist(data)

    def test_always_forbidden_tables(self) -> None:
        for table in ("usuario_demo", "audit_log", "user_sessions", "role_permission", "pg_shadow", "sesion"):
            with self.subTest(table=table):
                self.assert_rejected(_with(lambda d, t=table: d["tables"].update({t: {"id": "INT"}})))

    def test_credential_like_columns(self) -> None:
        for column in ("password_hash", "api_token", "clave", "secret"):
            with self.subTest(column=column):
                self.assert_rejected(
                    _with(lambda d, c=column: d["tables"]["cuenta_demo"].update({c: "TEXT"}))
                )

    def test_no_wildcards(self) -> None:
        self.assert_rejected(_with(lambda d: d["tables"].update({"*": {"id": "INT"}})))
        self.assert_rejected(_with(lambda d: d["roles"]["lector_demo"].update({"cuenta_demo": ["*"]})))

    def test_system_schema(self) -> None:
        for schema in ("pg_catalog", "information_schema"):
            with self.subTest(schema=schema):
                self.assert_rejected(_with(lambda d, s=schema: d.update({"schema": s})))

    def test_role_must_reference_declared_objects(self) -> None:
        self.assert_rejected(_with(lambda d: d["roles"]["lector_demo"].update({"otra_tabla": ["id"]})))
        self.assert_rejected(_with(lambda d: d["roles"]["lector_demo"].update({"cuenta_demo": ["no_existe"]})))
        self.assert_rejected(_with(lambda d: d["roles"].update({"vacio_demo": {}})))

    def test_unknown_keys_and_types(self) -> None:
        self.assert_rejected(_with(lambda d: d.update({"all_tables": True})))
        self.assert_rejected(_with(lambda d: d["tables"]["cuenta_demo"].update({"extra": "JSONB"})))
