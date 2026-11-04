"""Regras do atendimento que não dependem de banco nem de HTTP (mesma ideia do triage.py, para testar fácil)."""

import re
from collections.abc import Sequence
from datetime import date, timedelta

from src.db.models import Encounter, HealthRecord, Medication, Patient, PatientMedication
from src.schemas import TriageRequest, VitalSigns

LEVEL_PRIORITY = {"emergency": 1, "very_urgent": 2, "urgent": 3, "less_urgent": 4, "guided_self_care": 5}


def age_on(birth_date: date, today: date) -> int:
    had_birthday = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return today.year - birth_date.year - (0 if had_birthday else 1)


def _active(ended_on: date | None, today: date) -> bool:
    return ended_on is None or ended_on >= today


def triage_request(
    encounter: Encounter,
    patient: Patient,
    records: Sequence[HealthRecord],
    medications: Sequence[PatientMedication],
    today: date,
    vital_signs: VitalSigns | None = None,
    pain_score: int | None = None,
) -> TriageRequest:
    """Junta o relato do atendimento com o histórico do paciente. Na etapa da enfermagem entram os sinais
    vitais e a dor que ela avaliou (se não avaliou, fica a que o paciente informou)."""
    return TriageRequest(
        age=age_on(patient.birth_date, today),
        sex=patient.sex,
        pregnant=encounter.pregnant and patient.sex == "F",
        description=encounter.description,
        symptoms=encounter.symptoms,
        onset=encounter.onset,
        pain_score=pain_score if pain_score is not None else encounter.pain_score,
        conditions=[r.description for r in records if r.category == "condition" and _active(r.ended_on, today)],
        allergies=[r.description for r in records if r.category == "allergy"],
        medications=[f"{m.name} {m.dosage or ''}".strip() for m in medications if _active(m.ended_on, today)],
        vital_signs=vital_signs,
    )


def end_date(start: date, duration: str | None) -> date | None:
    """ "7 dias" -> termina 6 dias depois do início (o primeiro dia conta). Se não der para entender, fica sem fim."""
    match = re.search(r"(\d+)\s*(dia|semana)", duration or "", re.IGNORECASE)
    if not match:
        return None
    days = int(match.group(1)) * (7 if match.group(2).lower() == "semana" else 1)
    return start + timedelta(days=days - 1)


def pick_presentation(written: str, meds: Sequence[Medication]) -> Medication:
    """Quando o remédio tem mais de uma apresentação na base, tenta pegar a da dose que o médico escreveu."""
    numbers = set(re.findall(r"\d+", written))
    for med in meds:
        if numbers & set(re.findall(r"\d+", f"{med.name} {med.dosage_form}")):
            return med
    return meds[0]
