"""Evidencia ``〖参考信息〗`` para el Modelo 2: solo metadatos estructurales, trazable y acotada al rol.

**Contradicción analizada (B1 frente al entrenamiento).** La regla confirmada ``naturaleza-saldo``
(B1, ``rules_v1.json``) define *cómo se calcula* el saldo según la naturaleza de la cuenta. La
evidencia del adaptador dice "do not derive account balance": pide al **SQL** totales de débito y
crédito independientes. No son reglas contables opuestas, sino un reparto de responsabilidades
compatible con AR-1: el Modelo 2 solo recupera totales verificables y el **motor financiero** (B1)
aplica la regla de naturaleza. Resolución determinista, sin cambiar ninguna regla contable:

- El texto de recuperación de reglas y métricas (en español, ``contenido``) **nunca** se envía al
  Modelo 2. Con la política ampliada (T033, ``AI_RAG_MODEL_EVIDENCE=ampliada``) solo puede llegar su
  ``evidencia_modelo``: una frase breve en inglés, curada en el corpus local aprobado, que pasa además
  los filtros de :meth:`EvidenceBuilder._model_text` (sin cálculos de saldo, signo ni naturaleza; solo
  tablas y columnas del M-Schema del rol). Los ejemplos SQL nunca se envían.
- La evidencia base es un catálogo versionado (:data:`EVIDENCE_VERSION`) de frases estructurales,
  cada una con identificador, origen y las columnas que menciona. Antes de enviarla se comprueba que
  todas esas columnas son visibles para el rol de la petición.
- Los fragmentos RAG solo entran si la política del tipo de plan los admite (``esquema`` o
  ``relacion``), sin datos sensibles ni dígitos, con tablas visibles para el rol y longitud acotada.
  La política de ``saldo_cuenta`` admite como máximo las dos relaciones entre las tablas de su
  M-Schema (recuperadas por el RAG top-5); el adaptador se entrenó con evidencia en inglés, así que se
  limita a fragmentos estructurales breves.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from ai_service.audit.masking import contains_sensitive
from ai_service.orchestrator.ports import Fragment

EVIDENCE_VERSION = "evidence-saldo-v1"
MAX_EVIDENCE_CHARS = 600
MAX_MODEL_EVIDENCE_CHARS = 160
MODEL2_FRAGMENT_TYPES: frozenset[str] = frozenset({"esquema", "relacion", "regla", "metrica"})
# Tipos cuyo ``contenido`` es texto de recuperación: al Modelo 2 solo llega su ``evidencia_modelo``.
EVIDENCE_ONLY_TYPES: frozenset[str] = frozenset({"regla", "metrica"})
_TABLE_REF_RE = re.compile(r"\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b")
_COLUMN_REF_RE = re.compile(r"\b([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\b")
_DIGIT_RE = re.compile(r"\d")
# El saldo, su signo y la naturaleza de la cuenta los calcula el motor financiero, nunca el SQL.
_CALCULATION_RE = re.compile(
    r"\b(balances?|saldos?|sign|signo|nature|naturaleza|net|neto|minus|menos|subtract\w*|rest\w*|"
    r"normal side|opening|closing|final)\b|[-+*/]|\bcase\b|\bwhen\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class EvidenceItem:
    """Frase curada de evidencia estructural (nunca valores ni reglas de cálculo)."""

    id: str
    text: str
    origen: str
    referencias: frozenset[str]  # "tabla.columna" que la frase menciona


BASE_EVIDENCE: dict[str, tuple[EvidenceItem, ...]] = {
    "saldo_cuenta": (
        EvidenceItem(
            id="saldo.totales_por_cuenta_y_tipo",
            text="Group debit and credit by account and account type; do not derive account balance.",
            origen="Frase literal de la evidencia de entrenamiento del patrón agregado por cuenta y tipo.",
            referencias=frozenset(
                {"journal_entry_detail.debit", "journal_entry_detail.credit", "accounting_account.type"}
            ),
        ),
        EvidenceItem(
            id="saldo.filtro_por_codigo",
            text="Filter the requested account by accounting_account.code.",
            origen="Frase literal de la evidencia de entrenamiento del filtro account_code.",
            referencias=frozenset({"accounting_account.code"}),
        ),
    ),
}


@dataclass(frozen=True)
class RagPolicy:
    tipos: frozenset[str] = frozenset()
    fuentes: frozenset[str] = frozenset()
    max_fragments: int = 0

    def __post_init__(self) -> None:
        if not self.tipos <= MODEL2_FRAGMENT_TYPES:
            raise ValueError("Al Modelo 2 solo pueden enviarse esquema, relaciones o evidencia_modelo aprobada.")
        if self.max_fragments > 3:
            raise ValueError("Al Modelo 2 se envían como máximo 3 fragmentos.")


_SALDO_RELATIONS = frozenset({
    "schema:relation:journal_entry_detail.entry_id->journal_entry.id",
    "schema:relation:journal_entry_detail.account_id->accounting_account.id",
})

RAG_POLICIES: dict[str, RagPolicy] = {
    # Recuperación top-5 integrada antes de generar SQL: de lo recuperado solo pasan al Modelo 2 las
    # relaciones entre las tablas del M-Schema de saldo (estructura, sin valores). Reglas, métricas y
    # ejemplos no se envían (el saldo lo calcula el motor financiero).
    "saldo_cuenta": RagPolicy(tipos=frozenset({"relacion"}), fuentes=_SALDO_RELATIONS, max_fragments=2),
}

# Política ampliada (T033, bandera ``AI_RAG_MODEL_EVIDENCE=ampliada``): además de las relaciones, la
# ``evidencia_modelo`` de las reglas y métricas útiles para recuperar totales (nunca saldo, signo ni
# naturaleza). Como máximo 3 fragmentos, en el orden de relevancia del RAG.
RAG_POLICIES_EXTENDED: dict[str, RagPolicy] = {
    "saldo_cuenta": RagPolicy(
        tipos=frozenset({"relacion", "regla", "metrica"}),
        fuentes=_SALDO_RELATIONS | {"metric:total-debe", "metric:total-haber", "rule:asiento-periodo"},
        max_fragments=3,
    ),
}
EVIDENCE_POLICY_SETS: dict[str, dict[str, RagPolicy]] = {
    "relaciones": RAG_POLICIES,
    "ampliada": RAG_POLICIES_EXTENDED,
}


class EvidenceError(ValueError):
    """No hay evidencia aprobada para el tipo de plan o menciona objetos no visibles para el rol."""


@dataclass(frozen=True)
class Evidence:
    text: str
    item_ids: tuple[str, ...]
    fragment_ids: tuple[str, ...]
    version: str = EVIDENCE_VERSION


class EvidenceBuilder:
    def __init__(
        self,
        known_tables: Iterable[str],
        *,
        base: Mapping[str, tuple[EvidenceItem, ...]] = BASE_EVIDENCE,
        policies: Mapping[str, RagPolicy] = RAG_POLICIES,
    ) -> None:
        self._known_tables = frozenset(known_tables)
        self._base = dict(base)
        self._policies = dict(policies)

    def _model_text(
        self, fragment: Fragment, policy: RagPolicy, visible: Mapping[str, frozenset[str]]
    ) -> str | None:
        """Texto que puede llegar al Modelo 2, o ``None`` si el fragmento no es aceptable."""
        if fragment.tipo == "ejemplo" or fragment.tipo not in policy.tipos or fragment.fuente not in policy.fuentes:
            return None
        if fragment.tipo in EVIDENCE_ONLY_TYPES:
            text = " ".join((fragment.evidencia_modelo or "").split())
            if not text or len(text) > MAX_MODEL_EVIDENCE_CHARS or _CALCULATION_RE.search(text):
                return None
            # Ni tablas ni columnas fuera del M-Schema del rol: la evidencia no amplía permisos.
            visible_names = set(visible) | {c for columns in visible.values() for c in columns}
            if any(table not in visible or column not in visible[table] for table, column in _COLUMN_REF_RE.findall(text)):
                return None
            if any(name not in visible_names for name in _TABLE_REF_RE.findall(text)):
                return None
        else:
            text = " ".join(fragment.contenido.split())
        if contains_sensitive(text) or _DIGIT_RE.search(text):
            return None
        mentioned = {name for name in _TABLE_REF_RE.findall(text) if name in self._known_tables}
        return text if mentioned <= set(visible) else None

    def build(self, kind: str, fragments: Sequence[Fragment], visible: Mapping[str, Iterable[str]]) -> Evidence:
        """``visible``: tablas y columnas del M-Schema del rol de la petición."""
        items = self._base.get(kind)
        if not items:
            raise EvidenceError("Tipo de plan sin evidencia aprobada.")
        visible_columns = {f"{table}.{column}" for table, columns in visible.items() for column in columns}
        if any(not item.referencias <= visible_columns for item in items):
            raise EvidenceError("La evidencia menciona objetos no visibles para el rol.")

        policy = self._policies.get(kind, RagPolicy())
        visible_sets = {table: frozenset(columns) for table, columns in visible.items()}
        parts, used = [item.text for item in items], []
        for fragment in fragments:
            if len(used) >= policy.max_fragments:
                break
            sentence = self._model_text(fragment, policy, visible_sets)
            if sentence is None or fragment.fuente in used:
                continue
            if len(" ".join([*parts, sentence])) > MAX_EVIDENCE_CHARS:
                break
            parts.append(sentence)
            used.append(fragment.fuente)
        return Evidence(text=" ".join(parts), item_ids=tuple(item.id for item in items), fragment_ids=tuple(used))
