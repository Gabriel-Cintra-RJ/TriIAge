from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.converters import (
    encounter_summary,
    health_record_out,
    patient_medication_out,
    profile_out,
    vital_signs_out,
)
from src.api.deps import Db
from src.db.models import Encounter, HealthRecord, Patient, PatientMedication, VitalSignsRecord
from src.schemas import (
    HealthRecordIn,
    HealthRecordOut,
    PatientHistory,
    PatientMedicationIn,
    PatientMedicationOut,
    VitalSignsIn,
    VitalSignsOut,
)

router = APIRouter(prefix="/patients", tags=["paciente"])


def get_patient(db: Session, patient_id: int) -> Patient:
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paciente não encontrado.")
    return patient


@router.get("/{patient_id}/history", response_model=PatientHistory)
def history(patient_id: int, db: Db):
    """Tudo do paciente numa chamada só: cadastro, doenças/alergias/cirurgias, remédios, sinais vitais e atendimentos."""
    patient = get_patient(db, patient_id)
    records = db.scalars(
        select(HealthRecord).where(HealthRecord.patient_id == patient_id)
        .order_by(HealthRecord.started_on.desc().nulls_last(), HealthRecord.id.desc())
    ).all()
    meds = db.scalars(
        select(PatientMedication).where(PatientMedication.patient_id == patient_id)
        .order_by(PatientMedication.started_on.desc().nulls_last(), PatientMedication.id.desc())
    ).all()
    vitals = db.scalars(
        select(VitalSignsRecord).where(VitalSignsRecord.patient_id == patient_id)
        .order_by(VitalSignsRecord.recorded_at.desc())
    ).all()
    encounters = db.scalars(
        select(Encounter).where(Encounter.patient_id == patient_id).order_by(Encounter.created_at.desc())
    ).all()
    return PatientHistory(
        profile=profile_out(patient),
        health_records=[health_record_out(r) for r in records],
        medications=[patient_medication_out(m) for m in meds],
        vital_signs=[vital_signs_out(v) for v in vitals],
        encounters=[encounter_summary(e) for e in encounters],
    )


@router.post("/{patient_id}/health-records", response_model=HealthRecordOut, status_code=status.HTTP_201_CREATED)
def add_health_record(patient_id: int, payload: HealthRecordIn, db: Db):
    get_patient(db, patient_id)
    record = HealthRecord(patient_id=patient_id, **payload.model_dump())
    db.add(record)
    db.commit()
    return health_record_out(record)


@router.delete("/{patient_id}/health-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_health_record(patient_id: int, record_id: int, db: Db):
    record = db.get(HealthRecord, record_id)
    if not record or record.patient_id != patient_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro não encontrado.")
    # diagnóstico que veio de um atendimento é do médico, o paciente não apaga
    if record.encounter_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Diagnóstico registrado em atendimento não pode ser removido.")
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{patient_id}/medications", response_model=PatientMedicationOut, status_code=status.HTTP_201_CREATED)
def add_medication(patient_id: int, payload: PatientMedicationIn, db: Db):
    get_patient(db, patient_id)
    med = PatientMedication(patient_id=patient_id, **payload.model_dump())
    db.add(med)
    db.commit()
    return patient_medication_out(med)


@router.delete("/{patient_id}/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medication(patient_id: int, medication_id: int, db: Db):
    med = db.get(PatientMedication, medication_id)
    if not med or med.patient_id != patient_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Medicamento não encontrado.")
    if med.prescription_item_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Medicamento de receita não pode ser removido.")
    db.delete(med)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{patient_id}/vital-signs", response_model=VitalSignsOut, status_code=status.HTTP_201_CREATED)
def add_vital_signs(patient_id: int, payload: VitalSignsIn, db: Db):
    """Medição que o próprio paciente fez em casa (pressão, glicemia...)."""
    get_patient(db, patient_id)
    values = payload.model_dump(exclude={"recorded_by"})
    if all(v is None for v in values.values()):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Informe pelo menos uma medida.")
    vitals = VitalSignsRecord(patient_id=patient_id, recorded_by=payload.recorded_by, **values)
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    return vital_signs_out(vitals)
