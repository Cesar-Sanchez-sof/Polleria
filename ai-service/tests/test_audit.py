"""Pruebas de enmascaramiento y minimización de trazas (T015). Solo datos ficticios."""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from pathlib import Path

from guards import GuardedTestCase

from pydantic import ValidationError

from ai_service.audit.masking import (
    HMAC_KEY_ENV_VAR,
    AuditConfigError,
    AuditMaskingError,
    Pseudonymizer,
    contains_sensitive,
    load_hmac_key,
    mask_parameters,
    parametrize_sql,
    redact_text,
)
from ai_service.audit.record import TEMPLATE_UNAVAILABLE, AuditRecord, build_audit_record
from ai_service.validation.allowlist import load_allowlist
from ai_service.validation.validator import SqlValidator

ALLOWLIST = load_allowlist(Path(__file__).resolve().parents[1] / "knowledge" / "allowlist.example.json")
NOW = datetime(2026, 10, 12, 18, 0, tzinfo=timezone.utc)

# Datos FICTICIOS que nunca deben aparecer en una traza.
FAKE_DNI = "45871236"
FAKE_RUC = "20123456789"
FAKE_EMAIL = "ana.perez@ejemplo.test"
FAKE_PASSWORD = "Sup3rS3cr3to!"
FAKE_AMOUNT = "1500.75"
FAKE_ACCOUNT = "101"


def fake_key_hex() -> str:
    """Clave ficticia aleatoria por ejecución (nunca una clave real ni escrita en el código)."""
    return secrets.token_hex(32)


def make_pseudonymizer() -> Pseudonymizer:
    return Pseudonymizer(load_hmac_key({HMAC_KEY_ENV_VAR: fake_key_hex()}))


def clear_text_fields(record: AuditRecord) -> str:
    """Traza serializada sin los campos HMAC (seudónimo y digests de parámetros).

    Helper local para que las pruebas de B2 no dependan de los módulos de prueba de B3.
    """
    data = record.model_dump(mode="json")
    data.pop("usuario_seudonimo")
    data["parametros"] = [{"tipo": p["tipo"]} for p in data["parametros"]]
    return json.dumps(data, ensure_ascii=False)


class KeyConfigurationTests(GuardedTestCase):
    def test_missing_or_blank_key_fails_safely(self) -> None:
        for env in ({}, {HMAC_KEY_ENV_VAR: ""}, {HMAC_KEY_ENV_VAR: "   "}):
            with self.subTest(env=env), self.assertRaises(AuditConfigError):
                load_hmac_key(env)

    def test_weak_or_malformed_key_fails_safely(self) -> None:
        for value in ("abcd", "zz" * 32, secrets.token_hex(16)):
            with self.subTest(length=len(value)), self.assertRaises(AuditConfigError):
                load_hmac_key({HMAC_KEY_ENV_VAR: value})

    def test_pseudonymizer_requires_strong_key(self) -> None:
        with self.assertRaises(AuditConfigError):
            Pseudonymizer(b"corta")

    def test_key_is_never_exposed(self) -> None:
        key_hex = fake_key_hex()
        pseudonymizer = Pseudonymizer(bytes.fromhex(key_hex))
        self.assertNotIn(key_hex, repr(pseudonymizer))
        self.assertNotIn(key_hex, str(pseudonymizer))

    def test_record_without_key_fails_safely(self) -> None:
        with self.assertRaises(AuditConfigError):
            build_audit_record(
                id_traza="traza-0001-demo", user_id=7, estado="respondida",
                registrado_en=NOW, pseudonymizer=None,
            )


class PseudonymizationTests(GuardedTestCase):
    def test_hmac_is_deterministic_per_key_and_context(self) -> None:
        p = make_pseudonymizer()
        self.assertEqual(p.digest("7", context="usuario"), p.digest("7", context="usuario"))
        self.assertNotEqual(p.digest("7", context="usuario"), p.digest("7", context="parametro:text"))
        self.assertNotEqual(p.digest("7", context="usuario"), make_pseudonymizer().digest("7", context="usuario"))
        self.assertRegex(p.digest("7", context="usuario"), r"^hmac-sha256:[0-9a-f]{64}$")


class ParametrizationTests(GuardedTestCase):
    def test_all_literals_become_placeholders(self) -> None:
        sql = (
            "SELECT c.codigo AS codigo FROM ficticio.cuenta_demo AS c "
            f"WHERE c.codigo = '{FAKE_ACCOUNT}' AND c.nombre = '{FAKE_EMAIL}' LIMIT 200"
        )
        result = parametrize_sql(sql)
        for value in (FAKE_ACCOUNT, FAKE_EMAIL, "200"):
            self.assertNotIn(value, result.template)
        self.assertEqual(len(result.parameters), 3)
        self.assertIn("%(1)s", result.template)

    def test_masked_parameters_keep_only_type_and_hmac(self) -> None:
        result = parametrize_sql(
            f"SELECT d.id AS id FROM ficticio.detalle_asiento_demo AS d WHERE d.debe > {FAKE_AMOUNT} LIMIT 10"
        )
        masked = mask_parameters(result.parameters, make_pseudonymizer())
        for kind, digest in masked:
            self.assertIn(kind, {"text", "number"})
            self.assertTrue(digest.startswith("hmac-sha256:"))
            self.assertNotIn(FAKE_AMOUNT, digest)

    def test_unsafe_sql_is_not_parametrized(self) -> None:
        for sql in ("SELECT 1; DROP TABLE x", "SELECT FROM WHERE (", "SELECT 1 -- comentario", "SET ROLE x"):
            with self.subTest(sql=sql), self.assertRaises(AuditMaskingError):
                parametrize_sql(sql)


