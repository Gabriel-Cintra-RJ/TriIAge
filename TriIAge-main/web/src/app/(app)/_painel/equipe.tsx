import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { QuickActions, StatGrid, StatTile, type QuickAction } from "@/components/dashboard";
import { LevelBadge } from "@/components/level-badge";
import { api } from "@/lib/api";
import type { EncounterSummary } from "@/lib/api-types";
import type { CurrentUser } from "@/lib/auth";
import { formatElapsed, minutesSince } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";

// Telas iniciais de quem trabalha na fila: enfermagem, recepção e médico.

function Greeting({ user, subtitle }: { user: CurrentUser; subtitle: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Olá, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-muted-foreground">
        {ROLE_LABELS[user.role]} · {subtitle}
      </p>
    </section>
  );
}

function NextPatients({ encounters, hrefBase, title }: { encounters: EncounterSummary[]; hrefBase: string; title: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      {encounters.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Ninguém aguardando agora.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {encounters.slice(0, 4).map((e) => (
            <li key={e.id}>
              <Link href={`${hrefBase}/${e.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:underline">
                {e.priority ? <LevelBadge priority={e.priority} /> : <span className="text-sm text-warning-fg">Sem nível</span>}
                <span className="font-medium">{e.patient_name}</span>
                <span className="text-sm text-muted-foreground">
                  {e.patient_age} anos · espera {formatElapsed(minutesSince(e.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export async function NurseDashboard({ user }: { user: CurrentUser }) {
  const [stats, waiting] = await Promise.all([api.dashboard(user.id), api.encounters({ status: "waiting_nurse" })]);
  const isNurse = user.role === "ENFERMEIRO";
  const next = waiting[0];

  const actions: QuickAction[] = [
    { href: "/fila", label: "Fila de triagem", description: "Todos os pacientes que já fizeram a pré-avaliação, do mais grave ao menos grave.", primary: true },
  ];
  if (isNurse) {
    actions.push(
      {
        href: next ? `/fila/${next.id}` : "/fila",
        label: "Atender o próximo",
        description: next ? `${next.patient_name}: medir os sinais vitais e confirmar o nível.` : "Ninguém aguardando triagem agora.",
      },
      {
        href: "/fila#aguardando-medico",
        label: "Nova triagem (retriagem)",
        description: "Refazer a triagem de quem piorou enquanto espera o médico.",
      },
    );
  }

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <Greeting user={user} subtitle="a tela atualiza sozinha a cada 30 segundos" />

      <StatGrid>
        <StatTile label="Aguardando triagem" value={stats.waiting_nurse} hint="Fizeram a pré-avaliação pelo app" />
        <StatTile
          label="Graves sem consulta"
          value={stats.critical_waiting}
          hint="Emergência ou muito urgente"
          alert={stats.critical_waiting > 0 ? "Priorize esses pacientes" : undefined}
        />
        <StatTile
          label="Maior espera"
          value={stats.oldest_waiting_since ? formatElapsed(minutesSince(stats.oldest_waiting_since)) : "—"}
          hint="Entre quem aguarda triagem"
        />
        {isNurse ? (
          <StatTile label="Minhas triagens hoje" value={stats.mine_today} hint={`${stats.retriages_today} retriagem(ns) hoje na unidade`} />
        ) : (
          <StatTile label="Atendimentos hoje" value={stats.created_today} hint={`Finalizados: ${stats.completed_today}`} />
        )}
        <StatTile label="Aguardando médico" value={stats.waiting_doctor} hint="Já triados" />
        <StatTile
          label="Nível para revisar"
          value={stats.review_waiting}
          hint="Confiança baixa do sistema"
          alert={stats.review_waiting > 0 ? "Confirme o nível na triagem" : undefined}
        />
        <StatTile label="Triagens hoje" value={stats.triages_today} hint="Contando retriagens" />
        <StatTile label="Finalizados hoje" value={stats.completed_today} hint="Com consulta médica" />
      </StatGrid>

      <QuickActions actions={actions} />
      <NextPatients encounters={waiting} hrefBase="/fila" title="Próximos da fila" />
    </div>
  );
}

export async function DoctorDashboard({ user }: { user: CurrentUser }) {
  const [stats, waiting] = await Promise.all([api.dashboard(user.id), api.encounters({ status: "waiting_doctor" })]);
  const next = waiting[0];

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <Greeting user={user} subtitle="pacientes já triados pela enfermagem" />

      <StatGrid>
        <StatTile label="Aguardando consulta" value={stats.waiting_doctor} hint="Já passaram pela triagem" />
        <StatTile
          label="Graves aguardando"
          value={stats.critical_waiting}
          hint="Emergência ou muito urgente"
          alert={stats.critical_waiting > 0 ? "Atenda primeiro" : undefined}
        />
        <StatTile label="Minhas consultas hoje" value={stats.mine_today} />
        <StatTile label="Finalizados hoje" value={stats.completed_today} hint="Na unidade toda" />
      </StatGrid>

      <QuickActions
          actions={[
            {
              href: next ? `/consultas/${next.id}` : "/consultas",
              label: "Atender o próximo",
              description: next ? `${next.patient_name}: ver triagem, histórico e fazer a receita.` : "Ninguém aguardando agora.",
              primary: true,
            },
            { href: "/consultas", label: "Lista de consultas", description: "Todos os pacientes triados, do mais grave ao menos grave." },
            { href: "/consultas#finalizadas", label: "Consultas finalizadas", description: "Rever diagnósticos e receitas já enviados." },
          ]}
        />
      <NextPatients encounters={waiting} hrefBase="/consultas" title="Próximos para consulta" />
    </div>
  );
}
