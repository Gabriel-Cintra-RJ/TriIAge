import type { Metadata } from "next";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { EvaluationForm } from "./evaluation-form";

export const metadata: Metadata = { title: "Nova avaliação" };

export default function EvaluationPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Como você está se sentindo?</h1>
      <p className="mt-1 text-muted-foreground">
        Conte o que está acontecendo. Vamos indicar a urgência e onde procurar atendimento. Quando você
        chegar à unidade, a enfermagem já terá essas informações.
      </p>

      <p className="mt-5 rounded-lg border border-level-1/50 bg-level-1/10 px-4 py-3 text-sm">
        <strong>Emergência?</strong> Dor forte no peito, falta de ar intensa, desmaio, convulsão ou
        sangramento que não para: ligue agora para o{" "}
        <a href="tel:192" className="font-bold underline">
          SAMU 192
        </a>
        .
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Carregando seus dados…</p>}>
        <FormWithProfile />
      </Suspense>
    </div>
  );
}

async function FormWithProfile() {
  const user = await requireUser();
  const history = await api.patientHistory(user.id);
  const today = todayIso();
  const active = (end: string | null) => !end || end >= today;

  // mostro para o paciente o que já sabemos dele, porque isso também vai para a análise
  const known = [
    ...history.health_records
      .filter((r) => (r.category === "condition" && active(r.ended_on)) || r.category === "allergy")
      .map((r) => (r.category === "allergy" ? `Alergia: ${r.description}` : r.description)),
    ...history.medications.filter((m) => active(m.ended_on)).map((m) => `Usa ${m.name}`),
  ];

  return <EvaluationForm canBePregnant={history.profile.sex === "F"} known={known} />;
}
