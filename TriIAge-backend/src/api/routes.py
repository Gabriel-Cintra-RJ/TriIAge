from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from typesafe_sdk import TypeSafeClient

from src.api.deps import get_jev
from src.core.config import Settings, get_settings
from src.db.models import Medication, SymptomUrgency, Triage, split_list
from src.db.session import get_db
from src.schemas import (
    MatchedRecord,
    MedicationLookupRequest,
    MedicationLookupResponse,
    MedicationOut,
    MedicationResult,
    MedicationSummary,
    TriageRequest,
    TriageResponse,
)
from src.services import medications as med_service
from src.services.triage import classify_urgency, retrieve_candidates

router = APIRouter()

Db = Annotated[Session, Depends(get_db)]
Jev = Annotated[TypeSafeClient, Depends(get_jev)]
Config = Annotated[Settings, Depends(get_settings)]

NO_MATCH_GUIDANCE = (
    "Não há informação suficiente na base para classificar este relato com segurança. Procure avaliação "
    "presencial de um profissional de saúde. Em caso de emergência, ligue 192 (SAMU)."
)
MESSAGES = {
    "name": "Encontrado na base de bulas.",
    "jev": "Correspondência identificada pelo JEV a partir do nome informado; confira se é o mesmo "
           "medicamento e a mesma apresentação da sua receita.",
    "none": "Não há informação suficiente na base sobre este medicamento. Consulte a bula ou um farmacêutico.",
}


@router.get("/health", tags=["infra"])
def health(db: Db) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.post("/triages", response_model=TriageResponse, status_code=status.HTTP_201_CREATED, tags=["pré-consulta"])
def create_triage(payload: TriageRequest, db: Db, jev: Jev, settings: Config):
    """Pré-consulta: a pessoa manda o relato e recebe o nível de urgência e para onde ir."""
    records = db.scalars(select(SymptomUrgency)).all()
    if not records:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Base de sintomas vazia.")

    result = classify_urgency(jev, payload, retrieve_candidates(payload, records), settings.min_confidence)
    record = result.record
    triage = Triage(
        input=payload.model_dump(mode="json"),
        matched=result.matched,
        symptom_urgency_id=record.id if record else None,
        urgency_level=record.urgency_level if record else None,
        escalated=result.escalated,
        confidence=result.confidence,
        probabilities=result.probabilities,
        needs_human_review=result.needs_human_review,
        model=result.model,
    )
    db.add(triage)
    db.commit()
    db.refresh(triage)

    return TriageResponse(
        id=triage.id,
        created_at=triage.created_at,
        matched=result.matched,
        urgency_level=record.urgency_level if record else None,
        priority=record.priority if record else None,
        guidance=record.guidance if record else NO_MATCH_GUIDANCE,
        care_timeframe=record.care_timeframe if record else None,
        warning_signs=split_list(record.warning_signs) if record else [],
        escalated=result.escalated,
        confidence=result.confidence,
        needs_human_review=result.needs_human_review,
        matched_record=MatchedRecord(
            id=record.id, main_symptom=record.main_symptom, description=record.description,
            warning_signs=split_list(record.warning_signs), clinical_rationale=record.clinical_rationale,
            source=record.source, source_url=record.source_url,
        ) if record else None,
        model=result.model,
    )


def _medication_out(med: Medication) -> MedicationOut:
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


@router.get("/medications", response_model=list[MedicationSummary], tags=["pós-consulta"])
def list_medications(db: Db):
    """Lista os remédios que temos na base. Pensei nisso para o autocompletar do front."""
    return [MedicationSummary(id=m.id, name=m.name, active_ingredient=m.active_ingredient, dosage_form=m.dosage_form)
            for m in db.scalars(select(Medication).order_by(Medication.name)).all()]


@router.post("/medications/lookup", response_model=MedicationLookupResponse, tags=["pós-consulta"])
def lookup_medications(payload: MedicationLookupRequest, db: Db, jev: Jev, settings: Config):
    """Pós-consulta: recebe os remédios da receita e devolve o que a bula diz de cada um."""
    meds = db.scalars(select(Medication)).all()
    results = []
    for query in payload.medications:
        found = med_service.lookup(jev, query, meds, settings.min_confidence)
        results.append(MedicationResult(
            query=query,
            found=bool(found.medications),
            match_method=found.method,
            confidence=found.confidence,
            medications=[_medication_out(m) for m in found.medications],
            message=MESSAGES[found.method],
        ))
    return MedicationLookupResponse(results=results)
