import type { Metadata } from "next";
import { UsageNotice } from "@/components/usage-notice";
import { TriageForm } from "./triage-form";

export const metadata: Metadata = { title: "Nova triagem" };

export default function NewTriagePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Nova triagem</h1>
      <p className="mt-1 text-muted-foreground">
        Registre o relato, os sintomas e os sinais vitais. A sugestão de nível
        precisa ser validada pela enfermagem.
      </p>
      <UsageNotice className="mt-3" />
      <TriageForm />
    </div>
  );
}
