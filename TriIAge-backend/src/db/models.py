"""Tabelas do banco como classes do SQLAlchemy.

Quem cria as tabelas de verdade é o database/init/01_schema.sql, quando o container do Postgres sobe
pela primeira vez. Por isso não chamamos create_all() aqui. Se mudar uma coluna lá, tem que mudar aqui também.
Os campos de lista ficam salvos como texto separado por "|", e o split_list transforma em lista.
"""

from datetime import date, datetime
from typing import Any

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def split_list(value: str | None) -> list[str]:
    return [item.strip() for item in (value or "").split("|") if item.strip()]


class SymptomUrgency(Base):
    __tablename__ = "symptom_urgency"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    main_symptom: Mapped[str]
    associated_symptoms: Mapped[str | None]
    description: Mapped[str]
    warning_signs: Mapped[str | None]
    aggravating_factors: Mapped[str | None]
    risk_groups: Mapped[str | None]
    age_groups: Mapped[str]
    urgency_level: Mapped[str] = mapped_column(String(30))
    priority: Mapped[int]
    guidance: Mapped[str]
    care_timeframe: Mapped[str]
    clinical_rationale: Mapped[str]
    source: Mapped[str]
    source_url: Mapped[str]
    reference_date: Mapped[date]


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str]
    active_ingredient: Mapped[str]
    brand_names: Mapped[str | None]
    pharmacological_class: Mapped[str]
    therapeutic_indications: Mapped[str]
    related_conditions: Mapped[str]
    indication_description: Mapped[str]
    mechanism_of_action: Mapped[str | None]
    dosage_form: Mapped[str]
    administration_routes: Mapped[str]
    contraindications: Mapped[str | None]
    warnings: Mapped[str | None]
    age_range: Mapped[str | None]
    leaflet_source: Mapped[str]
    source_url: Mapped[str]
    reference_date: Mapped[date]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str]
    role: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Patient(Base):
    __tablename__ = "patients"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    birth_date: Mapped[date]
    sex: Mapped[str | None] = mapped_column(String(5))
    blood_type: Mapped[str | None] = mapped_column(String(3))
    phone: Mapped[str | None]

    user: Mapped[User] = relationship(lazy="joined")


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.user_id"))
    status: Mapped[str] = mapped_column(String(20), default="waiting_nurse")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    description: Mapped[str]
    symptoms: Mapped[list[str]] = mapped_column(JSONB, default=list)
    onset: Mapped[str | None]
    pain_score: Mapped[int | None]
    pregnant: Mapped[bool] = mapped_column(default=False)
    urgency_level: Mapped[str | None] = mapped_column(String(30))
    priority: Mapped[int | None]
    needs_human_review: Mapped[bool] = mapped_column(default=True)
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime | None]

    patient: Mapped[Patient] = relationship(lazy="joined")
    doctor: Mapped[User | None] = relationship()
    classifications: Mapped[list["Classification"]] = relationship(order_by="Classification.id")
    triages: Mapped[list["Triage"]] = relationship(order_by="Triage.id")
    prescription: Mapped["Prescription | None"] = relationship(back_populates="encounter")


class Classification(Base):
    __tablename__ = "classifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    stage: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    input: Mapped[dict[str, Any]] = mapped_column(JSONB)
    matched: Mapped[bool]
    symptom_urgency_id: Mapped[str | None] = mapped_column(ForeignKey("symptom_urgency.id"))
    urgency_level: Mapped[str | None] = mapped_column(String(30))
    escalated: Mapped[bool] = mapped_column(default=False)
    confidence: Mapped[float | None]
    probabilities: Mapped[dict[str, float] | None] = mapped_column(JSONB)
    needs_human_review: Mapped[bool]
    model: Mapped[str | None] = mapped_column(String(50))
    origin: Mapped[str] = mapped_column(String(10), default="hybrid")
    model_level: Mapped[str | None] = mapped_column(String(30))
    rules_level: Mapped[str | None] = mapped_column(String(30))
    divergent: Mapped[bool] = mapped_column(default=False)
    decision_path: Mapped[list[str] | None] = mapped_column(JSONB)
    duration_ms: Mapped[int | None]

    record: Mapped[SymptomUrgency | None] = relationship(lazy="joined")


class VitalSignsRecord(Base):
    __tablename__ = "vital_signs"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.user_id"))
    encounter_id: Mapped[int | None] = mapped_column(ForeignKey("encounters.id"))
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    recorded_at: Mapped[datetime] = mapped_column(server_default=func.now())
    systolic_bp: Mapped[int | None]
    diastolic_bp: Mapped[int | None]
    heart_rate: Mapped[int | None]
    respiratory_rate: Mapped[int | None]
    temperature: Mapped[float | None]
    oxygen_saturation: Mapped[int | None]
    blood_glucose: Mapped[int | None]
    pain_score: Mapped[int | None]

    recorder: Mapped[User] = relationship(lazy="joined")


class Triage(Base):
    __tablename__ = "triages"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    nurse_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    vital_signs_id: Mapped[int] = mapped_column(ForeignKey("vital_signs.id"))
    classification_id: Mapped[int] = mapped_column(ForeignKey("classifications.id"))
    urgency_level: Mapped[str | None] = mapped_column(String(30))
    override_reason: Mapped[str | None]
    notes: Mapped[str | None]

    nurse: Mapped[User] = relationship(lazy="joined")
    vital_signs: Mapped[VitalSignsRecord] = relationship(lazy="joined")
    classification: Mapped[Classification] = relationship(lazy="joined")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.user_id"))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    diagnosis: Mapped[str]
    clinical_notes: Mapped[str | None]
    recommendations: Mapped[str | None]

    encounter: Mapped[Encounter] = relationship(back_populates="prescription")
    doctor: Mapped[User] = relationship(lazy="joined")
    items: Mapped[list["PrescriptionItem"]] = relationship(order_by="PrescriptionItem.id")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    prescription_id: Mapped[int] = mapped_column(ForeignKey("prescriptions.id"))
    written_name: Mapped[str]
    medication_id: Mapped[str | None] = mapped_column(ForeignKey("medications.id"))
    match_method: Mapped[str] = mapped_column(String(10))
    dosage: Mapped[str | None]
    frequency: Mapped[str | None]
    duration: Mapped[str | None]
    instructions: Mapped[str | None]

    medication: Mapped[Medication | None] = relationship(lazy="joined")


class HealthRecord(Base):
    __tablename__ = "health_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.user_id"))
    category: Mapped[str] = mapped_column(String(20))
    description: Mapped[str]
    started_on: Mapped[date | None]
    ended_on: Mapped[date | None]
    notes: Mapped[str | None]
    encounter_id: Mapped[int | None] = mapped_column(ForeignKey("encounters.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    encounter: Mapped[Encounter | None] = relationship()


class PatientMedication(Base):
    __tablename__ = "patient_medications"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.user_id"))
    name: Mapped[str]
    dosage: Mapped[str | None]
    frequency: Mapped[str | None]
    started_on: Mapped[date | None]
    ended_on: Mapped[date | None]
    notes: Mapped[str | None]
    prescription_item_id: Mapped[int | None] = mapped_column(ForeignKey("prescription_items.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    prescription_item: Mapped[PrescriptionItem | None] = relationship()
