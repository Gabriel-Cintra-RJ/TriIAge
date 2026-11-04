import type { EncounterDetail, Triage } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { ClassificationCard } from "./classification-card";
import { LevelBadge } from "./level-badge";
import { VitalSignsSummary } from "./vital-signs-summary";

// Partes do atendimento que a enfermagem e o médico veem: relato do paciente, pré-análise e triagens.

export function PatientReport({ encounter }: { encounter: EncounterDetail }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Relato do paciente</h2>
      <p className="mt-1 text-xs text-muted-foreground">Enviado pelo app em {formatDateTime(encounter.created_at)}</p>
      <p className="mt-3">“{encounter.description}”</p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Outros sintomas</dt>
          <dd>{encounter.symptoms.length ? encounter.symptoms.join(", ") : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Desde quando</dt>
          <dd>{encounter.onset ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dor informada</dt>
          <dd>{encounter.pain_score === null ? "—" : `${encounter.pain_score}/10`}</dd>
        </div>
      </dl>
    </section>
  );
}

export function PreAnalysis({ encounter }: { encounter: EncounterDetail }) {
  if (!encounter.pre_analysis) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Pré-análise do sistema</h2>
      <ClassificationCard classification={encounter.pre_analysis} />
    </section>
  );
}

export function TriageCard({ triage, number, current }: { triage: Triage; number: number; current: boolean }) {
  return (
    <article className={`rounded-xl border bg-surface p-5 ${current ? "border-accent" : "border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {number === 1 ? "Triagem" : `Retriagem ${number - 1}`}
            {current && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">vigente</span>}
          </h3>
          <p className="text-xs text-muted-foreground">
            {triage.nurse_name} · {formatDateTime(triage.created_at)}
          </p>
        </div>
        {triage.priority ? <LevelBadge priority={triage.priority} /> : <span className="text-sm">Sem nível</span>}
      </div>

      <div className="mt-4">
        <VitalSignsSummary vitals={triage.vital_signs} />
      </div>
      {triage.override_reason && (
        <p className="mt-4 rounded-md bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          Nível definido pela enfermagem (diferente do sistema): {triage.override_reason}
        </p>
      )}
      {triage.notes && (
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">Observações:</span> {triage.notes}
        </p>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">Classificação do sistema nesta triagem</summary>
        <div className="mt-3">
          <ClassificationCard classification={triage.classification} />
        </div>
      </details>
    </article>
  );
}

// mais nova em cima, porque é a que vale
export function TriageHistory({ encounter }: { encounter: EncounterDetail }) {
  if (encounter.triages.length === 0) return null;
  const total = encounter.triages.length;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        Triagens da enfermagem <span className="font-normal text-muted-foreground">({total})</span>
      </h2>
      {[...encounter.triages].reverse().map((triage, index) => (
        <TriageCard key={triage.id} triage={triage} number={total - index} current={index === 0} />
      ))}
    </section>
  );
}
