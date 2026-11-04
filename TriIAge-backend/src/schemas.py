from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

DISCLAIMER = (
    "Informação de apoio, baseada em publicações do Ministério da Saúde e em bulas aprovadas pela Anvisa. "
    "Não é diagnóstico nem substitui a avaliação de um profissional de saúde. Em emergência, ligue 192 (SAMU)."
)

UrgencyLevel = Literal["emergency", "very_urgent", "urgent", "less_urgent", "guided_self_care"]
Role = Literal["PACIENTE", "RECEPCIONISTA", "ENFERMEIRO", "MEDICO", "AUDITOR", "GESTOR_CLINICO"]
Sex = Literal["F", "M", "other"]
EncounterStatus = Literal["waiting_nurse", "waiting_doctor", "completed"]


# ---------- classificação (sintomas -> urgência) ----------

class VitalSigns(BaseModel):
    systolic_bp: int | None = Field(None, ge=0, le=300)
    diastolic_bp: int | None = Field(None, ge=0, le=200)
    heart_rate: int | None = Field(None, ge=0, le=300)
    respiratory_rate: int | None = Field(None, ge=0, le=100)
    temperature: float | None = Field(None, ge=25, le=45)
    oxygen_saturation: int | None = Field(None, ge=0, le=100)
    blood_glucose: int | None = Field(None, ge=10, le=1000, description="Glicemia capilar em mg/dL")


class TriageRequest(BaseModel):
    """O que vai para o JEV. A API monta isso juntando o relato do atendimento com o cadastro do paciente."""

    age: int = Field(ge=0, le=130)
    sex: Sex | None = None
    pregnant: bool = False
    description: str = Field(min_length=3, max_length=2000, description="Relato livre do que a pessoa está sentindo")
    symptoms: list[str] = Field(default_factory=list, max_length=20, description="Sintomas em texto livre")
    conditions: list[str] = Field(default_factory=list, max_length=20, description="Doenças prévias (ex.: diabetes)")
    onset: str | None = Field(None, max_length=100, description="Desde quando está sentindo")
    pain_score: int | None = Field(None, ge=0, le=10)
    medications: list[str] = Field(default_factory=list, description="Remédios que a pessoa usa hoje")
    allergies: list[str] = Field(default_factory=list)
    vital_signs: VitalSigns | None = None


class MatchedRecord(BaseModel):
    id: str
    main_symptom: str
    description: str
    warning_signs: list[str]
    clinical_rationale: str
    source: str
    source_url: str


class ClassificationOut(BaseModel):
    stage: Literal["patient", "nursing"]
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
    origin: Literal["hybrid", "rules"] = Field(description="rules = o JEV falhou e valeu só a árvore de decisão")
    divergent: bool = Field(description="A árvore e o JEV deram níveis diferentes (prevaleceu o mais urgente)")
    model_level: UrgencyLevel | None
    rules_level: UrgencyLevel | None
    decision_path: list[str]
    duration_ms: int | None


# ---------- usuários e pacientes ----------

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: Role


class PatientProfile(BaseModel):
    id: int
    name: str
    email: str
    birth_date: date
    age: int
    sex: Sex | None
    blood_type: str | None
    phone: str | None


class HealthRecordIn(BaseModel):
    category: Literal["condition", "allergy", "surgery"]
    description: str = Field(min_length=2, max_length=200)
    started_on: date | None = None
    ended_on: date | None = None
    notes: str | None = Field(None, max_length=500)


class HealthRecordOut(HealthRecordIn):
    id: int
    encounter_id: int | None
    created_at: datetime


class PatientMedicationIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    dosage: str | None = Field(None, max_length=100)
    frequency: str | None = Field(None, max_length=100, description="Intervalo entre as doses (ex.: de 8 em 8 horas)")
    started_on: date | None = None
    ended_on: date | None = None
    notes: str | None = Field(None, max_length=500)


class PatientMedicationOut(PatientMedicationIn):
    id: int
    prescription_item_id: int | None
    created_at: datetime


class VitalSignsIn(VitalSigns):
    recorded_by: int
    pain_score: int | None = Field(None, ge=0, le=10)


class VitalSignsOut(VitalSigns):
    id: int
    recorded_at: datetime
    encounter_id: int | None
    recorded_by_name: str
    pain_score: int | None
    source: Literal["patient", "hospital"]


