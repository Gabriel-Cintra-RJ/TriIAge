import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { apiErrorResponse, idFrom, userWithRole } from "@/lib/bff";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/me/medications/[id]">) {
  const user = await userWithRole("PACIENTE");
  if (user instanceof NextResponse) return user;
  const id = await idFrom(ctx.params);
  if (!id) return NextResponse.json({ error: "Medicamento inválido." }, { status: 404 });

  try {
    await api.deleteMedication(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
