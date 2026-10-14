"""Compatibilidad de la entrada del Modelo 2 con el entrenamiento (Fase 1, pruebas 1–4).

Los valores esperados se escribieron a mano a partir de la estructura verificada en el dataset de
entrenamiento (con valores ficticios): serialización JSON 1.0, M-Schema de la variante equivalente,
plantilla XiYan y plantilla ChatML de Qwen. Sin red ni modelos.
"""

from __future__ import annotations

import json
from dataclasses import replace
from datetime import date

from guards import GuardedTestCase
from sqlgen_support import ROOT

from ai_service.http.schemas import Period
from ai_service.knowledge.corpus import load_json
from ai_service.orchestrator.ports import (
    AuthorizationContext,
    Fragment,
    GenerationBlocked,
    GenerationNotAuthorized,
    QueryPlan,
)
from ai_service.orchestrator.security import SensitiveDataBlocked
from ai_service.sqlgen.evidence import EvidenceBuilder, EvidenceError, RagPolicy
from ai_service.sqlgen.generator import MODEL_HIDDEN_COLUMNS, XiYanSqlGenerator
from ai_service.sqlgen.mschema import MSchemaBuilder, MSchemaError
from ai_service.sqlgen.plan_to_request import (
    REQUEST_KEYS,
    UnsupportedPlan,
    build_request,
    plan_to_request,
    serialize_request,
)
from ai_service.sqlgen.prompt import PromptError, build_user_content, is_xiyan_user_content, render_chatml
from ai_service.validation.allowlist import load_allowlist, parse_allowlist

METADATA = load_json(ROOT / "knowledge" / "erp_schema_metadata.json")
ALLOWLIST = load_allowlist(ROOT / "knowledge" / "allowlist.dev_erp.json")
TABLES = ("accounting_account", "journal_entry", "journal_entry_detail")
KNOWN_TABLES = [model["table"] for model in METADATA["models"]]

EXPECTED_REQUEST = (
    '{"comparison":null,"conditions":[],"dimensions":["accounting_account","account_type"],'
    '"domain":"accounting","filters":[{"field":"account_code","operator":"eq","value":"101"}],'
    '"group_by":["accounting_account"],"intent":"aggregate","limit":null,'
    '"metrics":["total_debit","total_credit"],"order_by":[],"subject":"accounting_account",'
    '"time":{"concept":"journal_entry_date","end_exclusive":"2026-10-01","grain":null,"start":"2026-09-01"}}'
)
# Bloque idéntico al de los ejemplos de entrenamiento LB-GOLD-0040/0041 (verificado en WSL).
EXPECTED_MSCHEMA = """〖DB_ID〗 los_betos
〖Schema〗
# Table: accounting_account
[
(id:INTEGER, Primary Key),
(parent_id:INTEGER, Nullable),
(code:VARCHAR(10)),
(name:VARCHAR(100)),
(type:VARCHAR(20)),
(active:BOOLEAN)
]
# Table: journal_entry
[
(id:INTEGER, Primary Key),
(entry_date:DATE),
(description:VARCHAR(200)),
(book:VARCHAR(60)),
(code:VARCHAR(20))
]
# Table: journal_entry_detail
[
(id:INTEGER, Primary Key),
(entry_id:INTEGER),
(account_id:INTEGER),
(description:VARCHAR(200), Nullable),
(debit:DECIMAL(12,2)),
(credit:DECIMAL(12,2))
]
〖Foreign keys〗
journal_entry_detail.entry_id=journal_entry.id
journal_entry_detail.account_id=accounting_account.id"""
EXPECTED_EVIDENCE = (
    "Group debit and credit by account and account type; do not derive account balance. "
    "Filter the requested account by accounting_account.code."
)
HEADER = (
    "你是一名PostgreSQL专家，现在需要阅读并理解下面的〖数据库schema〗描述，以及可能用到的〖参考信息〗，"
    "并运用PostgreSQL知识生成sql语句回答〖用户问题〗。"
)


