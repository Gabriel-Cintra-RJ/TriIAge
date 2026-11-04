import type { Classification } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { LevelBadge } from "./level-badge";

const STAGE_LABELS = {
  patient: "Pré-análise (relato do paciente)",
  nursing: "Classificação com sinais vitais",
};

// Versão para a equipe: mostra confiança, escalonamento e a situação da base que o JEV escolheu.
export function ClassificationCard({ classification: c }: { classification: Classification }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{STAGE_LABELS[c.stage]}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {c.matched && c.priority ? (
          <LevelBadge priority={c.priority} />
        ) : (
          <span className="rounded-md bg-warning-bg px-2.5 py-1 text-sm font-medium text-warning-fg">
            Sem correspondência na base
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          Confiança {c.confidence === null ? "—" : `${Math.round(c.confidence * 100)}%`}
          {c.model && ` · ${c.model}`}
        </span>
      </div>

      {c.escalated && (
        <p className="mt-3 text-sm text-warning-fg">
          Nível elevado: uma situação mais grave também era plausível.
        </p>
      )}
      {c.needs_human_review && (
        <p className="mt-2 text-sm font-medium text-warning-fg">Confiança baixa: precisa de revisão humana.</p>
      )}

      {c.matched_record && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Situação da base: {c.matched_record.main_symptom}
          </summary>
          <p className="mt-2">{c.matched_record.description}</p>
          <p className="mt-2 text-muted-foreground">{c.matched_record.clinical_rationale}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Fonte:{" "}
            <a href={c.matched_record.source_url} target="_blank" rel="noreferrer" className="underline">
              {c.matched_record.source}
            </a>
          </p>
        </details>
      )}
    </div>
  );
}
