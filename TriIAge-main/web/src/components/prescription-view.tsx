import type { Prescription } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { MedicationDetails } from "./medication-details";
import { PrintButton } from "./print-button";

type Props = {
  prescription: Prescription;
  patientName: string;
  /** observações clínicas são da equipe; o paciente vê só diagnóstico, receita e recomendações */
  showClinicalNotes?: boolean;
};

export function PrescriptionView({ prescription, patientName, showClinicalNotes = false }: Props) {
  return (
    <article className="rounded-xl border border-border bg-surface p-6 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receituário</p>
          <h2 className="mt-1 text-xl font-semibold">{prescription.diagnosis}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paciente: {patientName} · Dr(a). {prescription.doctor_name} ·{" "}
            {formatDateTime(prescription.created_at)}
          </p>
        </div>
        <PrintButton />
      </header>

      {showClinicalNotes && prescription.clinical_notes && (
        <section className="mt-4 text-sm">
          <h3 className="font-semibold">Observações clínicas</h3>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{prescription.clinical_notes}</p>
        </section>
      )}

      <section className="mt-5">
        <h3 className="font-semibold">Medicamentos</h3>
        {prescription.items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum medicamento foi receitado.</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {prescription.items.map((item, index) => (
              <li key={item.id} className="rounded-lg border border-border p-4">
                <p className="font-semibold">
                  {index + 1}. {item.written_name}
                </p>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <Field label="Quanto tomar" value={item.dosage} />
                  <Field label="De quanto em quanto tempo" value={item.frequency} />
                  <Field label="Por quanto tempo" value={item.duration} />
                </dl>
                {item.instructions && <p className="mt-2 text-sm">{item.instructions}</p>}

                {item.medication ? (
                  <details className="mt-3 rounded-md bg-muted/60 px-4 py-3 print:hidden">
                    <summary className="cursor-pointer text-sm font-medium">
                      O que a bula diz sobre este remédio
                    </summary>
                    {item.match_method === "jev" && (
                      <p className="mt-2 text-xs text-warning-fg">
                        Encontrado por aproximação do nome. Confira se é o mesmo remédio da receita.
                      </p>
                    )}
                    <div className="mt-3">
                      <MedicationDetails med={item.medication} />
                    </div>
                  </details>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Este remédio não está na nossa base de bulas. Em caso de dúvida, pergunte ao farmacêutico.
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {prescription.recommendations && (
        <section className="mt-5 text-sm">
          <h3 className="font-semibold">Recomendações</h3>
          <p className="mt-1 whitespace-pre-line">{prescription.recommendations}</p>
        </section>
      )}
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