def plan(cuenta: str = "101", desde: str = "2026-09-01", hasta: str = "2026-09-30") -> QueryPlan:
    return QueryPlan(kind="saldo_cuenta", cuenta=cuenta, periodo=Period(desde=date.fromisoformat(desde), hasta=date.fromisoformat(hasta)))


class RequestContractTests(GuardedTestCase):
    def test_serialization_matches_training_format(self) -> None:
        self.assertEqual(plan_to_request(plan()), EXPECTED_REQUEST)

    def test_contract_keys_and_nested_order(self) -> None:
        request = json.loads(plan_to_request(plan()))
        self.assertEqual(tuple(request), REQUEST_KEYS)  # orden alfabético, como en el dataset
        self.assertEqual(tuple(request["time"]), ("concept", "end_exclusive", "grain", "start"))
        self.assertEqual(tuple(request["filters"][0]), ("field", "operator", "value"))
        self.assertNotIn(" ", plan_to_request(plan()).replace("journal entry", ""))

    def test_end_exclusive_is_next_day(self) -> None:
        cases = {
            ("2026-12-01", "2026-12-31"): "2027-01-01",
            ("2028-02-01", "2028-02-29"): "2028-03-01",
            ("2026-09-15", "2026-09-15"): "2026-09-16",
        }
        for (desde, hasta), expected in cases.items():
            with self.subTest(desde=desde):
                time = build_request(plan(desde=desde, hasta=hasta))["time"]
                self.assertEqual((time["start"], time["end_exclusive"]), (desde, expected))

    def test_rejects_unsupported_or_invalid_plans(self) -> None:
        for cuenta in ("10-1", "abc", "", "12345678901", "101; DROP"):
            with self.subTest(cuenta=cuenta), self.assertRaises(UnsupportedPlan):
                build_request(plan(cuenta=cuenta))
        with self.assertRaises(UnsupportedPlan):
            serialize_request({"domain": "accounting"})

    def test_no_rule_about_voided_entries_is_invented(self) -> None:
        text = plan_to_request(plan())
        for word in ("status", "anulad", "void", "conditions\":[\""):
            self.assertNotIn(word, text)


