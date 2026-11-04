"""Atendimento: paciente descreve os sintomas -> enfermagem completa com sinais vitais -> médico fecha com a receita."""

from datetime import UTC, date, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from typesafe_sdk import TypeSafeClient

from src.api.converters import encounter_detail, encounter_summary
from src.api.deps import Config, Db, Jev
from src.api.patients import get_patient
from src.core.config import Settings
from src.db.models import (
    Classification,
    Encounter,
    HealthRecord,
    Medication,
    PatientMedication,
    Prescription,
    PrescriptionItem,
    SymptomUrgency,
    Triage,
    User,
    VitalSignsRecord,
)
from src.schemas import (
    EncounterCreate,
    EncounterDetail,
    EncounterStatus,
    EncounterSummary,
    NursingIn,
    PrescriptionIn,
    TriageRequest,
)
from src.services import medications as med_service
from src.services.encounters import LEVEL_PRIORITY, end_date, pick_presentation, triage_request
from src.services.triage import UrgencyResult, classify_urgency, retrieve_candidates

router = APIRouter(prefix="/encounters", tags=["atendimento"])


def get_encounter(db: Session, encounter_id: int) -> Encounter:
    encounter = db.get(Encounter, encounter_id)
    if not encounter:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atendimento não encontrado.")
    return encounter


def get_staff(db: Session, user_id: int, role: str) -> User:
    user = db.get(User, user_id)
    if not user or user.role != role:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuário sem permissão para esta etapa do atendimento.")
    return user


def patient_background(db: Session, patient_id: int):
    records = db.scalars(select(HealthRecord).where(HealthRecord.patient_id == patient_id)).all()
    meds = db.scalars(select(PatientMedication).where(PatientMedication.patient_id == patient_id)).all()
    return records, meds


def classify(db: Session, jev: TypeSafeClient, settings: Settings, request: TriageRequest,
             stage: str) -> tuple[Classification, UrgencyResult]:
    records = db.scalars(select(SymptomUrgency)).all()
    if not records:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Base de sintomas vazia.")
    result = classify_urgency(jev, request, retrieve_candidates(request, records), settings.min_confidence)
    classification = Classification(
        stage=stage,
        input=request.model_dump(mode="json", exclude_none=True),
        matched=result.matched,
        symptom_urgency_id=result.record.id if result.record else None,
        urgency_level=result.record.urgency_level if result.record else None,
        escalated=result.escalated,
        confidence=result.confidence,
        probabilities=result.probabilities,
        needs_human_review=result.needs_human_review,
        model=result.model,
    )
    return classification, result


@router.post("", response_model=EncounterDetail, status_code=status.HTTP_201_CREATED)
def create_encounter(payload: EncounterCreate, db: Db, jev: Jev, settings: Config):
    """Paciente: manda o que está sentindo e recebe a pré-análise (nível de urgência e para onde ir)."""
    patient = get_patient(db, payload.patient_id)
    encounter = Encounter(
        patient=patient,
        description=payload.description.strip(),
        symptoms=[s.strip() for s in payload.symptoms if s.strip()],
        onset=payload.onset,
        pain_score=payload.pain_score,
        pregnant=payload.pregnant,
    )
    records, meds = patient_background(db, patient.user_id)
    request = triage_request(encounter, patient, records, meds, date.today())
    classification, result = classify(db, jev, settings, request, "patient")

    encounter.classifications.append(classification)
    encounter.urgency_level = classification.urgency_level
    encounter.priority = LEVEL_PRIORITY.get(classification.urgency_level or "")
    encounter.needs_human_review = result.needs_human_review
    db.add(encounter)
    db.commit()
    return encounter_detail(encounter)


@router.get("", response_model=list[EncounterSummary])
def list_encounters(db: Db, status: EncounterStatus | None = None, patient_id: int | None = None):
    """Sem filtro traz todos. A fila da enfermagem e a do médico usam o status."""
    query = select(Encounter)
    if status:
        query = query.where(Encounter.status == status)
    if patient_id:
        query = query.where(Encounter.patient_id == patient_id)
    if status in ("waiting_nurse", "waiting_doctor"):
        # fila: mais grave primeiro e, no empate, quem chegou antes. Sem nível vai pro topo porque
        # o sistema não conseguiu classificar e alguém precisa olhar logo.
        query = query.order_by(Encounter.priority.asc().nulls_first(), Encounter.created_at)
    else:
        query = query.order_by(Encounter.created_at.desc())
    return [encounter_summary(e) for e in db.scalars(query).all()]


