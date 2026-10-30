import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { TriageApiError, triageApi } from "@/lib/triage-api";

// BFF da pós-consulta: confere a sessão e o perfil e repassa a lista de remédios para a FastAPI.
// A validação do formato (lista vazia, mais de 20 itens) fica com o Pydantic de lá.

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  if (!canAccess(user.role, "/alta")) {
    return NextResponse.json({ error: "Perfil sem permissão para consultar medicamentos." }, { status: 403 });
  }

  let medications: unknown;
  try {
    ({ medications } = await request.json());
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (!Array.isArray(medications)) {
    return NextResponse.json({ error: "Envie { medications: [...] }." }, { status: 400 });
  }

  try {
    const result = await triageApi.lookupMedications(medications.map(String));
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TriageApiError) {
      return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status });
    }
    throw err;
  }
}
