from datetime import date

from src.db.models import Encounter, HealthRecord, Patient, PatientMedication
from src.schemas import VitalSigns
from src.services.encounters import age_on, end_date, pick_presentation, triage_request
from src.services.medications import find_by_name

TODAY = date(2026, 11, 4)


def patient(**overrides) -> Patient:
    return Patient(**({"user_id": 1, "birth_date": date(1981, 5, 14), "sex": "F"} | overrides))


def encounter(**overrides) -> Encounter:
    data = {"patient_id": 1, "description": "Dor de cabeça forte desde ontem", "symptoms": ["náusea"],
            "onset": "desde ontem", "pain_score": 7, "pregnant": False}
    return Encounter(**(data | overrides))


def test_age_counts_only_birthdays_already_passed():
    assert age_on(date(1981, 5, 14), TODAY) == 45
    assert age_on(date(1981, 12, 1), TODAY) == 44


def test_triage_request_uses_only_active_conditions_and_medications():
    records = [
        HealthRecord(category="condition", description="Hipertensão arterial", started_on=date(2019, 3, 1)),
        HealthRecord(category="condition", description="Faringite", started_on=date(2026, 9, 12),
                     ended_on=date(2026, 9, 18)),
        HealthRecord(category="allergy", description="Dipirona"),
    ]
    meds = [
        PatientMedication(name="Losartana potássica", dosage="50 mg"),
        PatientMedication(name="Amoxicilina 500 mg", ended_on=date(2026, 9, 18)),
    ]

    request = triage_request(encounter(), patient(), records, meds, TODAY)

    assert request.age == 45 and request.sex == "F"
    assert request.conditions == ["Hipertensão arterial"]
    assert request.allergies == ["Dipirona"]
    assert request.medications == ["Losartana potássica 50 mg"]
    assert request.pain_score == 7 and request.vital_signs is None


def test_nursing_values_replace_what_the_patient_said():
    vitals = VitalSigns(heart_rate=120, temperature=38.5)

    request = triage_request(encounter(), patient(), [], [], TODAY, vital_signs=vitals, pain_score=4)

    assert request.vital_signs == vitals
    assert request.pain_score == 4


def test_pregnancy_is_ignored_for_male_patients():
    request = triage_request(encounter(pregnant=True), patient(sex="M"), [], [], TODAY)

    assert request.pregnant is False


def test_end_date_from_duration_in_days_or_weeks():
    start = date(2026, 9, 12)

    assert end_date(start, "7 dias") == date(2026, 9, 18)
    assert end_date(start, "por 2 semanas") == date(2026, 9, 25)
    assert end_date(start, "uso contínuo") is None
    assert end_date(start, None) is None


def test_picks_the_presentation_with_the_written_strength(medication_records):
    found = find_by_name("Pantoprazol 40 mg", medication_records)

    assert "40 mg" in pick_presentation("Pantoprazol 40 mg", found).name


def test_without_strength_keeps_the_first_presentation(medication_records):
    found = find_by_name("pantoprazol", medication_records)

    assert pick_presentation("pantoprazol", found) is found[0]
