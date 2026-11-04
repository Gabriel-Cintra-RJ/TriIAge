import Link from "next/link";
import type { EncounterSummary } from "@/lib/api-types";
import { formatElapsed, minutesSince } from "@/lib/format";
import { LevelBadge } from "./level-badge";

type Props = {
  encounters: EncounterSummary[];
  hrefBase: string;
  empty: string;
  /** mostra o atalho de retriagem (só para a enfermagem, nos que aguardam o médico) */
  retriage?: boolean;
};

// Fila usada pela enfermagem e pelo médico. A ordem já vem da API (mais grave primeiro).
// No computador é uma tabela; no celular vira uma lista de cartões para não ter rolagem para o lado.
export function QueueTable({ encounters, hrefBase, empty, retriage = false }: Props) {
  if (encounters.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-muted-foreground">{empty}</p>;
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {encounters.map((e) => (
          <li key={e.id} className="rounded-xl border border-border bg-surface p-4">
            <Level encounter={e} />
            <p className="mt-2 font-medium">{e.patient_name}</p>
            <p className="text-xs text-muted-foreground">
              {e.patient_age} anos · nº {e.id} · espera {formatElapsed(minutesSince(e.created_at))}
            </p>
            <p className="mt-2 line-clamp-2 text-sm">{e.description}</p>
            <Actions encounter={e} hrefBase={hrefBase} retriage={retriage} className="mt-3" />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
        <table className="w-full table-fixed text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="w-48 px-4 py-3 font-medium">Nível</th>
              <th className="w-52 px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Queixa</th>
              <th className="w-24 px-4 py-3 font-medium">Espera</th>
              <th className="w-44 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {encounters.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Level encounter={e} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{e.patient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.patient_age} anos · nº {e.id}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="line-clamp-2">{e.description}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatElapsed(minutesSince(e.created_at))}</td>
                <td className="px-4 py-3">
                  <Actions encounter={e} hrefBase={hrefBase} retriage={retriage} className="justify-end" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Level({ encounter: e }: { encounter: EncounterSummary }) {
  return (
    <div className="shrink-0">
      {e.priority ? (
        <LevelBadge priority={e.priority} />
      ) : (
        <span className="rounded-md bg-warning-bg px-2.5 py-1 text-sm font-medium text-warning-fg">Sem nível</span>
      )}
      {e.needs_human_review && <p className="mt-1 text-xs text-warning-fg">revisar nível</p>}
      {e.triage_count > 1 && <p className="mt-1 text-xs text-muted-foreground">{e.triage_count} triagens</p>}
    </div>
  );
}

function Actions({ encounter: e, hrefBase, retriage, className = "" }: { encounter: EncounterSummary; hrefBase: string; retriage: boolean; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-sm ${className}`}>
      {retriage && (
        <Link href={`${hrefBase}/${e.id}?nova=1`} className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted">
          Nova triagem
        </Link>
      )}
      <Link href={`${hrefBase}/${e.id}`} className="font-medium text-accent hover:underline">
        Abrir →
      </Link>
    </div>
  );
}
