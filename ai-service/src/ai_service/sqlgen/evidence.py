"""Evidencia ``〖参考信息〗`` para el Modelo 2: solo metadatos estructurales, trazable y acotada al rol.

**Contradicción analizada (B1 frente al entrenamiento).** La regla confirmada ``naturaleza-saldo``
(B1, ``rules_v1.json``) define *cómo se calcula* el saldo según la naturaleza de la cuenta. La
evidencia del adaptador dice "do not derive account balance": pide al **SQL** totales de débito y
crédito independientes. No son reglas contables opuestas, sino un reparto de responsabilidades
compatible con AR-1: el Modelo 2 solo recupera totales verificables y el **motor financiero** (B1)
aplica la regla de naturaleza. Resolución determinista, sin cambiar ninguna regla contable:

- Las reglas contables (fragmentos ``regla``) y los ejemplos **nunca** se envían al Modelo 2;
  :class:`RagPolicy` rechaza esos tipos. Las aplica el motor financiero.
- La evidencia base es un catálogo versionado (:data:`EVIDENCE_VERSION`) de frases estructurales,
  cada una con identificador, origen y las columnas que menciona. Antes de enviarla se comprueba que
  todas esas columnas son visibles para el rol de la petición.
- Los fragmentos RAG solo entran si la política del tipo de plan los admite (``esquema`` o
  ``relacion``), sin datos sensibles ni dígitos, con tablas visibles para el rol y longitud acotada.
  La política de ``saldo_cuenta`` no admite ninguno: el corpus de B4 está en español y el adaptador
  se entrenó con evidencia en inglés.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from ai_service.audit.masking import contains_sensitive
from ai_service.orchestrator.ports import Fragment

EVIDENCE_VERSION = "evidence-saldo-v1"
MAX_EVIDENCE_CHARS = 600
MODEL2_FRAGMENT_TYPES: frozenset[str] = frozenset({"esquema", "relacion"})
_TABLE_REF_RE = re.compile(r"\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b")
_DIGIT_RE = re.compile(r"\d")


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
            raise ValueError("Al Modelo 2 solo pueden enviarse fragmentos de esquema o relaciones.")


RAG_POLICIES: dict[str, RagPolicy] = {"saldo_cuenta": RagPolicy()}


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

    def _acceptable(self, fragment: Fragment, policy: RagPolicy, visible_tables: frozenset[str]) -> bool:
        if fragment.tipo not in policy.tipos or fragment.fuente not in policy.fuentes:
            return False
        text = fragment.contenido
        if contains_sensitive(text) or _DIGIT_RE.search(text):
            return False
        mentioned = {name for name in _TABLE_REF_RE.findall(text) if name in self._known_tables}
        return mentioned <= visible_tables

    def build(self, kind: str, fragments: Sequence[Fragment], visible: Mapping[str, Iterable[str]]) -> Evidence:
        """``visible``: tablas y columnas del M-Schema del rol de la petición."""
        items = self._base.get(kind)
        if not items:
            raise EvidenceError("Tipo de plan sin evidencia aprobada.")
        visible_columns = {f"{table}.{column}" for table, columns in visible.items() for column in columns}
        if any(not item.referencias <= visible_columns for item in items):
            raise EvidenceError("La evidencia menciona objetos no visibles para el rol.")

        policy = self._policies.get(kind, RagPolicy())
        visible_tables = frozenset(visible)
        parts, used = [item.text for item in items], []
        for fragment in fragments:
            if len(used) >= policy.max_fragments:
                break
            if not self._acceptable(fragment, policy, visible_tables):
                continue
            sentence = " ".join(fragment.contenido.split())
            if len(" ".join([*parts, sentence])) > MAX_EVIDENCE_CHARS:
                break
            parts.append(sentence)
            used.append(fragment.fuente)
        return Evidence(text=" ".join(parts), item_ids=tuple(item.id for item in items), fragment_ids=tuple(used))
