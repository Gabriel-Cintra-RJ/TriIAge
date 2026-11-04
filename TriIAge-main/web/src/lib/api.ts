import "server-only";

import { connection } from "next/server";
import type {
  ApiUser,
  Dashboard,
  EncounterDetail,
  EncounterInput,
  EncounterStatus,
  EncounterSummary,
  HealthRecord,
  HealthRecordInput,
  HealthStatus,
  MedicationSummary,
  NursingInput,
  PatientHistory,
  PatientMedication,
  PatientMedicationInput,
  PrescriptionInput,
  VitalSigns,
  VitalSignsRecord,
} from "./api-types";

// Cliente do microsserviço (FastAPI). Só roda no servidor: o navegador fala com as rotas /api do
// Next (o nosso BFF) e nunca direto com a API.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

// o JEV pode demorar um pouco, principalmente na receita com vários remédios
const TIMEOUT_MS = 30_000;

function baseUrl() {
  const url = process.env.TRIAGE_API_URL;
  if (!url) {
    throw new ApiError(503, "TRIAGE_API_URL não configurada.");
  }
  return url.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // sem isso o build tentaria pré-renderizar as páginas chamando a API
  await connection();
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(503, "API de triagem indisponível.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, messageFor(res.status, body?.detail), body?.detail);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

function messageFor(status: number, detail: unknown) {
  // erros nossos (404, 409...) já vêm com uma frase pronta da API
  if (typeof detail === "string" && status < 500) return detail;
  switch (status) {
    case 422:
      return "Dados inválidos. Confira os campos preenchidos.";
    case 502:
      return "O modelo recusou o pedido.";
    case 503:
      return "O modelo não respondeu ou a base de conhecimento está vazia.";
    default:
      return `Erro inesperado da API (${status}).`;
  }
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () => request<HealthStatus>("/health"),
  dashboard: (userId: number) => request<Dashboard>(`/dashboard?user_id=${userId}`),
  userByEmail: (email: string) => request<ApiUser>(`/users/by-email?email=${encodeURIComponent(email)}`),
  medications: () => request<MedicationSummary[]>("/medications"),

  patientHistory: (patientId: number) => request<PatientHistory>(`/patients/${patientId}/history`),
  addHealthRecord: (patientId: number, input: HealthRecordInput) =>
    request<HealthRecord>(`/patients/${patientId}/health-records`, post(input)),
  deleteHealthRecord: (patientId: number, id: number) =>
    request<void>(`/patients/${patientId}/health-records/${id}`, { method: "DELETE" }),
  addMedication: (patientId: number, input: PatientMedicationInput) =>
    request<PatientMedication>(`/patients/${patientId}/medications`, post(input)),
  deleteMedication: (patientId: number, id: number) =>
    request<void>(`/patients/${patientId}/medications/${id}`, { method: "DELETE" }),
  addVitalSigns: (patientId: number, input: VitalSigns & { pain_score?: number }) =>
    request<VitalSignsRecord>(`/patients/${patientId}/vital-signs`, post({ ...input, recorded_by: patientId })),

  createEncounter: (patientId: number, input: EncounterInput) =>
    request<EncounterDetail>("/encounters", post({ ...input, patient_id: patientId })),
  encounters: (filters: { status?: EncounterStatus; patientId?: number }) => {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.patientId) query.set("patient_id", String(filters.patientId));
    return request<EncounterSummary[]>(`/encounters?${query}`);
  },
  encounter: (id: number) => request<EncounterDetail>(`/encounters/${id}`),
  completeNursing: (id: number, nurseId: number, input: NursingInput) =>
    request<EncounterDetail>(`/encounters/${id}/nursing`, post({ ...input, nurse_id: nurseId })),
  completeConsultation: (id: number, doctorId: number, input: PrescriptionInput) =>
    request<EncounterDetail>(`/encounters/${id}/prescription`, post({ ...input, doctor_id: doctorId })),
};
