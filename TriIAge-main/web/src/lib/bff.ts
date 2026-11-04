import "server-only";

import { NextResponse } from "next/server";
import { ApiError } from "./api";
import { getCurrentUser, type CurrentUser } from "./auth";
import type { Role } from "./roles";

// Pedaços repetidos das rotas /api (BFF): conferir sessão/perfil, ler o corpo e traduzir os erros da API.
// O id do usuário sempre sai da sessão, nunca do corpo da requisição.

export async function userWithRole(...roles: Role[]): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: "Seu perfil não tem permissão para isso." }, { status: 403 });
  }
  return user;
}

export async function readJson<T>(request: Request): Promise<T | NextResponse> {
  try {
    return (await request.json()) as T;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
}

export async function idFrom(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function apiErrorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status });
  }
  throw err;
}
