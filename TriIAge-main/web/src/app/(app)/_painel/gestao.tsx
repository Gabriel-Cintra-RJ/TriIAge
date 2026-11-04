import { LevelBars, QuickActions, StatGrid, StatTile } from "@/components/dashboard";
import { LevelBadge } from "@/components/level-badge";
import { api } from "@/lib/api";
import type { CurrentUser } from "@/lib/auth";
import { LEVEL_MEANING } from "@/lib/levels";
import { ROLE_LABELS } from "@/lib/roles";

// Auditoria e gestão clínica: os dois olham o sistema como um todo, então usam a mesma tela inicial.

function percent(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "—";
}

export async function ManagementDashboard({ user }: { user: CurrentUser }) {
  const [stats, health] = await Promise.all([api.dashboard(user.id), api.health().catch(() => null)]);
  const m = stats.model;
  const isAuditor = user.role === "AUDITOR";

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Olá, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted-foreground">
          {ROLE_LABELS[user.role]} · {health ? "API e banco funcionando" : "API indisponível"}
        </p>
      </section>

      <StatGrid>
        <StatTile label="Atendimentos hoje" value={stats.created_today} hint={`Finalizados: ${stats.completed_today}`} />
        <StatTile
          label="Classificações"
          value={m.classifications}
          hint={`Pela contingência (só regras): ${m.rules_fallback}`}
          alert={m.rules_fallback > 0 ? `${m.rules_fallback} sem o JEV` : undefined}
        />
        <StatTile
          label="Confiança média"
          value={m.avg_confidence === null ? "—" : `${Math.round(m.avg_confidence * 100)}%`}
          hint="Do modelo em todas as classificações"
        />
        <StatTile
          label="Nível mudado pela enfermagem"
          value={m.overrides}
          hint="Sempre com justificativa registrada"
        />
        <StatTile label="Precisaram de revisão" value={percent(m.needs_review, m.classifications)} hint={`${m.needs_review} classificações com confiança baixa`} />
        <StatTile label="Nível elevado por segurança" value={percent(m.escalated, m.classifications)} hint={`${m.escalated} vezes uma opção mais grave ganhou`} />
        <StatTile label="Sem correspondência na base" value={percent(m.unmatched, m.classifications)} hint={`${m.unmatched} relatos que a base não cobre`} />
        <StatTile
          label="Árvore × JEV divergiram"
          value={percent(m.divergent, m.classifications)}
          hint={`${m.divergent} vezes; prevaleceu o mais urgente`}
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Atendimentos por nível</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Últimos 30 dias, pelo nível atual de cada atendimento.</p>
          <LevelBars byLevel={stats.by_level} />
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">O que cada nível quer dizer</h2>
          <ul className="mt-4 space-y-3">
            {[1, 2, 3, 4, 5].map((priority) => (
              <li key={priority}>
                <LevelBadge priority={priority} />
                <p className="mt-1 text-sm text-muted-foreground">{LEVEL_MEANING[priority]}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <QuickActions
        actions={
          isAuditor
            ? [{ href: "/auditoria", label: "Logs de auditoria", description: "Validações e mudanças de nível feitas pela enfermagem (em construção).", primary: true }]
            : [{ href: "/governanca", label: "Governança do modelo", description: "Desempenho do JEV e das bases de conhecimento (em construção).", primary: true }]
        }
      />
    </div>
  );
}
