import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LevelBadge } from "@/components/level-badge";
import { PatientResult } from "@/components/patient-result";
import { PrescriptionView } from "@/components/prescription-view";
import { StatusPill } from "@/components/status-pill";
import { VitalSignsSummary } from "@/components/vital-signs-summary";
import { api } from "@/lib/api";
import type { EncounterDetail } from "@/lib/api-types";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { LEVEL_MEANING } from "@/lib/levels";

export const metadata: Metadata = { title: "Atendimento" };

export default function EncounterPage({ params }: PageProps<"/atendimentos/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/atendimentos" className="text-sm text-muted-foreground hover:text-foreground print:hidden">
        ← Meus atendimentos
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}>
        {params.then(({ id }) => (
          <Encounter id={Number(id)} />
        ))}
      </Suspense>
    </div>
  );
}

async function Encounter({ id }: { id: number }) {
  const user = await requireUser();
  const encounter = Number.isInteger(id) ? await api.encounter(id).catch(() => null) : null;
  // o paciente só enxerga os próprios atendimentos
  if (!encounter || encounter.patient_id !== user.id) notFound();

  const pre = encounter.pre_analysis;
  const last = encounter.triages.at(-1);

  return (
    <div className="mt-4 space-y-6">
      <header className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Atendimento nº {encounter.id}</h1>
          <StatusPill status={encounter.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Aberto em {formatDateTime(encounter.created_at)}</p>
        <Steps encounter={encounter} />
      </header>

      {encounter.prescription && (
        <PrescriptionView prescription={encounter.prescription} patientName={encounter.patient.name} />
      )}

      <div className="space-y-6 print:hidden">
        {last && encounter.priority ? (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-semibold">Classificação confirmada na triagem</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <LevelBadge priority={encounter.priority} size="lg" />
              {/* depois da consulta não faz sentido continuar mandando "ligar para o SAMU" */}
              {encounter.status !== "completed" && <p className="font-medium">{LEVEL_MEANING[encounter.priority]}</p>}
            </div>
          </section>
        ) : (
          pre && (
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-semibold">Resultado da sua avaliação</h2>
              <PatientResult classification={pre} />
            </section>
          )
        )}

        {last && (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-semibold">Sinais vitais medidos na triagem</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Por {last.nurse_name} em {formatDateTime(last.created_at)}
            </p>
            <div className="mt-4">
              <VitalSignsSummary vitals={last.vital_signs} />
            </div>

            {/* se a enfermagem refez a triagem, as medições anteriores continuam aparecendo */}
            {encounter.triages.length > 1 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Medições anteriores neste atendimento ({encounter.triages.length - 1})
                </summary>
                <ul className="mt-3 space-y-4">
                  {encounter.triages.slice(0, -1).reverse().map((t) => (
                    <li key={t.id}>
                      <p className="mb-2 text-xs text-muted-foreground">
                        {formatDateTime(t.created_at)} · {t.nurse_name}
                      </p>
                      <VitalSignsSummary vitals={t.vital_signs} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">O que você informou</h2>
          <p className="mt-2">{encounter.description}</p>
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
              <dt className="text-muted-foreground">Dor</dt>
              <dd>{encounter.pain_score === null ? "—" : `${encounter.pain_score} de 10`}</dd>
            </div>
          </dl>
        </section>

        <p className="text-xs text-muted-foreground">{encounter.disclaimer}</p>
      </div>
    </div>
  );
}

function Steps({ encounter }: { encounter: EncounterDetail }) {
  const lastTriage = encounter.triages.at(-1);
  const steps = [
    { label: "Avaliação enviada", done: true, detail: formatDateTime(encounter.created_at) },
    {
      label: "Triagem da enfermagem",
      done: encounter.triages.length > 0,
      detail: lastTriage
        ? `${formatDateTime(lastTriage.created_at)}${encounter.triages.length > 1 ? ` · ${encounter.triages.length} triagens` : ""}`
        : "Aguardando sua chegada",
    },
    {
      label: "Consulta médica",
      done: encounter.status === "completed",
      detail: encounter.completed_at ? `Dr(a). ${encounter.doctor_name}` : "Aguardando",
    },
  ];

  return (
    <ol className="mt-5 grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`rounded-lg border px-4 py-3 ${step.done ? "border-accent bg-accent/10" : "border-border"}`}
        >
          <p className="text-xs text-muted-foreground">Etapa {index + 1}</p>
          <p className="font-medium">
            {step.done ? "✓ " : ""}
            {step.label}
          </p>
          <p className="text-xs text-muted-foreground">{step.detail}</p>
        </li>
      ))}
    </ol>
  );
}
