import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncounterList } from "@/components/encounter-list";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Meus atendimentos" };

export default function MyEncountersPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Meus atendimentos</h1>
          <p className="mt-1 text-muted-foreground">Acompanhe cada etapa e veja suas receitas.</p>
        </div>
        <Link
          href="/avaliacao"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          Nova avaliação
        </Link>
      </div>

      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          <Encounters />
        </Suspense>
      </div>
    </div>
  );
}

async function Encounters() {
  const user = await requireUser();
  const encounters = await api.encounters({ patientId: user.id });
  return <EncounterList encounters={encounters} />;
}
