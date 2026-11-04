// Contrato da API (FastAPI). É o espelho dos schemas do Pydantic em TriIAge-backend/src/schemas.py,
// então se mudar um campo lá, tem que mudar aqui também.

import type { Role } from "./roles";

export type Sex = "M" | "F" | "other";

export type UrgencyLevel = "emergency" | "very_urgent" | "urgent" | "less_urgent" | "guided_self_care";

export type EncounterStatus = "waiting_nurse" | "waiting_doctor" | "completed";

export type VitalSigns = {
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: number;
  oxygen_saturation?: number;
  /** glicemia capilar (mg/dL) */
  blood_glucose?: number;
};

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

// ---------- paciente ----------

export type PatientProfile = {
  id: number;
  name: string;
  email: string;
  birth_date: string;
  age: number;
  sex: Sex | null;
  blood_type: string | null;
  phone: string | null;
};

export type HealthCategory = "condition" | "allergy" | "surgery";

export type HealthRecordInput = {
  category: HealthCategory;
  description: string;
  started_on?: string;
  ended_on?: string;
  notes?: string;
};

export type HealthRecord = {
  id: number;
  category: HealthCategory;
  description: string;
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  /** preenchido quando o registro veio de um diagnóstico médico */
  encounter_id: number | null;
  created_at: string;
};

export type PatientMedicationInput = {
  name: string;
  dosage?: string;
  frequency?: string;
  started_on?: string;
  ended_on?: string;
  notes?: string;
};

export type PatientMedication = {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  /** preenchido quando o remédio veio de uma receita */
  prescription_item_id: number | null;
  created_at: string;
};

export type VitalSignsRecord = VitalSigns & {
  id: number;
  recorded_at: string;
  encounter_id: number | null;
  recorded_by_name: string;
  pain_score: number | null;
  source: "patient" | "hospital";
};

export type EncounterSummary = {
  id: number;
  created_at: string;
  status: EncounterStatus;
  patient_id: number;
  patient_name: string;
  patient_age: number;
  description: string;
  urgency_level: UrgencyLevel | null;
  priority: number | null;
  needs_human_review: boolean;
  triage_count: number;
  diagnosis: string | null;
};

export type PatientHistory = {
  profile: PatientProfile;
  health_records: HealthRecord[];
  medications: PatientMedication[];
  vital_signs: VitalSignsRecord[];
  encounters: EncounterSummary[];
};

// ---------- atendimento ----------

export type EncounterInput = {
  description: string;
  symptoms: string[];
  onset?: string;
  pain_score?: number;
  pregnant: boolean;
};

export type NursingInput = {
  vital_signs: VitalSigns;
  pain_score?: number;
  notes?: string;
  /** só quando a enfermagem escolhe outro nível */
  urgency_level?: UrgencyLevel;
  override_reason?: string;
};

export type PrescriptionItemInput = {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

export type PrescriptionInput = {
  diagnosis: string;
  clinical_notes?: string;
  recommendations?: string;
  items: PrescriptionItemInput[];
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

export type Classification = {
  stage: "patient" | "nursing";
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
};

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

export type PrescriptionItem = {
  id: number;
  written_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  match_method: "name" | "jev" | "none";
  medication: Medication | null;
};

export type Prescription = {
  id: number;
  created_at: string;
  doctor_name: string;
  diagnosis: string;
  clinical_notes: string | null;
  recommendations: string | null;
  items: PrescriptionItem[];
};

export type Triage = {
  id: number;
  created_at: string;
  nurse_name: string;
  /** nível que valeu nessa triagem (do JEV ou escolhido pela enfermagem) */
  urgency_level: UrgencyLevel | null;
  priority: number | null;
  override_reason: string | null;
  notes: string | null;
  vital_signs: VitalSignsRecord;
  classification: Classification;
};

export type EncounterDetail = EncounterSummary & {
  symptoms: string[];
  onset: string | null;
  pain_score: number | null;
  pregnant: boolean;
  patient: PatientProfile;
  pre_analysis: Classification | null;
  /** da mais antiga para a mais nova; a última é a que vale */
  triages: Triage[];
  doctor_name: string | null;
  completed_at: string | null;
  prescription: Prescription | null;
  disclaimer: string;
};

export type MedicationSummary = {
  id: string;
  name: string;
  active_ingredient: string;
  dosage_form: string;
};

export type Dashboard = {
  waiting_nurse: number;
  waiting_doctor: number;
  /** emergência ou muito urgente ainda sem consulta */
  critical_waiting: number;
  review_waiting: number;
  oldest_waiting_since: string | null;
  created_today: number;
  completed_today: number;
  triages_today: number;
  retriages_today: number;
  /** triagens (enfermagem) ou consultas (médico) do usuário hoje */
  mine_today: number;
  /** atendimentos dos últimos 30 dias pelo nível atual ("none" = sem nível) */
  by_level: Record<string, number>;
  model: {
    classifications: number;
    unmatched: number;
    escalated: number;
    needs_review: number;
    avg_confidence: number | null;
    overrides: number;
  };
};

export type HealthStatus = {
  status: string;
};
