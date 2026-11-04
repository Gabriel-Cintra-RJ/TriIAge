import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { QueueTable } from "@/components/queue-table";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Consultas" };

export default function ConsultationsPage() {
  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <h1 className="text-2xl font-semibold">Consultas</h1>
        <p className="mt-1 text-muted-foreground">
          Pacientes já triados pela enfermagem, do mais grave para o menos grave.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Aguardando consulta</h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          <Waiting />
        </Suspense>
      </section>

      <section id="finalizadas" className="scroll-mt-4">
        <h2 className="mb-3 font-semibold">Finalizadas recentemente</h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          <Completed />
        </Suspense>
      </section>
    </div>
  );
}

async function Waiting() {
  const encounters = await api.encounters({ status: "waiting_doctor" });
  return <QueueTable encounters={encounters} hrefBase="/consultas" empty="Nenhum paciente aguardando consulta." />;
}

async function Completed() {
  const encounters = (await api.encounters({ status: "completed" })).slice(0, 10);
  if (encounters.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma consulta finalizada.</p>;

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {encounters.map((e) => (
        <li key={e.id}>
          <Link href={`/consultas/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted">
            <span>
              <span className="font-medium">{e.patient_name}</span> · {e.diagnosis}
            </span>
            <span className="text-muted-foreground">{formatDateTime(e.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