class EncounterSummary(BaseModel):
    id: int
    created_at: datetime
    status: EncounterStatus
    patient_id: int
    patient_name: str
    patient_age: int
    description: str
    urgency_level: UrgencyLevel | None
    priority: int | None
    needs_human_review: bool
    triage_count: int
    diagnosis: str | None


class PatientHistory(BaseModel):
    profile: PatientProfile
    health_records: list[HealthRecordOut]
    medications: list[PatientMedicationOut]
    vital_signs: list[VitalSignsOut]
    encounters: list[EncounterSummary]


# ---------- atendimento ----------

class EncounterCreate(BaseModel):
    patient_id: int
    description: str = Field(min_length=3, max_length=2000)
    symptoms: list[str] = Field(default_factory=list, max_length=20)
    onset: str | None = Field(None, max_length=100)
    pain_score: int | None = Field(None, ge=0, le=10)
    pregnant: bool = False


class NursingIn(BaseModel):
    nurse_id: int
    vital_signs: VitalSigns
    pain_score: int | None = Field(None, ge=0, le=10)
    notes: str | None = Field(None, max_length=2000)
    urgency_level: UrgencyLevel | None = Field(None, description="Só quando a enfermagem quer outro nível")
    override_reason: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def reason_required_for_override(self):
        # mudar o nível do sistema sem explicar não pode (RF07 do documento)
        if self.urgency_level and len((self.override_reason or "").strip()) < 10:
            raise ValueError("Para mudar o nível, escreva a justificativa (mínimo 10 caracteres).")
        return self


class PrescriptionItemIn(BaseModel):
    name: str = Field(min_length=2, max_length=200, description="Nome do remédio como o médico escreveu")
    dosage: str | None = Field(None, max_length=100)
    frequency: str | None = Field(None, max_length=100)
    duration: str | None = Field(None, max_length=100)
    instructions: str | None = Field(None, max_length=500)


class PrescriptionIn(BaseModel):
    doctor_id: int
    diagnosis: str = Field(min_length=3, max_length=500)
    clinical_notes: str | None = Field(None, max_length=4000)
    recommendations: str | None = Field(None, max_length=4000)
    items: list[PrescriptionItemIn] = Field(default_factory=list, max_length=20)


class TriageOut(BaseModel):
    id: int
    created_at: datetime
    nurse_name: str
    urgency_level: UrgencyLevel | None = Field(description="Nível que valeu nessa triagem")
    priority: int | None
    override_reason: str | None
    notes: str | None
    vital_signs: VitalSignsOut
    classification: ClassificationOut


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


class PrescriptionItemOut(BaseModel):
    id: int
    written_name: str
    dosage: str | None
    frequency: str | None
    duration: str | None
    instructions: str | None
    match_method: Literal["name", "jev", "none"]
    medication: MedicationOut | None


class PrescriptionOut(BaseModel):
    id: int
    created_at: datetime
    doctor_name: str
    diagnosis: str
    clinical_notes: str | None
    recommendations: str | None
    items: list[PrescriptionItemOut]


class EncounterDetail(EncounterSummary):
    symptoms: list[str]
    onset: str | None
    pain_score: int | None
    pregnant: bool
    patient: PatientProfile
    pre_analysis: ClassificationOut | None
    triages: list[TriageOut] = Field(description="Da mais antiga para a mais nova; a última é a que vale")
    doctor_name: str | None
    completed_at: datetime | None
    prescription: PrescriptionOut | None
    disclaimer: str = DISCLAIMER


# ---------- painel inicial ----------

class ModelStats(BaseModel):
    classifications: int
    unmatched: int
    escalated: int
    needs_review: int
    avg_confidence: float | None
    overrides: int = Field(description="Triagens em que a enfermagem mudou o nível do sistema")
    rules_fallback: int = Field(description="Classificações feitas só pela árvore porque o JEV falhou")
    divergent: int = Field(description="Classificações em que a árvore e o JEV discordaram")


class DashboardOut(BaseModel):
    waiting_nurse: int
    waiting_doctor: int
    critical_waiting: int = Field(description="Emergência ou muito urgente ainda sem consulta")
    review_waiting: int = Field(description="Sem consulta e com confiança baixa do JEV")
    oldest_waiting_since: datetime | None = Field(description="Chegada de quem espera a triagem há mais tempo")
    created_today: int
    completed_today: int
    triages_today: int
    retriages_today: int
    mine_today: int = Field(description="Triagens (enfermagem) ou consultas (médico) do usuário hoje")
    by_level: dict[str, int] = Field(description="Atendimentos dos últimos 30 dias pelo nível atual")
    model: ModelStats