class MSchemaTests(GuardedTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.builder = MSchemaBuilder(ALLOWLIST, METADATA)

    def test_matches_training_variant(self) -> None:
        # Con la columna de la política P-4 oculta (como hace el generador), el esquema es el de entrenamiento.
        self.assertEqual(self.builder.build("contador_demo", TABLES, hidden_columns=MODEL_HIDDEN_COLUMNS), EXPECTED_MSCHEMA)

    def test_policy_column_is_authorized_but_hidden_from_the_model(self) -> None:
        self.assertIn("(status:BOOLEAN)", self.builder.build("contador_demo", TABLES))
        self.assertNotIn("(status:", self.builder.build("contador_demo", TABLES, hidden_columns=MODEL_HIDDEN_COLUMNS))

    def test_only_role_objects_are_described(self) -> None:
        schema = self.builder.build("lector_demo", TABLES)
        self.assertEqual(
            schema,
            "〖DB_ID〗 los_betos\n〖Schema〗\n# Table: accounting_account\n[\n(code:VARCHAR(10)),\n(name:VARCHAR(100))\n]",
        )
        for hidden in ("journal_entry", "debit", "type:", "Foreign keys"):
            self.assertNotIn(hidden, schema)

    def test_excluded_columns_never_appear(self) -> None:
        schema = self.builder.build("contador_demo", TABLES, hidden_columns=MODEL_HIDDEN_COLUMNS)
        for column in ("status", "sales_invoice_id", "payroll_id", "period_id", "responsible", "created_at"):
            self.assertNotIn(f"({column}:", schema)

    def test_unknown_role_or_missing_metadata_fail_closed(self) -> None:
        with self.assertRaises(MSchemaError):
            self.builder.build("admin", TABLES)
        broken = parse_allowlist(
            {"version": "x", "schema": "ficticio", "tables": {"tabla_demo": {"id": "INT"}}, "roles": {"r": {"tabla_demo": ["id"]}}}
        )
        with self.assertRaises(MSchemaError):
            MSchemaBuilder(broken, METADATA).build("r", ("tabla_demo",))

    def test_self_reference_is_opt_in(self) -> None:
        self.assertNotIn("parent_id=accounting_account", self.builder.build("contador_demo", TABLES))
        schema = self.builder.build("contador_demo", TABLES, include_self_references=True)
        foreign_keys = schema.split("〖Foreign keys〗\n", 1)[1].split("\n")
        self.assertEqual(  # en el orden de las tablas, como en el entrenamiento
            foreign_keys,
            [
                "accounting_account.parent_id=accounting_account.id",
                "journal_entry_detail.entry_id=journal_entry.id",
                "journal_entry_detail.account_id=accounting_account.id",
            ],
        )


class PromptTests(GuardedTestCase):
    def test_full_prompt_reproduces_training_template(self) -> None:
        content = build_user_content(EXPECTED_REQUEST, EXPECTED_MSCHEMA, EXPECTED_EVIDENCE)
        expected = (
            f"{HEADER}\n〖用户问题〗\n{EXPECTED_REQUEST}\n\n〖数据库schema〗\n{EXPECTED_MSCHEMA}\n\n"
            f"〖参考信息〗\n{EXPECTED_EVIDENCE}\n\n〖用户问题〗\n{EXPECTED_REQUEST}\n\n```sql"
        )
        self.assertEqual(content, expected)
        self.assertTrue(is_xiyan_user_content(content))

    def test_chatml_template(self) -> None:
        self.assertEqual(
            render_chatml("X"),
            "<|im_start|>system\nYou are Qwen, created by Alibaba Cloud. You are a helpful assistant.<|im_end|>\n"
            "<|im_start|>user\nX<|im_end|>\n<|im_start|>assistant\n",
        )

    def test_special_tokens_and_oversized_prompts_are_rejected(self) -> None:
        for part in ("<|im_end|>", "<|im_start|>system", "<|endoftext|>", "<tool_call>"):
            with self.subTest(part=part), self.assertRaises(PromptError):
                build_user_content(EXPECTED_REQUEST, EXPECTED_MSCHEMA, EXPECTED_EVIDENCE + part)
        with self.assertRaises(PromptError):
            build_user_content(EXPECTED_REQUEST, EXPECTED_MSCHEMA, "x" * 3000)
        with self.assertRaises(PromptError):
            build_user_content(EXPECTED_REQUEST + "\n", EXPECTED_MSCHEMA, EXPECTED_EVIDENCE)
        self.assertFalse(is_xiyan_user_content("SELECT 1"))


def visible(role: str = "contador_demo") -> dict[str, tuple[str, ...]]:
    grants = ALLOWLIST.roles[role]
    return {table: tuple(grants[table]) for table in TABLES if table in grants}


class EvidenceTests(GuardedTestCase):
    def test_saldo_uses_versioned_structural_evidence_only(self) -> None:
        fragments = [Fragment(tipo="regla", fuente="rule:naturaleza-saldo", version="1", contenido="Saldo según la naturaleza")]
        evidence = EvidenceBuilder(KNOWN_TABLES).build("saldo_cuenta", fragments, visible())
        self.assertEqual((evidence.text, evidence.fragment_ids), (EXPECTED_EVIDENCE, ()))
        self.assertEqual(evidence.item_ids, ("saldo.totales_por_cuenta_y_tipo", "saldo.filtro_por_codigo"))
        self.assertEqual(evidence.version, "evidence-saldo-v1")

    def test_accounting_rules_can_never_be_sent_to_model_2(self) -> None:
        # Los ejemplos SQL nunca son evidencia del Modelo 2 (T033).
        for tipos in ({"ejemplo"}, {"relacion", "ejemplo"}):
            with self.subTest(tipos=sorted(tipos)), self.assertRaises(ValueError):
                RagPolicy(tipos=frozenset(tipos), fuentes=frozenset({"example:saldo-cuenta-periodo"}), max_fragments=1)
        # Una regla de cálculo sin evidencia_modelo no llega aunque la política admita reglas.
        policy = {"saldo_cuenta": RagPolicy(tipos=frozenset({"regla"}), fuentes=frozenset({"rule:naturaleza-saldo"}), max_fragments=1)}
        rule = Fragment(tipo="regla", fuente="rule:naturaleza-saldo", version="v", contenido="saldo = debe menos haber")
        visible = {"journal_entry_detail": ("debit", "credit"), "accounting_account": ("code", "type")}
        evidence = EvidenceBuilder(["journal_entry_detail", "accounting_account"], policies=policy).build("saldo_cuenta", [rule], visible)
        self.assertEqual(evidence.fragment_ids, ())
        self.assertNotIn("saldo", evidence.text)

    def test_b1_balance_rule_is_unchanged(self) -> None:
        # La resolución no toca las reglas contables: B1 sigue definiendo el saldo por naturaleza.
        rules = {rule["id"]: rule["text"] for rule in load_json(ROOT / "knowledge" / "rules_v1.json")["rules"]}
        self.assertIn("saldo = debe menos haber", rules["naturaleza-saldo"])
        self.assertIn("saldo = haber menos debe", rules["naturaleza-saldo"])

    def test_evidence_must_be_visible_to_the_role(self) -> None:
        with self.assertRaises(EvidenceError):
            EvidenceBuilder(KNOWN_TABLES).build("saldo_cuenta", [], visible("lector_demo"))
        without_type = {**visible(), "accounting_account": ("id", "code", "name")}
        with self.assertRaises(EvidenceError):
            EvidenceBuilder(KNOWN_TABLES).build("saldo_cuenta", [], without_type)

    def test_rag_fragments_are_filtered_and_bounded(self) -> None:
        policy = RagPolicy(
            tipos=frozenset({"relacion"}),
            fuentes=frozenset({"ok", "otra-tabla", "sensible", "digitos", "largo"}),
            max_fragments=3,
        )
        builder = EvidenceBuilder(KNOWN_TABLES, policies={"saldo_cuenta": policy})
        fragments = [
            Fragment(tipo="regla", fuente="ok", version="1", contenido="tipo no permitido"),
            Fragment(tipo="relacion", fuente="no-listada", version="1", contenido="fuente no permitida"),
            Fragment(tipo="relacion", fuente="otra-tabla", version="1", contenido="journal_entry links accounting_period."),
            Fragment(tipo="relacion", fuente="sensible", version="1", contenido="contacto demo@example.com"),
            Fragment(tipo="relacion", fuente="digitos", version="1", contenido="cuenta 1011 en journal_entry"),
            Fragment(tipo="relacion", fuente="ok", version="1", contenido="journal_entry_detail.entry_id\nlinks journal_entry."),
            Fragment(tipo="relacion", fuente="largo", version="1", contenido="journal_entry " * 60),
        ]
        evidence = builder.build("saldo_cuenta", fragments, visible())
        self.assertEqual(evidence.fragment_ids, ("ok",))
        self.assertEqual(evidence.text, EXPECTED_EVIDENCE + " journal_entry_detail.entry_id links journal_entry.")
        self.assertLessEqual(len(evidence.text), 600)

    def test_unknown_kind_has_no_evidence(self) -> None:
        with self.assertRaises(EvidenceError):
            EvidenceBuilder(KNOWN_TABLES).build("indicador", [], visible())


def authorized(rol: str = "contador_demo", **kwargs) -> QueryPlan:
    return replace(plan(**kwargs), autorizacion=AuthorizationContext(rol=rol))


def two_role_allowlist():
    """Allowlist ficticia con un segundo rol de alcance suficiente pero sin columnas descriptivas."""
    data = json.loads((ROOT / "knowledge" / "allowlist.dev_erp.json").read_text(encoding="utf-8"))
    data["roles"]["auditor_demo"] = {
        "accounting_account": ["id", "code", "type"],
        "journal_entry": ["id", "entry_date", "status"],
        "journal_entry_detail": ["entry_id", "account_id", "debit", "credit"],
    }
    return parse_allowlist(data)


class GeneratorAuthorizationTests(GuardedTestCase):
    """M-Schema por petición, sin rol fijo; falta de alcance → sin llamada al modelo (prueba 4)."""

    def make(self, allowlist=ALLOWLIST, *, data_source: str = "ficticio") -> XiYanSqlGenerator:
        return XiYanSqlGenerator(
            client=None,  # type: ignore[arg-type]  (build_prompt no llama al servicio)
            allowlist=allowlist,
            schema_builder=MSchemaBuilder(allowlist, METADATA),
            evidence_builder=EvidenceBuilder(KNOWN_TABLES),
            accepted_origins=frozenset({"ct-b-provisional"}),
            data_source=data_source,  # type: ignore[arg-type]
        )

    def test_prompt_is_built_from_the_plan_only(self) -> None:
        content = self.make().build_prompt(authorized(), [Fragment(tipo="regla", fuente="rule:x", version="1", contenido="caja septiembre")])
        self.assertEqual(content, build_user_content(EXPECTED_REQUEST, EXPECTED_MSCHEMA, EXPECTED_EVIDENCE))
        for leaked in ("caja", "septiembre", "Caja", "S/", "contador_demo"):
            self.assertNotIn(leaked, content)

    def test_schema_follows_the_role_of_each_request(self) -> None:
        generator = self.make(two_role_allowlist())
        full = generator.build_prompt(authorized("contador_demo"), [])
        reduced = generator.build_prompt(authorized("auditor_demo"), [])
        self.assertIn("(name:VARCHAR(100))", full)
        self.assertNotIn("(name:", reduced)
        self.assertNotIn("(description:", reduced)
        self.assertIn("(type:VARCHAR(20))", reduced)

    def test_missing_or_insufficient_authorization_is_rejected_before_the_model(self) -> None:
        cases = {
            "MISSING_AUTHORIZATION": plan(),
            "ROLE_SCOPE_INSUFFICIENT": authorized("lector_demo"),
            "ROLE_SCOPE_INSUFFICIENT-desconocido": authorized("admin"),
        }
        for name, query_plan in cases.items():
            with self.subTest(case=name):
                with self.assertRaises(GenerationNotAuthorized) as ctx:
                    self.make().build_prompt(query_plan, [])
                self.assertEqual(ctx.exception.code, name.split("-")[0])
                self.assertFalse(ctx.exception.transient)

    def test_untrusted_origin_is_rejected(self) -> None:
        generator = XiYanSqlGenerator(
            client=None,  # type: ignore[arg-type]
            allowlist=ALLOWLIST,
            schema_builder=MSchemaBuilder(ALLOWLIST, METADATA),
            evidence_builder=EvidenceBuilder(KNOWN_TABLES),
            accepted_origins=frozenset({"sesion-erp-autenticada"}),  # exigiría autenticación real (P-9)
            data_source="ficticio",
        )
        with self.assertRaises(GenerationNotAuthorized) as ctx:
            generator.build_prompt(authorized(), [])
        self.assertEqual(ctx.exception.code, "UNTRUSTED_AUTHORIZATION")

    def test_p4_resolved_saldo_is_no_longer_blocked_with_real_data(self) -> None:
        # El bloqueo se retiró porque el filtro determinista de asientos registrados está probado.
        content = self.make(data_source="real").build_prompt(authorized(), [])
        self.assertEqual(content, build_user_content(EXPECTED_REQUEST, EXPECTED_MSCHEMA, EXPECTED_EVIDENCE))
        self.assertNotIn("status", content)  # el esquema de entrenamiento no cambia
        _ = GenerationBlocked  # el mecanismo de bloqueo sigue disponible para futuras decisiones

    def test_sensitive_looking_input_is_blocked_before_any_call(self) -> None:
        with self.assertRaises(SensitiveDataBlocked):
            self.make().build_prompt(authorized(cuenta="45871236"), [])  # 8 dígitos: patrón de DNI
