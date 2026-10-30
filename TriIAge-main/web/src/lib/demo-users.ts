import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { Role } from "./roles";

// Usuários de demonstração, um por perfil, enquanto a API não tem tabela de
// usuários (RNF11, Quadro 11). Todos usam a senha de AUTH_DEMO_PASSWORD; sem
// ela, o login fica desativado. Substituir por consulta à API quando existir.

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const DEMO_USERS: AppUser[] = [
  { id: "demo-recepcao", name: "Recepção (demo)", email: "recepcao@triiage.local", role: "RECEPCIONISTA" },
  { id: "demo-enfermagem", name: "Enfermagem (demo)", email: "enfermagem@triiage.local", role: "ENFERMEIRO" },
  { id: "demo-medico", name: "Médico (demo)", email: "medico@triiage.local", role: "MEDICO" },
  { id: "demo-auditoria", name: "Auditoria (demo)", email: "auditoria@triiage.local", role: "AUDITOR" },
  { id: "demo-gestao", name: "Gestão clínica (demo)", email: "gestao@triiage.local", role: "GESTOR_CLINICO" },
];

function samePassword(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function verifyDemoUser(email: string, password: string): AppUser | null {
  const expected = process.env.AUTH_DEMO_PASSWORD;
  if (!expected) return null;

  const user = DEMO_USERS.find((u) => u.email === email.trim().toLowerCase());
  if (!user || !samePassword(password, expected)) return null;
  return user;
}
