import type { PatientHistory } from "@/lib/api-types";
import { SEX_LABELS, formatDay, todayIso } from "@/lib/format";

// Resumo do paciente para a enfermagem e o médico: cadastro, doenças ativas, alergias e remédios em uso.
export function PatientBackground({ history, pregnant }: { history: PatientHistory; pregnant: boolean }) {
  const today = todayIso();
  const active = (end: string | null) => !end || end >= today;
  const { profile } = history;
  const conditions = history.health_records.filter((r) => r.category === "condition" && active(r.ended_on));
  const allergies = history.health_records.filter((r) => r.category === "allergy");
  const meds = history.medications.filter((m) => active(m.ended_on));

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="font-semibold">{profile.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {profile.age} anos · {profile.sex ? SEX_LABELS[profile.sex] : "sexo não informado"}
        {profile.blood_type && ` · tipo sanguíneo ${profile.blood_type}`} · nascimento {formatDay(profile.birth_date)}
      </p>
      {pregnant && (
        <p className="mt-2 inline-flex rounded-full bg-warning-bg px-3 py-1 text-xs font-medium text-warning-fg">
          Gestante
        </p>
      )}

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <List title="Alergias" empty="Nenhuma informada" highlight items={allergies.map((a) => a.description)} />
        <List title="Doenças em acompanhamento" empty="Nenhuma informada" items={conditions.map((c) => c.description)} />
        <List
          title="Remédios em uso"
          empty="Nenhum informado"
          items={meds.map((m) => [m.name, m.dosage, m.frequency].filter(Boolean).join(" · "))}
        />
      </div>
    </section>
  );
}

function List({ title, items, empty, highlight }: { title: string; items: string[]; empty: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1">{empty}</p>
      ) : (
        <ul className={`mt-1 space-y-0.5 ${highlight ? "font-semibold text-danger" : ""}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
