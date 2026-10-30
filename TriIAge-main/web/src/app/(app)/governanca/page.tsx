import type { Metadata } from "next";
import { PlannedModule } from "@/components/planned-module";

export const metadata: Metadata = { title: "Governança do modelo" };

export default function GovernancePage() {
  return (
    <PlannedModule
      title="Governança do modelo"
      summary="Aprovação ou rejeição de mudanças de versão ou de critérios do JEV, sempre com parecer."
      items={[
        "Solicitações pendentes com motivo e overrides agrupados.",
        "Métricas da versão candidata: sensibilidade, especificidade e subtriagem.",
        "Aprovação com parecer ou rejeição com motivo obrigatório.",
        "Versão anterior mantida para reversão.",
      ]}
      references="RF14 · UC14 · RNF13"
      blocker="Depende da tabela de solicitações de atualização e do registro de versão do modelo na API."
    />
  );
}
