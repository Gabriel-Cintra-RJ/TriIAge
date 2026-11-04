// Aparência dos cinco níveis (Manchester). A cor sempre acompanha o nome
// do nível (RNF09), nunca aparece sozinha.

export type LevelStyle = {
  color: string;
  label: string;
  /** classes Tailwind para o selo */
  badge: string;
};

export const LEVELS: Record<number, LevelStyle> = {
  1: { color: "Vermelho", label: "Emergência", badge: "bg-level-1 text-white" },
  2: { color: "Laranja", label: "Muito urgente", badge: "bg-level-2 text-white" },
  3: { color: "Amarelo", label: "Urgente", badge: "bg-level-3 text-neutral-950" },
  4: { color: "Verde", label: "Pouco urgente", badge: "bg-level-4 text-white" },
  5: { color: "Azul", label: "Autocuidado orientado", badge: "bg-level-5 text-white" },
};

// o que cada nível quer dizer para o paciente (é a mesma régua da base symptom_urgency do backend)
export const LEVEL_MEANING: Record<number, string> = {
  1: "Ligar para o SAMU 192",
  2: "Ir a um pronto atendimento imediatamente",
  3: "Avaliação médica no mesmo dia",
  4: "Consulta agendada, conforme a evolução",
  5: "Cuidados em casa, com critérios para procurar atendimento",
};

export const LEVEL_BY_PRIORITY = {
  1: "emergency",
  2: "very_urgent",
  3: "urgent",
  4: "less_urgent",
  5: "guided_self_care",
} as const;

export function priorityOf(level: string | null) {
  const entry = Object.entries(LEVEL_BY_PRIORITY).find(([, value]) => value === level);
  return entry ? Number(entry[0]) : null;
}

export function levelStyle(priority: number): LevelStyle {
  return LEVELS[priority] ?? { color: "—", label: "Sem nível", badge: "bg-muted text-foreground" };
}

export function formatWait(minutes: number) {
  return minutes === 0 ? "imediato" : `até ${minutes} min`;
}
