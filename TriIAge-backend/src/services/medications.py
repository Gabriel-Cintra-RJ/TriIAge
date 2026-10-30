"""Pós-consulta: acha na base de bulas os remédios que a pessoa digitou.

Primeiro tentamos pelo nome (princípio ativo, nome ou marca). Se não der, pedimos ajuda ao JEV, que
lida bem com erro de digitação ou marca que não está na base. Se nem o JEV tiver certeza,
devolvemos "não encontrado" em vez de chutar.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass

from typesafe_sdk import Choice, TypeSafeClient

from src.db.models import Medication, split_list
from src.services.text import normalize

NONE = "none"
SALT_WORDS = {
    "de", "e", "cloridrato", "dicloridrato", "bromidrato", "maleato", "besilato", "fosfato", "sulfato", "oxalato",
    "bissulfato", "fumarato", "acetato", "succinato", "sodico", "sodica", "potassico", "potassica", "calcica",
    "monoidratada", "hidratado", "di", "humana", "acido",
}
INSTRUCTIONS = (
    "Qual medicamento da lista corresponde ao nome informado pela pessoa? Considere marcas, princípio ativo e "
    "grafias aproximadas. Se nenhum corresponder com segurança, escolha 'none'."
)


@dataclass(frozen=True)
class LookupResult:
    query: str
    medications: list[Medication]
    method: str  # como achamos: "name", "jev" ou "none"
    confidence: float | None = None


def _ingredient_key(active_ingredient: str) -> set[str]:
    """Pega a primeira palavra que importa de cada componente: "pantoprazol sódico sesqui-hidratado" vira {"pantoprazol"}."""
    key = set()
    for component in re.split(r"[+;]", active_ingredient):
        words = [w for w in normalize(component).split() if w not in SALT_WORDS]
        if words:
            key.add(words[0])
    return key


def _key_sets(med: Medication) -> list[set[str]]:
    keys = [_ingredient_key(med.active_ingredient), set(normalize(med.name).split()) - SALT_WORDS]
    keys += [set(normalize(brand).split()) for brand in split_list(med.brand_names)]
    return [k for k in keys if k]


def find_by_name(query: str, meds: Sequence[Medication]) -> list[Medication]:
    """Procura remédios cujo princípio ativo, nome ou marca aparece inteiro no que foi digitado.

    Se mais de um bater, fica o mais específico: "amoxicilina + clavulanato" não traz junto a amoxicilina
    sozinha. Se o remédio tiver mais de uma apresentação (ex.: pantoprazol 20 e 40 mg), vêm todas.
    """
    words = set(normalize(query).split())
    best, found = 0, []
    for med in meds:
        size = max((len(k) for k in _key_sets(med) if k <= words), default=0)
        if size > best:
            best, found = size, [med]
        elif size and size == best:
            found.append(med)
    return found


def resolve_with_jev(jev: TypeSafeClient, query: str, meds: Sequence[Medication], min_confidence: float) -> LookupResult:
    criteria = {m.id: f"{m.name} ({m.active_ingredient}; {m.dosage_form})" for m in meds}
    for m in meds:
        if brands := split_list(m.brand_names):
            criteria[m.id] += f" — marcas: {', '.join(brands)}"
    criteria[NONE] = "Nenhum medicamento da lista corresponde ao nome informado."
    response = jev.system_one(
        state={"medicamento_informado": query},
        questions={"medication": Choice(instructions=INSTRUCTIONS, criteria=criteria)},
    )
    answer = response.choices["medication"]
    if answer.choice == NONE or answer.confidence < min_confidence:
        return LookupResult(query, [], "none", answer.confidence)
    chosen = next(m for m in meds if m.id == answer.choice)
    same = [m for m in meds if normalize(m.active_ingredient) == normalize(chosen.active_ingredient)]
    return LookupResult(query, same, "jev", answer.confidence)


def lookup(jev: TypeSafeClient, query: str, meds: Sequence[Medication], min_confidence: float) -> LookupResult:
    if found := find_by_name(query, meds):
        return LookupResult(query, found, "name")
    return resolve_with_jev(jev, query, meds, min_confidence)
