import Link from "next/link";
import { LEVEL_BY_PRIORITY } from "@/lib/levels";
import { LevelBadge } from "./level-badge";

// Peças das telas iniciais: cards de número, grade de ações rápidas e a distribuição por nível.

type StatProps = {
  label: string;
  value: string | number;
  hint?: string;
  /** quando o número pede atenção (ex.: emergência esperando), aparece o aviso escrito, não só a cor */
  alert?: string;
};

export function StatTile({ label, value, hint, alert }: StatProps) {
  return (
    <div className={`rounded-xl border bg-surface p-4 ${alert ? "border-danger/60" : "border-border"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {alert ? (
        <p className="mt-1 text-xs font-medium text-danger">⚠ {alert}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export type QuickAction = {
  href: string;
  label: string;
  description: string;
  /** a ação principal do perfil fica destacada */
  primary?: boolean;
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section>
      <h2 className="mb-3 font-semibold">Ações rápidas</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <li key={action.label}>
            <Link
              href={action.href}
              className={`flex h-full flex-col rounded-xl border p-4 transition-colors ${
                action.primary
                  ? "border-accent bg-accent text-accent-foreground hover:opacity-90"
                  : "border-border bg-surface hover:border-accent"
              }`}
            >
              <span className="font-semibold">{action.label} →</span>
              <span className={`mt-1 text-sm ${action.primary ? "opacity-90" : "text-muted-foreground"}`}>
                {action.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Quantos atendimentos caíram em cada nível. Uma cor só para as barras: quem diz o nível é o selo ao lado.
export function LevelBars({ byLevel }: { byLevel: Record<string, number> }) {
  const rows = Object.entries(LEVEL_BY_PRIORITY).map(([p, level]) => ({ priority: Number(p), total: byLevel[level] ?? 0 }));
  const none = byLevel.none ?? 0;
  const sum = rows.reduce((acc, r) => acc + r.total, none);
  const max = Math.max(1, none, ...rows.map((r) => r.total));
  const pct = (n: number) => (sum ? Math.round((n / sum) * 100) : 0);

  if (sum === 0) return <p className="text-sm text-muted-foreground">Nenhum atendimento nos últimos 30 dias.</p>;

  return (
    <ul className="space-y-2.5">
      {rows.map(({ priority, total }) => (
        <BarRow key={priority} label={<LevelBadge priority={priority} />} total={total} max={max} pct={pct(total)} />
      ))}
      {none > 0 && (
        <BarRow
          label={<span className="rounded-md bg-muted px-2.5 py-1 text-sm font-semibold">Sem nível</span>}
          total={none}
          max={max}
          pct={pct(none)}
        />
      )}
    </ul>
  );
}

function BarRow({ label, total, max, pct }: { label: React.ReactNode; total: number; max: number; pct: number }) {
  return (
    <li className="grid grid-cols-[14.5rem_1fr_4.5rem] items-center gap-3 max-sm:grid-cols-[1fr_4.5rem]">
      <div className="max-sm:col-span-2">{label}</div>
      <div className="h-3 rounded-r bg-muted" title={`${total} atendimento(s) · ${pct}%`}>
        {total > 0 && <div className="h-3 rounded-r bg-accent" style={{ width: `${(total / max) * 100}%` }} />}
      </div>
      <span className="text-right text-sm tabular-nums">
        {total} <span className="text-muted-foreground">({pct}%)</span>
      </span>
    </li>
  );
}
