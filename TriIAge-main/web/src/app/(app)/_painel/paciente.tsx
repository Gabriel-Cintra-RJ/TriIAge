import Link from "next/link";
import { QuickActions, StatGrid, StatTile } from "@/components/dashboard";
import { LevelBadge } from "@/components/level-badge";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api";
import type { CurrentUser } from "@/lib/auth";
import { formatDateTime, todayIso } from "@/lib/format";

export async function PatientDashboard({ user }: { user: CurrentUser }) {
  const history = await api.patientHistory(user.id);
  const today = todayIso();
  const open = history.encounters.filter((e) => e.status !== "completed");
  const lastPrescription = history.encounters.find((e) => e.status === "completed");
  const medsInUse = history.medications.filter((m) => !m.ended_on || m.ended_on >= today);
  const allergies = history.health_records.filter((r) => r.category === "allergy");
  const lastPressure = history.vital_signs.find((v) => v.systolic_bp && v.diastolic_bp);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Olá, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted-foreground">Como podemos ajudar hoje?</p>
      </section>

      <Link
        href="/avaliacao"
        className="block rounded-xl bg-accent px-6 py-5 text-accent-foreground transition-opacity hover:opacity-90"
      >
        <span className="text-lg font-semibold">Não estou me sentindo bem →</span>
        <span className="mt-1 block text-sm opacity-90">
          Conte seus sintomas e saiba a urgência e onde procurar atendimento.
        </span>
      </Link>

      <StatGrid>
        <StatTile
          label="Atendimentos em andamento"
          value={open.length}
          hint={open.length ? "Acompanhe abaixo" : "Nenhum no momento"}
        />
        <StatTile
          label="Última pressão medida"
          value={lastPressure ? `${lastPressure.systolic_bp}/${lastPressure.diastolic_bp}` : "—"}
          hint={lastPressure ? formatDateTime(lastPressure.recorded_at) : "Registre no seu histórico"}
        />
        <StatTile label="Remédios em uso" value={medsInUse.length} hint={medsInUse.map((m) => m.name).slice(0, 2).join(", ") || "Nenhum"} />
        <StatTile label="Alergias" value={allergies.length} hint={allergies.map((a) => a.description).join(", ") || "Nenhuma informada"} />
      </StatGrid>

      {open.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Atendimento em andamento</h2>
          <ul className="mt-3 space-y-3">
            {open.map((e) => (
              <li key={e.id}>
                <Link href={`/atendimentos/${e.id}`} className="flex flex-wrap items-center gap-3 hover:underline">
                  {e.priority && <LevelBadge priority={e.priority} />}
                  <StatusPill status={e.status} />
                  <span className="text-sm text-muted-foreground">
                    nº {e.id} · {formatDateTime(e.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuickActions
        actions={[
          { href: "/avaliacao", label: "Nova avaliação", description: "Descreva o que está sentindo e veja a urgência.", primary: true },
          { href: "/atendimentos", label: "Meus atendimentos", description: "Acompanhe as etapas de cada atendimento." },
          {
            href: lastPrescription ? `/atendimentos/${lastPrescription.id}` : "/atendimentos",
            label: "Minhas receitas",
            description: lastPrescription ? `Última: ${lastPrescription.diagnosis}` : "Nenhuma receita ainda.",
          },
          { href: "/historico?aba=sinais", label: "Registrar medição", description: "Anote pressão, glicemia ou temperatura medidas em casa." },
          { href: "/historico?aba=remedios", label: "Meus remédios", description: "O que você toma, de quanto em quanto tempo e até quando." },
          { href: "/historico?aba=doencas", label: "Doenças e alergias", description: "Mantenha seu histórico de saúde atualizado." },
        ]}
      />
    </div>
  );
}
