"""Selector ``AI_SQL_GENERATOR`` y configuración del canal hacia XiYanSQL (Fase 1)."""

from __future__ import annotations

import secrets

from guards import GuardedTestCase
from sqlgen_support import xiyan_env

from ai_service.audit.masking import HMAC_KEY_ENV_VAR
from ai_service.config.settings import (
    ENV_VAR,
    PORT_VAR,
    SQL_GENERATOR_VAR,
    SQLGEN_ADAPTER_VAR,
    SQLGEN_TIMEOUT_VAR,
    SQLGEN_TOKEN_VAR,
    SQLGEN_URL_VAR,
    TOKEN_VAR,
    ServiceConfigError,
    load_service_settings,
)


class SelectorTests(GuardedTestCase):
    def test_default_is_simulated(self) -> None:
        env = {ENV_VAR: "development", TOKEN_VAR: secrets.token_hex(32), HMAC_KEY_ENV_VAR: secrets.token_hex(32)}
        settings = load_service_settings(env)
        self.assertEqual((settings.sql_generator, settings.sqlgen), ("simulado", None))

    def test_simulated_ignores_sqlgen_variables(self) -> None:
        settings = load_service_settings(xiyan_env(**{SQL_GENERATOR_VAR: "simulado", SQLGEN_URL_VAR: "http://0.0.0.0:1"}))
        self.assertIsNone(settings.sqlgen)

    def test_unknown_generator_is_rejected(self) -> None:
        for value in ("XiYanSQL", "xiyan", "real", "auto"):
            with self.subTest(value=value), self.assertRaises(ServiceConfigError):
                load_service_settings(xiyan_env(**{SQL_GENERATOR_VAR: value}))

    def test_valid_xiyan_configuration(self) -> None:
        env = xiyan_env(**{SQLGEN_TIMEOUT_VAR: "90", SQLGEN_ADAPTER_VAR: "xiyansql_v171_json_v10_semantic_full"})
        sqlgen = load_service_settings(env).sqlgen
        self.assertEqual(
            (sqlgen.url, sqlgen.timeout_s, sqlgen.adapter, sqlgen.max_new_tokens),
            ("http://127.0.0.1:8011", 90.0, "xiyansql_v171_json_v10_semantic_full", 256),
        )
        self.assertEqual(load_service_settings(xiyan_env()).sqlgen.adapter, "xiyansql_v17_json_v10_balanced_full")
        for text in (repr(sqlgen), repr(load_service_settings(env))):
            self.assertNotIn(env[SQLGEN_TOKEN_VAR], text)


class XiYanConfigRejectionTests(GuardedTestCase):
    def assert_rejected(self, **overrides: str) -> None:
        env = xiyan_env(**overrides)
        with self.assertRaises(ServiceConfigError) as ctx:
            load_service_settings(env)
        for name in (SQLGEN_TOKEN_VAR, TOKEN_VAR):
            if env.get(name):
                self.assertNotIn(env[name], str(ctx.exception))

    def test_url_must_be_exact_loopback(self) -> None:
        for url in (
            "",
            "http://localhost:8011",
            "http://0.0.0.0:8011",
            "https://127.0.0.1:8011",
            "http://127.0.0.1",
            "http://127.0.0.1:8011/",
            "http://127.0.0.1:8011/v1",
            "http://user:pw@127.0.0.1:8011",
            "http://127.0.0.1:80",
            "http://127.0.0.1:70000",
            "http://172.20.0.2:8011",
        ):
            with self.subTest(url=url):
                self.assert_rejected(**{SQLGEN_URL_VAR: url})

    def test_url_cannot_reuse_the_api_port(self) -> None:
        self.assert_rejected(**{SQLGEN_URL_VAR: "http://127.0.0.1:8001", PORT_VAR: "8001"})

    def test_token_rules(self) -> None:
        shared = secrets.token_hex(32)
        cases = {
            "vacio": {SQLGEN_TOKEN_VAR: ""},
            "corto": {SQLGEN_TOKEN_VAR: secrets.token_hex(16)},
            "no-hex": {SQLGEN_TOKEN_VAR: "zz" * 32},
            "igual-al-token-api": {SQLGEN_TOKEN_VAR: shared, TOKEN_VAR: shared},
            "igual-a-hmac": {SQLGEN_TOKEN_VAR: shared, HMAC_KEY_ENV_VAR: shared},
        }
        for name, overrides in cases.items():
            with self.subTest(case=name):
                self.assert_rejected(**overrides)

    def test_timeout_and_adapter(self) -> None:
        for timeout in ("0", "301", "1.5", "abc"):
            with self.subTest(timeout=timeout):
                self.assert_rejected(**{SQLGEN_TIMEOUT_VAR: timeout})
        for adapter in ("xiyansql_smoke_v1", "../xiyansql_v17_json_v10_balanced_full", "otro"):
            with self.subTest(adapter=adapter):
                self.assert_rejected(**{SQLGEN_ADAPTER_VAR: adapter})
