import type { Classification } from "@/lib/api-types";
import { LEVEL_MEANING } from "@/lib/levels";
import { LevelBadge } from "./level-badge";

// Versão para o paciente: linguagem simples, sem confiança nem nome de modelo.
export function PatientResult({ classification: c }: { classification: Classification }) {
  return (
    <div className="space-y-4">
      {c.matched && c.priority ? (
        <div className="flex flex-wrap items-center gap-4">
          <LevelBadge priority={c.priority} size="lg" />
          <p className="text-lg font-medium">{LEVEL_MEANING[c.priority]}</p>
        </div>
      ) : (
        <p className="rounded-md bg-warning-bg px-4 py-3 font-medium text-warning-fg">
          Não conseguimos classificar o que você descreveu.
        </p>
      )}

      {c.priority === 1 && (
        <a
          href="tel:192"
          className="block rounded-lg bg-level-1 px-5 py-4 text-center text-lg font-bold text-white"
        >
          Ligar para o SAMU 192
        </a>
      )}

      <p>{c.guidance}</p>
      {c.care_timeframe && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Quando procurar atendimento:</span> {c.care_timeframe}
        </p>
      )}

      {c.warning_signs.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
          <p className="font-semibold text-danger">Procure atendimento imediatamente se aparecer:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {c.warning_signs.map((sign) => (
              <li key={sign}>{sign}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
