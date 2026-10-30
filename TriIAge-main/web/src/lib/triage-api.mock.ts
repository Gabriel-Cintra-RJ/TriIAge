import "server-only";

import type {
  HealthStatus,
  Medication,
  MedicationLookupResult,
  MedicationSummary,
  TriageInput,
  TriageResult,
} from "./triage-types";

// Respostas de mentira para mexer no front sem subir o backend (TRIAGE_API_MOCK=true).
// A regra daqui é só para ter algo na tela, não tem nada a ver com a regra clínica de verdade.

const DISCLAIMER = "Resposta simulada (modo mock). Não use para decisões clínicas.";

const LEVEL_BY_PRIORITY = ["emergency", "very_urgent", "urgent", "less_urgent", "guided_self_care"] as const;

let nextId = 1;

function mockPriority({ description, vital_signs: v = {} }: TriageInput) {
  const text = description.toLowerCase();
  if ((v.oxygen_saturation ?? 100) < 90 || (v.systolic_bp ?? 120) < 90) return 1;
  if (text.includes("peito") || text.includes("falta de ar")) return 2;
  if ((v.temperature ?? 36.5) >= 39 || text.includes("febre")) return 3;
  return 4;
}

const MOCK_MEDICATION: Medication = {
  id: "MED-MOCK",
  name: "Dipirona (simulada)",
  active_ingredient: "dipirona monoidratada",
  brand_names: [],
  pharmacological_class: "Analgésico e antitérmico",
  therapeutic_indications: ["analgésico", "antitérmico"],
  related_conditions: ["dor", "febre"],
  indication_description: "A bula indica este medicamento como analgésico e antitérmico.",
  mechanism_of_action: null,
  dosage_form: "Comprimido",
  administration_routes: ["oral"],
  contraindications: [],
  warnings: [],
  age_range: null,
  leaflet_source: "Registro simulado",
  source_url: "",
};

export const mockTriageApi = {
  health: async (): Promise<HealthStatus> => ({ status: "ok (mock)" }),
  createTriage: async (input: TriageInput): Promise<TriageResult> => {
    const priority = mockPriority(input);
    return {
      id: nextId++,
      created_at: new Date().toISOString(),
      matched: true,
      urgency_level: LEVEL_BY_PRIORITY[priority - 1],
      priority,
      guidance: "Orientação simulada para testar a tela.",
      care_timeframe: "Simulado",
      warning_signs: ["sinal de alerta simulado"],
      escalated: false,
      confidence: 0.8,
      needs_human_review: false,
      matched_record: null,
      model: "mock",
      disclaimer: DISCLAIMER,
    };
  },
  medications: async (): Promise<MedicationSummary[]> => [
    { id: MOCK_MEDICATION.id, name: MOCK_MEDICATION.name, active_ingredient: "dipirona", dosage_form: "Comprimido" },
  ],
  lookupMedications: async (medications: string[]): Promise<MedicationLookupResult> => ({
    results: medications.map((query) => {
      const found = query.toLowerCase().includes("dipirona");
      return {
        query,
        found,
        match_method: found ? "name" : "none",
        confidence: null,
        medications: found ? [MOCK_MEDICATION] : [],
        message: found ? "Encontrado (mock)." : "Não encontrado (mock).",
      };
    }),
    disclaimer: DISCLAIMER,
  }),
};
