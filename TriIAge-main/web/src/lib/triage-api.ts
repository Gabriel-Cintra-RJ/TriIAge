import "server-only";

import { connection } from "next/server";
import { mockTriageApi } from "./triage-api.mock";
import type {
  HealthStatus,
  MedicationLookupResult,
  MedicationSummary,
  TriageInput,
  TriageResult,
} from "./triage-types";

// Cliente do microsserviço (FastAPI). Só roda no servidor: o navegador fala com as rotas /api do
// Next (o nosso BFF) e nunca direto com a API.

export class TriageApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

// o JEV pode demorar um pouco, principalmente na consulta de vários remédios
const TIMEOUT_MS = 30_000;

function baseUrl() {
  const url = process.env.TRIAGE_API_URL;
  if (!url) {
    throw new TriageApiError(503, "TRIAGE_API_URL não configurada.");
  }
  return url.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof TriageApiError) throw err;
    throw new TriageApiError(503, "API de triagem indisponível.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new TriageApiError(res.status, messageFor(res.status), body?.detail);
  }
  return res.json() as Promise<T>;
}

function messageFor(status: number) {
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

/**
 * Lido a cada requisição: sem o connection(), o build pré-renderizaria o modo (e os dados simulados)
 * que estivesse no .env da máquina onde rodou o build.
 */
export async function isMockMode() {
  await connection();
  return process.env.TRIAGE_API_MOCK === "true";
}

const realTriageApi = {
  health: () => request<HealthStatus>("/health"),
  createTriage: (input: TriageInput) =>
    request<TriageResult>("/triages", { method: "POST", body: JSON.stringify(input) }),
  medications: () => request<MedicationSummary[]>("/medications"),
  lookupMedications: (medications: string[]) =>
    request<MedicationLookupResult>("/medications/lookup", {
      method: "POST",
      body: JSON.stringify({ medications }),
    }),
};

type TriageApi = typeof realTriageApi;

async function api(): Promise<TriageApi> {
  return (await isMockMode()) ? mockTriageApi : realTriageApi;
}

export const triageApi: TriageApi = {
  health: async () => (await api()).health(),
  createTriage: async (input) => (await api()).createTriage(input),
  medications: async () => (await api()).medications(),
  lookupMedications: async (medications) => (await api()).lookupMedications(medications),
};
