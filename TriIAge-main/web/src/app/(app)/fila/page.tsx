import type { Metadata } from "next";
import { PlannedModule } from "@/components/planned-module";

export const metadata: Metadata = { title: "Fila" };

export default function QueuePage() {
  return (
    <PlannedModule
      title="Fila de pacientes"
      summary="Triagens aguardando atendimento, ordenadas por nível e, no empate, por tempo de espera."
      items={[
        "Cor e nome do nível, tempo-alvo, espera, confiança e alertas de cada paciente.",
        "Destaque para triagens marcadas como “revisão humana necessária”.",
        "Confirmação do nível ou override com justificativa obrigatória (mín. 10 caracteres).",
        "Atualização periódica e filtro por nível ou status.",
      ]}
      references="RF06, RF07, RF08 · UC07, UC08, UC10 · RNF06, RNF08"
      blocker="Depende de endpoints na API: listagem de triagens ativas e validação/override com log de auditoria (somente inserção)."
    />
  );
}
