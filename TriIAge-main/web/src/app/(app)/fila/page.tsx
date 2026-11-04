import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { QueueTable } from "@/components/queue-table";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Fila de triagem" };

export default function QueuePage() {
  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <h1 className="text-2xl font-semibold">Fila de triagem</h1>
        <p className="mt-1 text-muted-foreground">
          Pacientes que já fizeram a pré-avaliação pelo app. Abra o atendimento para medir os sinais vitais e
          confirmar o nível. A lista atualiza sozinha a cada 30 segundos.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Aguardando triagem</h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          <Queue status="waiting_nurse" empty="Nenhum paciente aguardando triagem." />
        </Suspense>
      </section>

      <section id="aguardando-medico" className="scroll-mt-4">
        <h2 className="font-semibold">Já triados, aguardando o médico</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Se alguém piorar na espera, use “Nova triagem” para medir de novo. As triagens anteriores ficam guardadas.
        </p>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          <Queue status="waiting_doctor" empty="Ninguém aguardando o médico." />
        </Suspense>
      </section>
    </div>
  );
}

async function Queue({ status, empty }: { status: "waiting_nurse" | "waiting_doctor"; empty: string }) {
  const [user, encounters] = await Promise.all([requireUser(), api.encounters({ status })]);
  // retriagem só para quem já foi triado e ainda espera o médico
  const retriage = status === "waiting_doctor" && user.role === "ENFERMEIRO";
  return <QueueTable encounters={encounters} hrefBase="/fila" empty={empty} retriage={retriage} />;
}
