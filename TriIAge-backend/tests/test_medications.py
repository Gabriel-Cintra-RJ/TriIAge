from src.services.medications import NONE, find_by_name, lookup
from tests.conftest import FakeJev

NEVER = FakeJev(pick=lambda criteria: NONE)


def test_finds_by_active_ingredient_ignoring_salt_and_strength(medication_records):
    found = find_by_name("Sertralina 50mg", medication_records)

    assert [m.active_ingredient.lower() for m in found] == ["cloridrato de sertralina"]


def test_combination_does_not_return_the_single_ingredient(medication_records):
    found = find_by_name("amoxicilina + clavulanato de potássio", medication_records)

    assert found and all("clavulanato" in m.active_ingredient.lower() for m in found)


def test_returns_all_presentations_with_different_indications(medication_records):
    found = find_by_name("pantoprazol", medication_records)

    assert len(found) == 2


def test_name_match_does_not_call_jev(medication_records):
    jev = FakeJev(pick=lambda criteria: NONE)
    result = lookup(jev, "dipirona", medication_records, min_confidence=0.7)

    assert result.method == "name" and result.medications and jev.calls == []


def test_unknown_name_falls_back_to_jev(medication_records):
    target = next(m for m in medication_records if "losartana" in m.active_ingredient.lower())
    jev = FakeJev(pick=lambda criteria: target.id)

    result = lookup(jev, "lozartan", medication_records, min_confidence=0.7)

    assert result.method == "jev" and result.medications == [target]


def test_no_reliable_match_returns_nothing(medication_records):
    result = lookup(NEVER, "remédio xyz", medication_records, min_confidence=0.7)

    assert result.method == "none" and result.medications == []


def test_low_confidence_jev_match_is_rejected(medication_records):
    target = medication_records[0]
    result = lookup(FakeJev(pick=lambda c: target.id, confidence=0.4), "abc", medication_records, min_confidence=0.7)

    assert result.method == "none"
