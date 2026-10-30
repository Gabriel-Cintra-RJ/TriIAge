import type { Metadata } from "next";
import { PlannedModule } from "@/components/planned-module";

export const metadata: Metadata = { title: "Auditoria" };

export default function AuditPage() {
  return (
    <PlannedModule
      title="Logs de auditoria"
      summary="Consulta somente leitura das validações e overrides registrados."
      items={[
        "Filtros por período, profissional, nível e triagem; opção “somente overrides”.",
        "Data e hora, profissional, nível sugerido, nível final e justificativa.",
        "Indicador de integridade (hash), com destaque para registros comprometidos.",
        "Exportação do relatório.",
      ]}
      references="RF09, RF13 · UC09, UC13 · RNF10"
      blocker="Depende da tabela de log imutável e de um endpoint de consulta na API."
    />
  );
}
