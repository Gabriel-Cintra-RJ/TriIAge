import type { Medication } from "@/lib/api-types";

// O que a bula diz de um remédio da base. Aparece na receita do paciente e na tela do médico.
export function MedicationDetails({ med }: { med: Medication }) {
  return (
    <div className="text-sm">
      <p className="font-medium">
        {med.name} <span className="font-normal text-muted-foreground">· {med.dosage_form}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {med.pharmacological_class}
        {med.brand_names.length > 0 && ` · marcas: ${med.brand_names.join(", ")}`}
      </p>

      <p className="mt-3">{med.indication_description}</p>

      <dl className="mt-3 space-y-2">
        <Detail label="Indicações em bula" values={med.therapeutic_indications} />
        {med.mechanism_of_action && <Detail label="Como age" values={[med.mechanism_of_action]} />}
        <Detail label="Via" values={med.administration_routes} />
        {med.age_range && <Detail label="Faixa etária" values={[med.age_range]} />}
        <Detail label="Quem não deve usar (contraindicações)" values={med.contraindications} />
        <Detail label="Cuidados (advertências)" values={med.warnings} />
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        Fonte:{" "}
        {med.source_url ? (
          <a href={med.source_url} target="_blank" rel="noreferrer" className="underline">
            {med.leaflet_source}
          </a>
        ) : (
          med.leaflet_source
        )}
      </p>
    </div>
  );
}

function Detail({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        {values.length === 1 ? (
          values[0]
        ) : (
          <ul className="list-disc pl-5">
            {values.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}
