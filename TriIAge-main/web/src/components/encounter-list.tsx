import Link from "next/link";
import type { EncounterSummary } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { LevelBadge } from "./level-badge";
import { StatusPill } from "./status-pill";

// Lista de atendimentos do paciente (aparece em "Meus atendimentos" e no histórico).
export function EncounterList({ encounters }: { encounters: EncounterSummary[] }) {
  if (encounters.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-muted-foreground">
        Você ainda não tem atendimentos.{" "}
        <Link href="/avaliacao" className="text-accent underline">
          Fazer uma avaliação
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {encounters.map((e) => (
        <li key={e.id}>
          <Link
            href={`/atendimentos/${e.id}`}
            className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Atendimento nº {e.id} · {formatDateTime(e.created_at)}
              </p>
              <StatusPill status={e.status} />
            </div>
            <p className="mt-2 line-clamp-2 font-medium">{e.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {e.priority && <LevelBadge priority={e.priority} />}
              {e.diagnosis && (
                <span>
                  <span className="text-muted-foreground">Diagnóstico:</span> {e.diagnosis}
                </span>
              )}
              {e.status === "completed" && <span className="text-accent">Ver receita →</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
