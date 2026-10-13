"""Configuración de la base de datos de **pruebas** con fallo seguro (T006, NFR-011, SC-014).

Este módulo **nunca abre conexiones** y no importa ningún controlador de base de datos. Solo
valida una URL de pruebas declarada explícitamente y devuelve una configuración inmutable, o
lanza :class:`UnsafeDatabaseConfig` sin conectarse.

Reglas (la configuración se rechaza si se incumple cualquiera):

1. Solo se lee la variable propia de pruebas (:data:`TEST_DATABASE_ENV_VAR`, nombre PROPUESTO).
   Nunca se leen ``DATABASE_URL`` ni ``DATABASE_URL_READONLY``, y está prohibido usarlas como
   origen de la configuración.
2. La variable debe existir y no estar vacía (configuración incompleta).
3. El esquema debe ser ``postgresql`` o ``postgres``.
4. El host debe estar en una lista explícita de hosts desechables (por defecto, solo locales).
   Los hosts de Neon (``*.neon.tech``) se rechazan siempre.
5. El nombre de la base debe empezar por :data:`DISPOSABLE_DB_PREFIX`.

Limitación conocida: como no se leen los valores de ``DATABASE_URL`` ni de
``DATABASE_URL_READONLY`` (son credenciales), no se compara la URL de pruebas con ellas. La
protección equivalente la dan las reglas 4 y 5: una URL del ERP o de Neon no cumple a la vez el
host desechable y el prefijo de base de pruebas.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from urllib.parse import SplitResult, urlsplit

TEST_DATABASE_ENV_VAR = "AI_ASSISTANT_TEST_DATABASE_URL"
FORBIDDEN_ENV_VARS: frozenset[str] = frozenset({"DATABASE_URL", "DATABASE_URL_READONLY"})
ALLOWED_SCHEMES: frozenset[str] = frozenset({"postgresql", "postgres"})
DEFAULT_DISPOSABLE_HOSTS: frozenset[str] = frozenset({"localhost", "127.0.0.1", "::1"})
FORBIDDEN_HOST_SUFFIXES: tuple[str, ...] = (".neon.tech",)
DISPOSABLE_DB_PREFIX = "ai_test_"


class UnsafeDatabaseConfig(Exception):
    """Configuración de base de datos insegura o incompleta. Nunca incluye credenciales."""


@dataclass(frozen=True)
class DisposableDatabaseConfig:
    """Configuración validada de una base desechable. No abre ninguna conexión."""

    host: str
    port: int | None
    database: str
    user: str | None
    password: str | None = field(repr=False)

    def __repr__(self) -> str:
        return (
            f"DisposableDatabaseConfig(host={self.host!r}, port={self.port!r}, "
            f"database={self.database!r}, user={self.user!r}, password='***')"
        )


def _parse(url: str) -> SplitResult:
    try:
        parts = urlsplit(url)
        _ = parts.port  # valida el puerto
    except ValueError as exc:
        raise UnsafeDatabaseConfig("La URL de la base de pruebas no es válida.") from exc
    return parts


def load_disposable_database_config(
    env: Mapping[str, str],
    *,
    var_name: str = TEST_DATABASE_ENV_VAR,
    allowed_hosts: frozenset[str] = DEFAULT_DISPOSABLE_HOSTS,
) -> DisposableDatabaseConfig:
    """Valida la configuración de la base de pruebas leyendo solo ``var_name`` de ``env``."""
    if var_name in FORBIDDEN_ENV_VARS:
        raise UnsafeDatabaseConfig(
            f"No se permite usar {var_name} como base de pruebas del asistente."
        )

    raw = env.get(var_name, "")
    url = raw.strip() if isinstance(raw, str) else ""
    if not url:
        raise UnsafeDatabaseConfig(
            f"Configuración incompleta: falta {var_name}. Las pruebas que necesitan base de "
            "datos no se ejecutan sin una base desechable explícita."
        )

    parts = _parse(url)
    if parts.scheme not in ALLOWED_SCHEMES:
        raise UnsafeDatabaseConfig("Solo se admiten URLs postgresql:// para la base de pruebas.")

    host = (parts.hostname or "").lower()
    if not host:
        raise UnsafeDatabaseConfig("La URL de la base de pruebas no indica el host.")
    if host.endswith(FORBIDDEN_HOST_SUFFIXES):
        raise UnsafeDatabaseConfig("No se permite usar Neon como base de pruebas del asistente.")
    if host not in {h.lower() for h in allowed_hosts}:
        raise UnsafeDatabaseConfig(
            "El host de la base de pruebas no está en la lista de hosts desechables."
        )

    database = parts.path.lstrip("/")
    if not database.startswith(DISPOSABLE_DB_PREFIX):
        raise UnsafeDatabaseConfig(
            f"El nombre de la base de pruebas debe empezar por {DISPOSABLE_DB_PREFIX!r}."
        )

    return DisposableDatabaseConfig(
        host=host,
        port=parts.port,
        database=database,
        user=parts.username,
        password=parts.password,
    )


def load_from_process_environment() -> DisposableDatabaseConfig:
    """Igual que :func:`load_disposable_database_config`, leyendo **solo** la variable de pruebas
    del entorno del proceso."""
    value = os.environ.get(TEST_DATABASE_ENV_VAR, "")
    return load_disposable_database_config({TEST_DATABASE_ENV_VAR: value})
