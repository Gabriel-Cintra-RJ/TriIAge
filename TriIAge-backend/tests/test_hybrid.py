from types import SimpleNamespace

from typesafe_sdk import TypeSafeAPIConnectionError, TypeSafeAPITimeoutError

from src.schemas import TriageRequest, VitalSigns
from src.services.hybrid import classify_hybrid
from src.services.triage import NONE
from tests.conftest import FakeJev

CHEST_PAIN = TriageRequest(age=58, description="Dor no peito há 30 minutos, com falta de ar e suor frio")


def tier(records, complaint, level):
    return next(r for r in records if r.main_symptom == complaint and r.urgency_level == level)


def broken_jev(error):
    def fail(**_):
        raise error
    return SimpleNamespace(system_one=fail)


def test_model_unavailable_falls_back_to_the_tree(symptom_records):
    result = classify_hybrid(broken_jev(TypeSafeAPIConnectionError("fora do ar")), CHEST_PAIN, symptom_records, 0.7)

    assert result.origin == "rules"
    assert result.record.urgency_level == "emergency"
    assert result.needs_human_review and result.model_level is None


def test_timeout_also_falls_back_to_the_tree(symptom_records):
    result = classify_hybrid(broken_jev(TypeSafeAPITimeoutError(10.0)), CHEST_PAIN, symptom_records, 0.7)

    assert result.origin == "rules" and result.matched


def test_when_they_disagree_the_most_urgent_wins(symptom_records):
    mild = tier(symptom_records, "Dor no peito", "urgent")
    jev = FakeJev(pick=lambda criteria: mild.id, confidence=0.9)

    result = classify_hybrid(jev, CHEST_PAIN, symptom_records, 0.7)

    assert result.origin == "hybrid" and result.divergent
    assert result.model_level == "urgent" and result.rules_level == "emergency"
    assert result.record.urgency_level == "emergency"
    assert not result.needs_human_review


def test_agreement_is_not_flagged(symptom_records):
    severe = tier(symptom_records, "Dor no peito", "emergency")
    result = classify_hybrid(FakeJev(pick=lambda criteria: severe.id), CHEST_PAIN, symptom_records, 0.7)

    assert not result.divergent and result.record is severe


def test_tree_answers_when_the_model_finds_nothing(symptom_records):
    result = classify_hybrid(FakeJev(pick=lambda criteria: NONE), CHEST_PAIN, symptom_records, 0.7)

    assert result.matched and result.record.urgency_level == "emergency"
    assert result.divergent and result.model_level is None


def test_normal_vitals_stop_the_tree_from_overriding_a_confident_model(symptom_records):
    # o caso do teste na aplicação: relato de "febre alta", mas na triagem a temperatura estava normal
    vitals = VitalSigns(temperature=36.5, heart_rate=70, systolic_bp=121, diastolic_bp=80, oxygen_saturation=99)
    payload = TriageRequest(age=30, description="Dor de garganta e febre alta", symptoms=["Febre", "Tosse"],
                            vital_signs=vitals)
    mild = tier(symptom_records, "Dor de garganta", "urgent")

    result = classify_hybrid(FakeJev(pick=lambda criteria: mild.id, confidence=0.96), payload, symptom_records, 0.7)

    assert result.record.urgency_level == "urgent"


def test_nothing_in_the_base_stays_unclassified(symptom_records):
    payload = TriageRequest(age=30, description="quero renovar minha carteirinha do plano")
    jev = FakeJev(pick=lambda criteria: NONE)

    result = classify_hybrid(jev, payload, symptom_records, 0.7)

    assert not result.matched and result.record is None
    assert jev.calls == []  # sem candidatas nem chega a chamar o JEV
