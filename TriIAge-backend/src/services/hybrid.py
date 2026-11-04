"""Motor híbrido (UC06 do documento): o JEV escolhe a situação e a árvore de decisão também classifica. Se os dois
derem níveis diferentes, fica o mais urgente e a divergência é marcada. Se o JEV falhar (fora do ar, passou do
tempo, erro da API), a classificação sai só da árvore, com origem "rules" (contingência do RNF05)."""

from collections.abc import Sequence
from dataclasses import replace

from typesafe_sdk import TypeSafeClient, TypeSafeError

from src.db.models import SymptomUrgency
from src.schemas import TriageRequest
from src.services.decision_tree import classify_by_rules
from src.services.triage import UrgencyResult, classify_urgency, retrieve_candidates


def _level(record: SymptomUrgency | None) -> str | None:
    return record.urgency_level if record else None


def classify_hybrid(
    jev: TypeSafeClient,
    payload: TriageRequest,
    records: Sequence[SymptomUrgency],
    min_confidence: float,
) -> UrgencyResult:
    rules = classify_by_rules(payload, records)
    try:
        model = classify_urgency(jev, payload, retrieve_candidates(payload, records), min_confidence)
    except TypeSafeError:
        # sem o modelo não tem confiança para mostrar, então sempre pede revisão humana
        return UrgencyResult(
            matched=rules.matched, record=rules.record, needs_human_review=True, origin="rules",
            rules_level=_level(rules.record), path=tuple(rules.path),
        )

    options = [r for r in (model.record, rules.record) if r is not None]
    final = min(options, key=lambda r: r.priority) if options else None
    return replace(
        model,
        matched=final is not None,
        record=final,
        origin="hybrid",
        divergent=_level(model.record) != _level(rules.record),
        model_level=_level(model.record),
        rules_level=_level(rules.record),
        path=tuple(rules.path),
    )
