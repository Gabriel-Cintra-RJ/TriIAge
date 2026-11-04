import type { EncounterStatus, HealthCategory, Sex } from "./api-types";

// o servidor do Docker roda em UTC, então fixo o fuso daqui para os horários não aparecerem 3h adiantados
const TIME_ZONE = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: string) {
  return dateTime.format(new Date(value));
}

/** Datas sem hora ("2026-09-12") viram 12/09/2026. Não passo pelo Date para não cair no dia anterior por causa do fuso. */
export function formatDay(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

export function minutesSince(value: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
}

export function formatElapsed(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
  return `${Math.floor(hours / 24)} dia(s)`;
}

export const SEX_LABELS: Record<Sex, string> = { F: "Feminino", M: "Masculino", other: "Outro" };

export const STATUS_LABELS: Record<EncounterStatus, string> = {
  waiting_nurse: "Aguardando triagem da enfermagem",
  waiting_doctor: "Aguardando consulta médica",
  completed: "Atendimento finalizado",
};

export const CATEGORY_LABELS: Record<HealthCategory, string> = {
  condition: "Doença",
  allergy: "Alergia",
  surgery: "Cirurgia",
};
