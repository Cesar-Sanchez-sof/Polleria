"""Pruebas de la configuración segura del servicio de desarrollo y de su arranque (T026)."""

from __future__ import annotations

import io
import os
import secrets
from contextlib import redirect_stderr
from unittest import mock

from guards import GuardedTestCase

from ai_service.audit.masking import HMAC_KEY_ENV_VAR
from ai_service.config import settings as settings_module
from ai_service.config.settings import (
    ENV_VAR,
    HOST_VAR,
    PORT_VAR,
    TOKEN_VAR,
    ServiceConfigError,
    load_service_settings,
)


def valid_env(**overrides: str) -> dict[str, str]:
    env = {ENV_VAR: "development", TOKEN_VAR: secrets.token_hex(32), HMAC_KEY_ENV_VAR: secrets.token_hex(32)}
    env.update(overrides)
    return env


class LoadSettingsTests(GuardedTestCase):
    def test_valid_development_configuration(self) -> None:
        env = valid_env()
        settings = load_service_settings(env)
        self.assertEqual((settings.environment, settings.host, settings.port), ("development", "127.0.0.1", 8001))
        self.assertNotIn(env[TOKEN_VAR], repr(settings))
        self.assertNotIn(env[HMAC_KEY_ENV_VAR], repr(settings))

    def test_only_development_is_accepted(self) -> None:
        for value in ("", "production", "staging", "Development", "dev"):
            with self.subTest(value=value), self.assertRaises(ServiceConfigError):
                load_service_settings(valid_env(**{ENV_VAR: value}))
        with self.assertRaises(ServiceConfigError):
            load_service_settings({k: v for k, v in valid_env().items() if k != ENV_VAR})

    def test_only_127_0_0_1_is_accepted(self) -> None:
        for host in ("0.0.0.0", "localhost", "::1", "192.168.1.10", "::"):
            with self.subTest(host=host), self.assertRaises(ServiceConfigError):
                load_service_settings(valid_env(**{HOST_VAR: host}))

    def test_port_validation(self) -> None:
        for port in ("80", "70000", "abc", "-1"):
            with self.subTest(port=port), self.assertRaises(ServiceConfigError):
                load_service_settings(valid_env(**{PORT_VAR: port}))
        self.assertEqual(load_service_settings(valid_env(**{PORT_VAR: "9100"})).port, 9100)

    def test_internal_token_is_mandatory_and_strong(self) -> None:
        for token in ("", "   ", secrets.token_hex(16), "zz" * 32):
            with self.subTest(length=len(token)), self.assertRaises(ServiceConfigError):
                load_service_settings(valid_env(**{TOKEN_VAR: token}))

    def test_audit_key_is_mandatory_and_independent_from_token(self) -> None:
        with self.assertRaises(ServiceConfigError):
            load_service_settings({k: v for k, v in valid_env().items() if k != HMAC_KEY_ENV_VAR})
        shared = secrets.token_hex(32)
        with self.assertRaises(ServiceConfigError):
            load_service_settings(valid_env(**{TOKEN_VAR: shared, HMAC_KEY_ENV_VAR: shared}))

    def test_errors_never_include_secret_values(self) -> None:
        token = secrets.token_hex(16)  # demasiado corto → error
        with self.assertRaises(ServiceConfigError) as ctx:
            load_service_settings(valid_env(**{TOKEN_VAR: token}))
        self.assertNotIn(token, str(ctx.exception))

    def test_token_comparison_is_constant_time_and_exact(self) -> None:
        env = valid_env()
        settings = load_service_settings(env)
        with mock.patch.object(settings_module.hmac, "compare_digest", wraps=settings_module.hmac.compare_digest) as spy:
            self.assertTrue(settings.token_matches(env[TOKEN_VAR]))
            self.assertTrue(spy.called)
        self.assertFalse(settings.token_matches(None))
        self.assertFalse(settings.token_matches(""))
        self.assertFalse(settings.token_matches(env[TOKEN_VAR][:-1]))
        self.assertFalse(settings.token_matches(secrets.token_hex(32)))

    def test_reads_only_its_own_variables_from_the_process_environment(self) -> None:
        for name, value in valid_env().items():
            os.environ[name] = value
        settings = load_service_settings(os.environ)  # las barreras fallarían si leyera DATABASE_URL*
        self.assertEqual(settings.environment, "development")


class MainStartupTests(GuardedTestCase):
    """``main()`` nunca levanta un servidor real en estas pruebas (``uvicorn.run`` simulado)."""

    def test_invalid_configuration_exits_without_listening(self) -> None:
        from ai_service import main as main_module

        os.environ[ENV_VAR] = "production"
        stderr = io.StringIO()
        with mock.patch("uvicorn.run") as run, redirect_stderr(stderr):
            self.assertEqual(main_module.main(), 2)
        run.assert_not_called()
        self.assertIn("Configuración inválida", stderr.getvalue())

    def test_valid_configuration_binds_only_to_loopback(self) -> None:
        from ai_service import main as main_module

        env = valid_env()
        for name, value in env.items():
            os.environ[name] = value
        with mock.patch("uvicorn.run") as run:
            self.assertEqual(main_module.main(), 0)
        kwargs = run.call_args.kwargs
        self.assertEqual(kwargs["host"], "127.0.0.1")
        self.assertFalse(kwargs["access_log"])
        self.assertFalse(kwargs["proxy_headers"])
        self.assertNotIn(env[TOKEN_VAR], repr(run.call_args))
