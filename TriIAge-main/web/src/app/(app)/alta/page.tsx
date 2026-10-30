import type { Metadata } from "next";
import { Suspense } from "react";
import { UsageNotice } from "@/components/usage-notice";
import { triageApi } from "@/lib/triage-api";
import { MedicationLookup } from "./medication-lookup";

export const metadata: Metadata = { title: "Orientações de alta" };

export default function DischargePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Orientações de alta</h1>
      <p className="mt-1 text-muted-foreground">
        Informe os medicamentos da receita para ver, de cada um, para que condições a bula prevê
        indicação. Serve para explicar a receita ao paciente, não para dizer por que ela foi feita.
      </p>
      <UsageNotice className="mt-3" />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Carregando base de medicamentos…</p>}>
        <LookupWithSuggestions />
      </Suspense>
    </div>
  );
}

// a lista da base só serve de sugestão no campo; se a API não responder, o formulário funciona igual
async function LookupWithSuggestions() {
  const suggestions = await triageApi
    .medications()
    .then((meds) => [...new Set(meds.map((m) => m.name))])
    .catch(() => []);
  return <MedicationLookup suggestions={suggestions} />;
}
