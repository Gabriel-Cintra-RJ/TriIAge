from fastapi import APIRouter
from sqlalchemy import select, text

from src.api.converters import medication_out
from src.api.deps import Config, Db, Jev
from src.db.models import Medication
from src.schemas import (
    MedicationLookupRequest,
    MedicationLookupResponse,
    MedicationResult,
    MedicationSummary,
)
from src.services import medications as med_service

router = APIRouter()

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


@router.get("/medications", response_model=list[MedicationSummary], tags=["pós-consulta"])
def list_medications(db: Db):
    """Lista os remédios que temos na base. O front usa para sugerir nomes na hora de escrever a receita."""
    return [MedicationSummary(id=m.id, name=m.name, active_ingredient=m.active_ingredient, dosage_form=m.dosage_form)
            for m in db.scalars(select(Medication).order_by(Medication.name)).all()]


@router.post("/medications/lookup", response_model=MedicationLookupResponse, tags=["pós-consulta"])
def lookup_medications(payload: MedicationLookupRequest, db: Db, jev: Jev, settings: Config):
    """Recebe nomes de remédios e devolve o que a bula diz de cada um."""
    meds = db.scalars(select(Medication)).all()
    results = []
    for query in payload.medications:
        found = med_service.lookup(jev, query, meds, settings.min_confidence)
        results.append(MedicationResult(
            query=query,
            found=bool(found.medications),
            match_method=found.method,
            confidence=found.confidence,
            medications=[medication_out(m) for m in found.medications],
            message=MESSAGES[found.method],
        ))
    return MedicationLookupResponse(results=results)
