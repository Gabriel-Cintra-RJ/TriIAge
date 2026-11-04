import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import type { VitalSigns } from "@/lib/api-types";
import { apiErrorResponse, readJson, userWithRole } from "@/lib/bff";

export async function POST(request: Request) {
  const user = await userWithRole("PACIENTE");
  if (user instanceof NextResponse) return user;
  const body = await readJson<VitalSigns & { pain_score?: number }>(request);
  if (body instanceof NextResponse) return body;

  try {
    return NextResponse.json(await api.addVitalSigns(user.id, body), { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
