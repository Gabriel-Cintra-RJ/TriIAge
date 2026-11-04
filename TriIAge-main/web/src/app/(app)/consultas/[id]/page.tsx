import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PatientReport, PreAnalysis, TriageHistory } from "@/components/encounter-overview";
import { PatientBackground } from "@/components/patient-background";
import { PrescriptionView } from "@/components/prescription-view";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api";
import type { PatientHistory } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { ConsultationForm } from "./consultation-form";

export const metadata: Metadata = { title: "Consulta" };

export default function ConsultationPage({ params }: PageProps<"/consultas/[id]">) {
  return (
    <div>
      <Link href="/consultas" className="text-sm text-muted-foreground hover:text-foreground print:hidden">
        ← Consultas
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}>
        {params.then(({ id }) => (
          <Consultation id={Number(id)} />
        ))}
      </Suspense>
    </div>
  );
}

async function Consultation({ id }: { id: number }) {
  const encounter = Number.isInteger(id) ? await api.encounter(id).catch(() => null) : null;
  if (!encounter) notFound();
  const [history, medications] = await Promise.all([
    api.patientHistory(encounter.patient_id),
    // os nomes da base só servem de sugestão no campo; se falhar, o médico digita normalmente
    api.medications().catch(() => []),
  ]);

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">Atendimento nº {encounter.id}</h1>
        <StatusPill status={encounter.status} />
      </div>

      {encounter.prescription && (
        <PrescriptionView prescription={encounter.prescription} patientName={encounter.patient.name} showClinicalNotes />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2 print:hidden">
        <div className="min-w-0 space-y-6">
          <PatientBackground history={history} pregnant={encounter.pregnant} />
          <PatientReport encounter={encounter} />
          <TriageHistory encounter={encounter} />
          <PreAnalysis encounter={encounter} />
          <PreviousEncounters history={history} currentId={encounter.id} />
        </div>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-4">
          {encounter.status === "waiting_doctor" ? (
            <ConsultationForm
              encounterId={encounter.id}
              suggestions={[...new Set(medications.map((m) => m.name))]}
            />
          ) : (
            encounter.status === "waiting_nurse" && (
              <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
                Este paciente ainda não passou pela triagem da enfermagem.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function PreviousEncounters({ history, currentId }: { history: PatientHistory; currentId: number }) {
  const previous = history.encounters.filter((e) => e.id !== currentId);
  const lastVitals = history.vital_signs.slice(0, 5);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Histórico do paciente</h2>

      <h3 className="mt-4 text-sm font-medium text-muted-foreground">Atendimentos anteriores</h3>
      {previous.length === 0 ? (
        <p className="mt-1 text-sm">Nenhum.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {previous.map((e) => (
            <li key={e.id}>
              <Link href={`/consultas/${e.id}`} className="hover:underline">
                {formatDateTime(e.created_at)} · {e.diagnosis ?? e.description}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-sm font-medium text-muted-foreground">Últimas medições</h3>
      {lastVitals.length === 0 ? (
        <p className="mt-1 text-sm">Nenhuma.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm tabular-nums">
          {lastVitals.map((v) => (
            <li key={v.id}>
              {formatDateTime(v.recorded_at)} · {v.source === "patient" ? "em casa" : "unidade"} ·{" "}
              {[
                v.systolic_bp && `PA ${v.systolic_bp}/${v.diastolic_bp ?? "—"}`,
                v.heart_rate && `FC ${v.heart_rate}`,
                v.temperature && `${v.temperature} °C`,
                v.oxygen_saturation && `SpO₂ ${v.oxygen_saturation}%`,
                v.blood_glucose && `glicemia ${v.blood_glucose}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
