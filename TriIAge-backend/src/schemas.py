from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DISCLAIMER = (
    "Informação de apoio, baseada em publicações do Ministério da Saúde e em bulas aprovadas pela Anvisa. "
    "Não é diagnóstico nem substitui a avaliação de um profissional de saúde. Em emergência, ligue 192 (SAMU)."
)

UrgencyLevel = Literal["emergency", "very_urgent", "urgent", "less_urgent", "guided_self_care"]


# ---------- pré-consulta (sintomas -> urgência) ----------

class VitalSigns(BaseModel):
    systolic_bp: int | None = Field(None, ge=0, le=300)
    diastolic_bp: int | None = Field(None, ge=0, le=200)
    heart_rate: int | None = Field(None, ge=0, le=300)
    respiratory_rate: int | None = Field(None, ge=0, le=100)
    temperature: float | None = Field(None, ge=25, le=45)
    oxygen_saturation: int | None = Field(None, ge=0, le=100)


class TriageRequest(BaseModel):
    age: int = Field(ge=0, le=130)
    sex: Literal["F", "M", "other"] | None = None
    pregnant: bool = False
    description: str = Field(min_length=3, max_length=2000, description="Relato livre do que a pessoa está sentindo")
    symptoms: list[str] = Field(default_factory=list, max_length=20, description="Sintomas em texto livre")
    conditions: list[str] = Field(default_factory=list, max_length=20, description="Doenças prévias (ex.: diabetes)")
    vital_signs: VitalSigns | None = None


class MatchedRecord(BaseModel):
    id: str
    main_symptom: str
    description: str
    warning_signs: list[str]
    clinical_rationale: str
    source: str
    source_url: str


class TriageResponse(BaseModel):
    id: int
    created_at: datetime
    matched: bool
    urgency_level: UrgencyLevel | None
    priority: int | None = Field(None, description="1 = mais urgente, 5 = menos urgente")
    guidance: str
    care_timeframe: str | None
    warning_signs: list[str]
    escalated: bool = Field(description="True quando o nível foi elevado por uma alternativa mais grave e plausível")
    confidence: float | None
    needs_human_review: bool
    matched_record: MatchedRecord | None
    model: str | None
    disclaimer: str = DISCLAIMER


# ---------- pós-consulta (remédios -> o que diz a bula) ----------

class MedicationLookupRequest(BaseModel):
    medications: list[str] = Field(min_length=1, max_length=20, description="Nomes como estão na receita")


class MedicationOut(BaseModel):
    id: str
    name: str
    active_ingredient: str
    brand_names: list[str]
    pharmacological_class: str
    therapeutic_indications: list[str]
    related_conditions: list[str]
    indication_description: str
    mechanism_of_action: str | None
    dosage_form: str
    administration_routes: list[str]
    contraindications: list[str]
    warnings: list[str]
    age_range: str | None
    leaflet_source: str
    source_url: str


class MedicationResult(BaseModel):
    query: str
    found: bool
    match_method: Literal["name", "jev", "none"]
    confidence: float | None = None
    medications: list[MedicationOut] = Field(description="Pode haver mais de uma apresentação para o mesmo nome")
    message: str


class MedicationLookupResponse(BaseModel):
    results: list[MedicationResult]
    disclaimer: str = DISCLAIMER


class MedicationSummary(BaseModel):
    id: str
    name: str
    active_ingredient: str
    dosage_form: str
