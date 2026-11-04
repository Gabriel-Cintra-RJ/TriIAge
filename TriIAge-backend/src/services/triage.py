"""Pré-consulta: separa as situações da base parecidas com o relato e pede para o JEV escolher a certa.

Aqui não tem banco nem HTTP, tudo chega por parâmetro. Fiz assim para conseguir testar com um JEV falso.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from itertools import groupby
from typing import Any

from typesafe_sdk import Choice, TypeSafeClient

from src.db.models import SymptomUrgency, split_list
from src.schemas import TriageRequest
from src.services.text import stems

NONE = "none"
INSTRUCTIONS = (
    "Escolha a situação da lista que melhor corresponde ao relato da pessoa, considerando sintomas, sinais "
    "vitais, idade, gestação e doenças prévias. Na dúvida entre duas situações, escolha a mais grave. Se "
    "nenhuma corresponder ao relato, escolha 'none'."
)
MAX_GROUPS = 5          # quantas queixas mandamos pro JEV em cada triagem (com 3, as doenças do histórico às vezes tiravam a queixa certa)
MIN_SCORE = 3           # abaixo disso a gente considera que a base não tem nada sobre o relato
ESCALATION_PROB = 0.2   # se uma opção mais grave tiver pelo menos 20%, ela ganha


@dataclass(frozen=True)
class UrgencyResult:
    matched: bool
    record: SymptomUrgency | None = None
    escalated: bool = False
    confidence: float | None = None
    probabilities: dict[str, float] | None = None
    needs_human_review: bool = True
    model: str | None = None


def _query_text(payload: TriageRequest) -> str:
    return " ".join([payload.description, *payload.symptoms, *payload.conditions])


def _score(record: SymptomUrgency, query: set[str], pregnant: bool) -> int:
    score = 3 * len(query & stems(record.main_symptom))
    score += 2 * len(query & stems(f"{record.associated_symptoms or ''} {record.warning_signs or ''}"))
    score += len(query & stems(record.description))
    if pregnant and "gestante" in split_list(record.risk_groups):
        score += 3
    return score


def retrieve_candidates(payload: TriageRequest, records: Sequence[SymptomUrgency]) -> list[SymptomUrgency]:
    """Devolve todas as faixas de gravidade das queixas que mais parecem com o relato (ou [] se nada bater)."""
    query = stems(_query_text(payload))
    if not payload.pregnant:  # as situações "... na gestação" só fazem sentido para gestante
        records = [r for r in records if not r.main_symptom.endswith("na gestação")]
    by_group = sorted(records, key=lambda r: r.main_symptom)
    ranked = []
    for _, group in groupby(by_group, key=lambda r: r.main_symptom):
        rows = list(group)
        best = max(_score(r, query, payload.pregnant) for r in rows)
        if best >= MIN_SCORE:
            ranked.append((best, rows))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [row for _, rows in ranked[:MAX_GROUPS] for row in sorted(rows, key=lambda r: r.priority)]


def build_state(payload: TriageRequest) -> dict[str, Any]:
    return payload.model_dump(exclude_none=True, exclude_defaults=False)


def _criterion(record: SymptomUrgency) -> str:
    text = f"{record.main_symptom}: {record.description}"
    if signs := split_list(record.warning_signs):
        text += f" Sinais de alerta: {', '.join(signs)}."
    return text


def classify_urgency(
    jev: TypeSafeClient,
    payload: TriageRequest,
    candidates: Sequence[SymptomUrgency],
    min_confidence: float,
) -> UrgencyResult:
    if not candidates:
        return UrgencyResult(matched=False)

    criteria = {r.id: _criterion(r) for r in candidates}
    criteria[NONE] = "Nenhuma das situações acima corresponde ao relato da pessoa."
    response = jev.system_one(
        state=build_state(payload),
        questions={"situation": Choice(instructions=INSTRUCTIONS, criteria=criteria)},
    )
    answer = response.choices["situation"]
    probabilities = dict(answer.probabilities)
    if answer.choice == NONE:
        return UrgencyResult(matched=False, confidence=answer.confidence, probabilities=probabilities,
                             model=response.model)

    chosen = next(r for r in candidates if r.id == answer.choice)
    # na dúvida ficamos com o mais grave: se outra opção mais séria também for plausível, ela ganha
    plausible = [r for r in candidates if probabilities.get(r.id, 0.0) >= ESCALATION_PROB]
    final = min([chosen, *plausible], key=lambda r: r.priority)
    return UrgencyResult(
        matched=True,
        record=final,
        escalated=final.priority < chosen.priority,
        confidence=answer.confidence,
        probabilities=probabilities,
        needs_human_review=answer.confidence < min_confidence,
        model=response.model,
    )
