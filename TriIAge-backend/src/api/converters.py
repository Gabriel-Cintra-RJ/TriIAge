"""Transforma as linhas do banco nas respostas da API (schemas.py). Fica separado para as rotas não ficarem enormes."""

from datetime import date

from src.db.models import (
    Classification,
    Encounter,
    HealthRecord,
    Medication,
    Patient,
    PatientMedication,
    Prescription,
    Triage,
    VitalSignsRecord,
    split_list,
)
from src.schemas import (
    ClassificationOut,
    EncounterDetail,
    EncounterSummary,
    HealthRecordOut,
    MatchedRecord,
    MedicationOut,
    PatientMedicationOut,
    PatientProfile,
    PrescriptionItemOut,
    PrescriptionOut,
    TriageOut,
    VitalSignsOut,
)
from src.services.encounters import LEVEL_PRIORITY, age_on

NO_MATCH_GUIDANCE = (
    "Não há informação suficiente na base para classificar este relato com segurança. Procure avaliação "
    "presencial de um profissional de saúde. Em caso de emergência, ligue 192 (SAMU)."
)


def medication_out(med: Medication) -> MedicationOut:
    return MedicationOut(
        id=med.id, name=med.name, active_ingredient=med.active_ingredient,
        brand_names=split_list(med.brand_names), pharmacological_class=med.pharmacological_class,
        therapeutic_indications=split_list(med.therapeutic_indications),
        related_conditions=split_list(med.related_conditions), indication_description=med.indication_description,
        mechanism_of_action=med.mechanism_of_action, dosage_form=med.dosage_form,
        administration_routes=split_list(med.administration_routes),
        contraindications=split_list(med.contraindications), warnings=split_list(med.warnings),
        age_range=med.age_range, leaflet_source=med.leaflet_source, source_url=med.source_url,
    )


def profile_out(patient: Patient) -> PatientProfile:
    return PatientProfile(
        id=patient.user_id, name=patient.user.name, email=patient.user.email, birth_date=patient.birth_date,
        age=age_on(patient.birth_date, date.today()), sex=patient.sex, blood_type=patient.blood_type,
        phone=patient.phone,
    )


def health_record_out(record: HealthRecord) -> HealthRecordOut:
    return HealthRecordOut(
        id=record.id, category=record.category, description=record.description, started_on=record.started_on,
        ended_on=record.ended_on, notes=record.notes, encounter_id=record.encounter_id, created_at=record.created_at,
    )


def patient_medication_out(med: PatientMedication) -> PatientMedicationOut:
    return PatientMedicationOut(
        id=med.id, name=med.name, dosage=med.dosage, frequency=med.frequency, started_on=med.started_on,
        ended_on=med.ended_on, notes=med.notes, prescription_item_id=med.prescription_item_id,
        created_at=med.created_at,
    )


def vital_signs_out(v: VitalSignsRecord) -> VitalSignsOut:
    return VitalSignsOut(
        id=v.id, recorded_at=v.recorded_at, encounter_id=v.encounter_id, recorded_by_name=v.recorder.name,
        source="patient" if v.recorded_by == v.patient_id else "hospital",
        systolic_bp=v.systolic_bp, diastolic_bp=v.diastolic_bp, heart_rate=v.heart_rate,
        respiratory_rate=v.respiratory_rate, temperature=v.temperature, oxygen_saturation=v.oxygen_saturation,
        blood_glucose=v.blood_glucose, pain_score=v.pain_score,
    )


def classification_out(c: Classification) -> ClassificationOut:
    record = c.record
    return ClassificationOut(
        stage=c.stage,
        created_at=c.created_at,
        matched=c.matched,
        urgency_level=record.urgency_level if record else None,
        priority=record.priority if record else None,
        guidance=record.guidance if record else NO_MATCH_GUIDANCE,
        care_timeframe=record.care_timeframe if record else None,
        warning_signs=split_list(record.warning_signs) if record else [],
        escalated=c.escalated,
        confidence=c.confidence,
        needs_human_review=c.needs_human_review,
        matched_record=MatchedRecord(
            id=record.id, main_symptom=record.main_symptom, description=record.description,
            warning_signs=split_list(record.warning_signs), clinical_rationale=record.clinical_rationale,
            source=record.source, source_url=record.source_url,
        ) if record else None,
        model=c.model,
    )


def prescription_out(p: Prescription) -> PrescriptionOut:
    return PrescriptionOut(
        id=p.id, created_at=p.created_at, doctor_name=p.doctor.name, diagnosis=p.diagnosis,
        clinical_notes=p.clinical_notes, recommendations=p.recommendations,
        items=[
            PrescriptionItemOut(
                id=i.id, written_name=i.written_name, dosage=i.dosage, frequency=i.frequency, duration=i.duration,
                instructions=i.instructions, match_method=i.match_method,
                medication=medication_out(i.medication) if i.medication else None,
            )
            for i in p.items
        ],
    )


def _summary_fields(e: Encounter) -> dict:
    return dict(
        id=e.id, created_at=e.created_at, status=e.status, patient_id=e.patient_id,
        patient_name=e.patient.user.name, patient_age=age_on(e.patient.birth_date, e.created_at.date()),
        description=e.description, urgency_level=e.urgency_level, priority=e.priority,
        needs_human_review=e.needs_human_review, triage_count=len(e.triages),
        diagnosis=e.prescription.diagnosis if e.prescription else None,
    )


def encounter_summary(e: Encounter) -> EncounterSummary:
    return EncounterSummary(**_summary_fields(e))


def triage_out(t: Triage) -> TriageOut:
    return TriageOut(
        id=t.id, created_at=t.created_at, nurse_name=t.nurse.name, urgency_level=t.urgency_level,
        priority=LEVEL_PRIORITY.get(t.urgency_level or ""), override_reason=t.override_reason, notes=t.notes,
        vital_signs=vital_signs_out(t.vital_signs), classification=classification_out(t.classification),
    )


def encounter_detail(e: Encounter) -> EncounterDetail:
    pre = next((c for c in e.classifications if c.stage == "patient"), None)
    return EncounterDetail(
        **_summary_fields(e),
        symptoms=e.symptoms, onset=e.onset, pain_score=e.pain_score, pregnant=e.pregnant,
        patient=profile_out(e.patient),
        pre_analysis=classification_out(pre) if pre else None,
        triages=[triage_out(t) for t in e.triages],
        doctor_name=e.doctor.name if e.doctor else None,
        completed_at=e.completed_at,
        prescription=prescription_out(e.prescription) if e.prescription else None,
    )
