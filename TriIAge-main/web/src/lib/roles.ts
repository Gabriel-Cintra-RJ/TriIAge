// Perfis do TriIAge (Quadro 1 do documento) e quais áreas cada um acessa.
// Usado tanto pelo proxy (bloqueio de rota) quanto pela navegação.

export const ROLES = [
  "PACIENTE",
  "RECEPCIONISTA",
  "ENFERMEIRO",
  "MEDICO",
  "AUDITOR",
  "GESTOR_CLINICO",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  PACIENTE: "Paciente",
  RECEPCIONISTA: "Recepção",
  ENFERMEIRO: "Enfermagem",
  MEDICO: "Médico(a)",
  AUDITOR: "Auditoria",
  GESTOR_CLINICO: "Gestão clínica",
};

export type NavArea = {
  href: string;
  label: string;
  roles: readonly Role[];
};

export const AREAS: NavArea[] = [
  { href: "/avaliacao", label: "Nova avaliação", roles: ["PACIENTE"] },
  { href: "/atendimentos", label: "Meus atendimentos", roles: ["PACIENTE"] },
  { href: "/historico", label: "Meu histórico", roles: ["PACIENTE"] },
  { href: "/fila", label: "Fila de triagem", roles: ["RECEPCIONISTA", "ENFERMEIRO"] },
  { href: "/consultas", label: "Consultas", roles: ["MEDICO"] },
  { href: "/auditoria", label: "Auditoria", roles: ["AUDITOR"] },
  { href: "/governanca", label: "Governança do modelo", roles: ["GESTOR_CLINICO"] },
];

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

/** Páginas fora de AREAS (ex.: início) ficam liberadas a qualquer perfil autenticado. */
export function canAccess(role: Role, pathname: string) {
  const area = AREAS.find(
    (a) => pathname === a.href || pathname.startsWith(`${a.href}/`),
  );
  return !area || area.roles.includes(role);
}

export function areasFor(role: Role) {
  return AREAS.filter((a) => a.roles.includes(role));
}
