"""Tabelas do banco como classes do SQLAlchemy.

Quem cria as tabelas de verdade é o database/init/01_schema.sql, quando o container do Postgres sobe
pela primeira vez. Por isso não chamamos create_all() aqui. Se mudar uma coluna lá, tem que mudar aqui também.
Os campos de lista ficam salvos como texto separado por "|", e o split_list transforma em lista.
"""

from datetime import date, datetime
from typing import Any

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


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


class Triage(Base):
    __tablename__ = "triages"

    id: Mapped[int] = mapped_column(primary_key=True)
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
