import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import type { HealthRecordInput } from "@/lib/api-types";
import { apiErrorResponse, readJson, userWithRole } from "@/lib/bff";

// rotas /api/me: o paciente mexe só no próprio histórico (o id vem da sessão)
export async function POST(request: Request) {
  const user = await userWithRole("PACIENTE");
  if (user instanceof NextResponse) return user;
  const body = await readJson<HealthRecordInput>(request);
  if (body instanceof NextResponse) return body;

  try {
    return NextResponse.json(await api.addHealthRecord(user.id, body), { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
