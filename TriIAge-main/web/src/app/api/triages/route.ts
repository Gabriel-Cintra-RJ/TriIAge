import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { TriageApiError, triageApi } from "@/lib/triage-api";
import type { TriageInput } from "@/lib/triage-types";

// BFF: repassa a triagem à API FastAPI. A validação de formato fica com o
// Pydantic do microsserviço (422), para não duplicar regras aqui.

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  if (!canAccess(user.role, "/triagem/nova")) {
    return NextResponse.json({ error: "Perfil sem permissão para triar." }, { status: 403 });
  }

  let input: TriageInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const result = await triageApi.createTriage(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof TriageApiError) {
      return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status });
    }
    throw err;
  }
}
