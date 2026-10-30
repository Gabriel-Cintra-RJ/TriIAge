from types import SimpleNamespace

from typesafe_sdk import ChoiceAnswer

from src.schemas import TriageRequest
from src.services.triage import NONE, classify_urgency, retrieve_candidates
from tests.conftest import FakeJev


def payload(**overrides) -> TriageRequest:
    data = {"age": 58, "description": "Dor no peito há 30 minutos, com falta de ar"}
    return TriageRequest(**(data | overrides))


def test_retrieve_returns_every_severity_tier_of_matching_complaints(symptom_records):
    candidates = retrieve_candidates(payload(), symptom_records)

    complaints = {r.main_symptom for r in candidates}
    assert "Dor no peito" in complaints
    tiers = {r.urgency_level for r in candidates if r.main_symptom == "Dor no peito"}
    assert tiers == {"emergency", "very_urgent", "urgent"}


def test_retrieve_returns_nothing_for_unrelated_text(symptom_records):
    assert retrieve_candidates(payload(description="quero renovar minha carteirinha"), symptom_records) == []


def test_classify_uses_the_record_chosen_by_jev(symptom_records):
    candidates = retrieve_candidates(payload(), symptom_records)
    target = next(r for r in candidates if r.main_symptom == "Dor no peito" and r.urgency_level == "emergency")
    jev = FakeJev(pick=lambda criteria: target.id)

    result = classify_urgency(jev, payload(), candidates, min_confidence=0.7)

    assert result.matched and result.record is target
    assert result.record.guidance.startswith("Ligue agora para o SAMU 192")
    assert NONE in jev.calls[0]["questions"]["situation"].criteria


def test_none_answer_means_insufficient_information(symptom_records):
    candidates = retrieve_candidates(payload(), symptom_records)
    result = classify_urgency(FakeJev(pick=lambda c: NONE), payload(), candidates, min_confidence=0.7)

    assert not result.matched and result.record is None


def test_plausible_more_severe_option_escalates_the_level(symptom_records):
    candidates = retrieve_candidates(payload(), symptom_records)
    mild = next(r for r in candidates if r.main_symptom == "Dor no peito" and r.urgency_level == "urgent")
    severe = next(r for r in candidates if r.main_symptom == "Dor no peito" and r.urgency_level == "emergency")
    answer = ChoiceAnswer(type="choice", choice=mild.id, confidence=0.6,
                          probabilities={mild.id: 0.6, severe.id: 0.3, NONE: 0.1})
    jev = SimpleNamespace(system_one=lambda **_: SimpleNamespace(model="jev-test", choices={"situation": answer}))

    result = classify_urgency(jev, payload(), candidates, min_confidence=0.7)

    assert result.record is severe and result.escalated
    assert result.needs_human_review
