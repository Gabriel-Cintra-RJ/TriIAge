import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import type { NursingInput } from "@/lib/api-types";
import { apiErrorResponse, idFrom, readJson, userWithRole } from "@/lib/bff";

export async function POST(request: Request, ctx: RouteContext<"/api/encounters/[id]/nursing">) {
  const user = await userWithRole("ENFERMEIRO");
  if (user instanceof NextResponse) return user;
  const id = await idFrom(ctx.params);
  if (!id) return NextResponse.json({ error: "Atendimento inválido." }, { status: 404 });
  const body = await readJson<NursingInput>(request);
  if (body instanceof NextResponse) return body;

  try {
    return NextResponse.json(await api.completeNursing(id, user.id, body));
  } catch (err) {
    return apiErrorResponse(err);
  }
}
