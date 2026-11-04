import type { Classification, UrgencyLevel } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { levelStyle, priorityOf } from "@/lib/levels";
import { LevelBadge } from "./level-badge";

function levelName(level: UrgencyLevel | null) {
  const priority = priorityOf(level);
  return priority ? levelStyle(priority).label : "nenhum";
}

const STAGE_LABELS = {
  patient: "Pré-análise (relato do paciente)",
  nursing: "Classificação com sinais vitais",
};

// Versão para a equipe: confiança, origem (híbrido ou só regras), divergência árvore × JEV e a situação da base.
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
          {c.duration_ms !== null && ` · ${c.duration_ms} ms`}
        </span>
      </div>

      {c.origin === "rules" ? (
        <p className="mt-3 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning-fg">
          Origem: regras. O JEV não respondeu, então o nível veio só da árvore de decisão e precisa de revisão humana.
        </p>
      ) : (
        c.divergent && (
          <p className="mt-3 text-sm text-warning-fg">
            Árvore de decisão: {levelName(c.rules_level)} · JEV: {levelName(c.model_level)}. Prevaleceu o mais urgente.
          </p>
        )
      )}

      {c.escalated && (
        <p className="mt-3 text-sm text-warning-fg">
          Nível elevado: uma situação mais grave também era plausível.
        </p>
      )}
      {c.needs_human_review && c.origin === "hybrid" && (
        <p className="mt-2 text-sm font-medium text-warning-fg">Confiança baixa: precisa de revisão humana.</p>
      )}

      {c.decision_path.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Caminho na árvore de decisão</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {c.decision_path.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
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
