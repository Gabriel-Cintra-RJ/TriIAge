import "server-only";

import { timingSafeEqual } from "node:crypto";
import { api } from "./api";
import type { ApiUser } from "./api-types";
import { isRole } from "./roles";

// Login de demonstração: os usuários (pacientes e equipe) estão na tabela users da API, mas todos usam
// a mesma senha, o AUTH_DEMO_PASSWORD. Sem ela, o login fica desativado.

function samePassword(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function verifyDemoUser(email: string, password: string): Promise<ApiUser | null> {
  const expected = process.env.AUTH_DEMO_PASSWORD;
  if (!expected || !samePassword(password, expected)) return null;

  const user = await api.userByEmail(email.trim().toLowerCase()).catch(() => null);
  return user && isRole(user.role) ? user : null;
}
