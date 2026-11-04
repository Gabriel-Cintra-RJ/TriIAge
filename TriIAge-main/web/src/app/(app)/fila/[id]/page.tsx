import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PatientReport, PreAnalysis, TriageCard, TriageHistory } from "@/components/encounter-overview";
import { PatientBackground } from "@/components/patient-background";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { NursingForm } from "./nursing-form";

export const metadata: Metadata = { title: "Triagem" };

export default function TriagePage({ params, searchParams }: PageProps<"/fila/[id]">) {
  return (
    <div>
      <Link href="/fila" className="text-sm text-muted-foreground hover:text-foreground">
        ← Fila de triagem
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}>
        {Promise.all([params, searchParams]).then(([{ id }, { nova }]) => (
          <Triage id={Number(id)} newTriage={nova === "1"} />
        ))}
      </Suspense>
    </div>
  );
}

async function Triage({ id, newTriage }: { id: number; newTriage: boolean }) {
  const user = await requireUser();
  const encounter = Number.isInteger(id) ? await api.encounter(id).catch(() => null) : null;
  if (!encounter) notFound();
  const history = await api.patientHistory(encounter.patient_id);

  const isNurse = user.role === "ENFERMEIRO";
  const last = encounter.triages.at(-1);
  // primeira triagem, ou retriagem pedida pelo atalho, enquanto o médico ainda não atendeu
  const showForm = isNurse && (encounter.status === "waiting_nurse" || (encounter.status === "waiting_doctor" && newTriage));

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Atendimento nº {encounter.id}</h1>
        <StatusPill status={encounter.status} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0 space-y-6">
          <PatientBackground history={history} pregnant={encounter.pregnant} />
          <PatientReport encounter={encounter} />
          <PreAnalysis encounter={encounter} />
          {/* com o formulário aberto a triagem vigente aparece aqui, para dar para comparar */}
          {showForm && <TriageHistory encounter={encounter} />}
        </div>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-4">
          {showForm ? (
            <NursingForm
              encounterId={encounter.id}
              patientPain={encounter.pain_score}
              suggestedPriority={encounter.priority}
              retriage={encounter.triages.length > 0}
            />
          ) : last ? (
            <>
              {isNurse && encounter.status === "waiting_doctor" && (
                <div className="rounded-xl border border-border bg-accent-soft p-5">
                  <p className="font-semibold">O estado do paciente mudou?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enquanto ele aguarda o médico, dá para refazer a triagem com novos sinais vitais. A
                    triagem atual continua guardada no histórico.
                  </p>
                  <Link
                    href={`/fila/${encounter.id}?nova=1`}
                    className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
                  >
                    Iniciar nova triagem
                  </Link>
                </div>
              )}
              <TriageCard triage={last} number={encounter.triages.length} current />
              {encounter.triages.length > 1 && (
                <details className="rounded-xl border border-border bg-surface p-5">
                  <summary className="cursor-pointer font-medium">
                    Ver as {encounter.triages.length - 1} triagem(ns) anterior(es)
                  </summary>
                  <div className="mt-4 space-y-3">
                    {encounter.triages.slice(0, -1).reverse().map((t, i) => (
                      <TriageCard key={t.id} triage={t} number={encounter.triages.length - 1 - i} current={false} />
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground">
              Aguardando a triagem da enfermagem.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
