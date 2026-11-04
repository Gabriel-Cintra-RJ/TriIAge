import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import type { PrescriptionInput } from "@/lib/api-types";
import { apiErrorResponse, idFrom, readJson, userWithRole } from "@/lib/bff";

export async function POST(request: Request, ctx: RouteContext<"/api/encounters/[id]/prescription">) {
  const user = await userWithRole("MEDICO");
  if (user instanceof NextResponse) return user;
  const id = await idFrom(ctx.params);
  if (!id) return NextResponse.json({ error: "Atendimento inválido." }, { status: 404 });
  const body = await readJson<PrescriptionInput>(request);
  if (body instanceof NextResponse) return body;

  try {
    return NextResponse.json(await api.completeConsultation(id, user.id, body));
  } catch (err) {
    return apiErrorResponse(err);
  }
}