class RedactionTests(GuardedTestCase):
    def test_redact_text_removes_sensitive_data(self) -> None:
        text = (
            f"Fallo con postgresql://u:{FAKE_PASSWORD}@db.ejemplo.test/x password={FAKE_PASSWORD} "
            f"DNI {FAKE_DNI} RUC {FAKE_RUC} correo {FAKE_EMAIL} importe S/ {FAKE_AMOUNT} "
            "Authorization: Bearer abc.def.ghi"
        )
        redacted = redact_text(text)
        for secret in (FAKE_PASSWORD, FAKE_DNI, FAKE_RUC, FAKE_EMAIL, FAKE_AMOUNT, "abc.def.ghi"):
            self.assertNotIn(secret, redacted)
        self.assertFalse(contains_sensitive(redacted))


class AuditRecordTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pseudonymizer = make_pseudonymizer()

    def _record_from_validator(self):
        verdict = SqlValidator(ALLOWLIST).validate(
            f"SELECT codigo, nombre FROM cuenta_demo WHERE codigo = '{FAKE_ACCOUNT}' AND nombre = '{FAKE_EMAIL}'",
            "contador_demo",
        )
        self.assertTrue(verdict.approved, verdict.reasons)
        return build_audit_record(
            id_traza="traza-0001-demo",
            user_id=7,
            estado="respondida",
            registrado_en=NOW,
            pseudonymizer=self.pseudonymizer,
            intencion="consulta_financiera",
            normalized_sql=verdict.normalized_sql,
            versiones={"validator": "b2", "allowlist": ALLOWLIST.version},
            duracion_ms=12,
            filas=1,
            diagnostico=f"Consulta de {FAKE_EMAIL} con DNI {FAKE_DNI} y password={FAKE_PASSWORD}",
        )

    def test_record_is_minimized_and_masked(self) -> None:
        record = self._record_from_validator()
        # Datos sensibles: solo en los campos en claro. Un digest hexadecimal puede contener "101"
        # por azar sin que exista fuga, así que los HMAC se validan aparte.
        clear_text = clear_text_fields(record)
        for secret in (FAKE_ACCOUNT, FAKE_EMAIL, FAKE_DNI, FAKE_PASSWORD):
            self.assertNotIn(secret, clear_text)
        self.assertIn("%(", record.plantilla_sql)
        self.assertEqual(len(record.parametros), 3)  # codigo, nombre y LIMIT

    def test_hmac_fields_are_pseudonymized_and_never_store_originals(self) -> None:
        record = self._record_from_validator()
        hmac_re = r"^hmac-sha256:[0-9a-f]{64}$"
        self.assertRegex(record.usuario_seudonimo, hmac_re)
        self.assertEqual(record.usuario_seudonimo, self.pseudonymizer.digest("7", context="usuario"))
        stored = {(p.tipo, p.hmac) for p in record.parametros}
        expected = {
            (kind, self.pseudonymizer.digest(value, context=f"parametro:{kind}"))
            for kind, value in (("number", "200"), ("text", FAKE_ACCOUNT), ("text", FAKE_EMAIL))
        }
        self.assertEqual(stored, expected)  # solo tipo + HMAC de los valores originales
        for parameter in record.model_dump()["parametros"]:
            self.assertEqual(set(parameter), {"tipo", "hmac"})
            self.assertRegex(parameter["hmac"], hmac_re)
            self.assertNotIn(parameter["hmac"], {FAKE_ACCOUNT, FAKE_EMAIL, "200"})

    def test_record_has_no_fields_for_sensitive_content(self) -> None:
        forbidden = {
            "prompt", "pregunta", "mensaje", "historial", "conversacion", "respuesta", "texto",
            "cifras", "valor", "resultados", "filas_resultado", "password", "token", "usuario_id",
        }
        self.assertFalse(set(AuditRecord.model_fields) & forbidden)

    def test_record_rejects_extra_fields(self) -> None:
        base = self._record_from_validator().model_dump()
        for field, value in (("prompt", "texto"), ("historial", []), ("filas_resultado", [[1]]), ("password", "x")):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                AuditRecord.model_validate({**base, field: value})

    def test_record_rejects_literals_and_sensitive_text(self) -> None:
        base = self._record_from_validator().model_dump()
        bad_values = {
            "plantilla_sql": f"SELECT codigo FROM cuenta_demo WHERE codigo = '{FAKE_ACCOUNT}'",
            "diagnostico": f"password={FAKE_PASSWORD}",
            "versiones": {"db": "postgresql://u:p@h/db"},
            "usuario_seudonimo": "7",
            "registrado_en": datetime(2026, 10, 12, 18, 0),  # sin zona horaria
        }
        for field, value in bad_values.items():
            with self.subTest(field=field), self.assertRaises(ValidationError):
                AuditRecord.model_validate({**base, field: value})

    def test_unparametrizable_sql_is_not_stored(self) -> None:
        record = build_audit_record(
            id_traza="traza-0002-demo", user_id=7, estado="no_resoluble", registrado_en=NOW,
            pseudonymizer=self.pseudonymizer, normalized_sql="SELECT 1; DROP TABLE x",
        )
        self.assertIsNone(record.plantilla_sql)
        self.assertEqual(record.parametros, [])
        self.assertIn(TEMPLATE_UNAVAILABLE, record.codigos_rechazo)
        self.assertNotIn("DROP", record.model_dump_json())

    def test_rejection_without_sql(self) -> None:
        record = build_audit_record(
            id_traza="traza-0003-demo", user_id=9, estado="solo_lectura", registrado_en=NOW,
            pseudonymizer=self.pseudonymizer, codigos_rechazo=("WRITE_OPERATION",),
        )
        self.assertEqual(record.codigos_rechazo, ["WRITE_OPERATION"])
        self.assertIsNone(record.plantilla_sql)