@router.get("/{encounter_id}", response_model=EncounterDetail)
def read_encounter(encounter_id: int, db: Db):
    return encounter_detail(get_encounter(db, encounter_id))


@router.post("/{encounter_id}/nursing", response_model=EncounterDetail)
def complete_nursing(encounter_id: int, payload: NursingIn, db: Db, jev: Jev, settings: Config):
    """Enfermagem: mede os sinais vitais, o JEV classifica de novo e o atendimento vai para o médico.
    Enquanto o médico não atendeu, dá para chamar de novo (retriagem); cada chamada vira uma triagem nova."""
    encounter = get_encounter(db, encounter_id)
    if encounter.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "O atendimento já foi finalizado pelo médico.")
    nurse = get_staff(db, payload.nurse_id, "ENFERMEIRO")

    records, meds = patient_background(db, encounter.patient_id)
    request = triage_request(encounter, encounter.patient, records, meds, date.today(),
                             vital_signs=payload.vital_signs, pain_score=payload.pain_score)
    classification, result = classify(db, jev, settings, request, "nursing")
    encounter.classifications.append(classification)

    vitals = VitalSignsRecord(
        patient_id=encounter.patient_id, encounter_id=encounter.id, recorded_by=nurse.id,
        pain_score=payload.pain_score, **payload.vital_signs.model_dump(),
    )
    # se a enfermagem escolheu outro nível, vale o dela. Se o JEV não achou nada, fica o nível que já estava
    level = payload.urgency_level or classification.urgency_level or encounter.urgency_level
    encounter.triages.append(Triage(
        nurse=nurse, vital_signs=vitals, classification=classification, urgency_level=level,
        override_reason=payload.override_reason.strip() if payload.urgency_level else None, notes=payload.notes,
    ))

    encounter.urgency_level = level
    encounter.priority = LEVEL_PRIORITY.get(level or "")
    encounter.needs_human_review = result.needs_human_review and not payload.urgency_level
    encounter.status = "waiting_doctor"
    db.commit()
    db.refresh(encounter)
    return encounter_detail(encounter)


@router.post("/{encounter_id}/prescription", response_model=EncounterDetail)
def complete_consultation(encounter_id: int, payload: PrescriptionIn, db: Db, jev: Jev, settings: Config):
    """Médico: registra o diagnóstico e a receita. Cada remédio escrito é procurado na base de bulas para o
    paciente conseguir ver o detalhe depois."""
    encounter = get_encounter(db, encounter_id)
    if encounter.status != "waiting_doctor":
        raise HTTPException(status.HTTP_409_CONFLICT, "Este atendimento não está aguardando o médico.")
    doctor = get_staff(db, payload.doctor_id, "MEDICO")
    today = date.today()
    base = db.scalars(select(Medication)).all()

    prescription = Prescription(
        encounter=encounter, patient_id=encounter.patient_id, doctor_id=doctor.id,
        diagnosis=payload.diagnosis.strip(), clinical_notes=payload.clinical_notes,
        recommendations=payload.recommendations,
    )
    ends = []
    for item in payload.items:
        found = med_service.lookup(jev, item.name, base, settings.min_confidence)
        med = pick_presentation(item.name, found.medications) if found.medications else None
        line = PrescriptionItem(
            written_name=item.name.strip(), medication=med, match_method=found.method, dosage=item.dosage,
            frequency=item.frequency, duration=item.duration, instructions=item.instructions,
        )
        prescription.items.append(line)
        # o remédio entra também no histórico do paciente, com o período calculado pela duração
        ends.append(end_date(today, item.duration))
        db.add(PatientMedication(
            patient_id=encounter.patient_id, name=line.written_name, dosage=item.dosage, frequency=item.frequency,
            started_on=today, ended_on=ends[-1], notes=item.instructions, prescription_item=line,
        ))

    # o diagnóstico vira um registro no histórico. Considero que acaba junto com o tratamento; se algum
    # remédio não tiver fim (uso contínuo), fica em aberto
    finished = ends and all(ends)
    db.add(HealthRecord(
        patient_id=encounter.patient_id, category="condition", description=prescription.diagnosis,
        started_on=today, ended_on=max(ends) if finished else None, encounter=encounter,
    ))

    db.add(prescription)
    encounter.doctor_id = doctor.id
    encounter.completed_at = datetime.now(UTC)
    encounter.status = "completed"
    db.commit()
    db.refresh(encounter)
    return encounter_detail(encounter)
