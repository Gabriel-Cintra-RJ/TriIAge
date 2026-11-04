import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import type { EncounterInput } from "@/lib/api-types";
import { apiErrorResponse, readJson, userWithRole } from "@/lib/bff";

// Paciente abre um atendimento descrevendo os sintomas. A validação dos campos fica com o Pydantic da API.
export async function POST(request: Request) {
  const user = await userWithRole("PACIENTE");
  if (user instanceof NextResponse) return user;
  const body = await readJson<EncounterInput>(request);
  if (body instanceof NextResponse) return body;

  try {
    return NextResponse.json(await api.createEncounter(user.id, body), { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
