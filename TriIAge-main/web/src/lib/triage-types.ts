// Contrato da API (FastAPI). É o espelho dos schemas do Pydantic em TriIAge-backend/src/schemas.py,
// então se mudar um campo lá, tem que mudar aqui também.

export type Sex = "M" | "F" | "other";

export type UrgencyLevel = "emergency" | "very_urgent" | "urgent" | "less_urgent" | "guided_self_care";

export type VitalSigns = {
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: number;
  oxygen_saturation?: number;
};

// ---------- pré-consulta (POST /triages) ----------

export type TriageInput = {
  age: number;
  sex?: Sex;
  pregnant: boolean;
  /** relato livre, nas palavras do paciente */
  description: string;
  symptoms: string[];
  /** doenças que a pessoa já tem (diabetes, hipertensão...) */
  conditions: string[];
  vital_signs?: VitalSigns;
};

export type MatchedRecord = {
  id: string;
  main_symptom: string;
  description: string;
  warning_signs: string[];
  clinical_rationale: string;
  source: string;
  source_url: string;
};

export type TriageResult = {
  id: number;
  created_at: string;
  /** false = a base não tinha informação suficiente para classificar */
  matched: boolean;
  urgency_level: UrgencyLevel | null;
  /** 1 = mais urgente ... 5 = menos urgente */
  priority: number | null;
  guidance: string;
  care_timeframe: string | null;
  warning_signs: string[];
  /** true quando a API subiu o nível porque uma opção mais grave também era plausível */
  escalated: boolean;
  confidence: number | null;
  needs_human_review: boolean;
  matched_record: MatchedRecord | null;
  model: string | null;
  disclaimer: string;
};

// ---------- pós-consulta (POST /medications/lookup) ----------

export type Medication = {
  id: string;
  name: string;
  active_ingredient: string;
  brand_names: string[];
  pharmacological_class: string;
  therapeutic_indications: string[];
  related_conditions: string[];
  indication_description: string;
  mechanism_of_action: string | null;
  dosage_form: string;
  administration_routes: string[];
  contraindications: string[];
  warnings: string[];
  age_range: string | null;
  leaflet_source: string;
  source_url: string;
};

export type MedicationResult = {
  query: string;
  found: boolean;
  match_method: "name" | "jev" | "none";
  confidence: number | null;
  medications: Medication[];
  message: string;
};

export type MedicationLookupResult = {
  results: MedicationResult[];
  disclaimer: string;
};

export type MedicationSummary = {
  id: string;
  name: string;
  active_ingredient: string;
  dosage_form: string;
};

export type HealthStatus = {
  status: string;
};
