import type { Metadata } from "next";
import { Suspense } from "react";
import { EncounterList } from "@/components/encounter-list";
import { VitalSignsSummary } from "@/components/vital-signs-summary";
import { api } from "@/lib/api";
import type {
  HealthCategory,
  HealthRecord,
  PatientHistory,
  PatientMedication,
  VitalSigns,
  VitalSignsRecord,
} from "@/lib/api-types";
import { requireUser } from "@/lib/auth";
import { SEX_LABELS, formatDateTime, formatDay, todayIso } from "@/lib/format";
import { VITAL_FIELDS, criticalAlerts } from "@/lib/vital-signs";
import { DeleteButton, HealthRecordForm, MedicationForm, VitalSignsForm } from "./forms";
import { HistoryTabs } from "./history-tabs";

export const metadata: Metadata = { title: "Meu histórico" };

const cardClass = "rounded-xl border border-border bg-surface p-5";
const OTHER_VITALS = VITAL_FIELDS.filter((f) => f.key !== "systolic_bp" && f.key !== "diastolic_bp");

export default function HistoryPage({ searchParams }: PageProps<"/historico">) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Meu histórico de saúde</h1>
      <p className="mt-1 text-muted-foreground">
        Tudo o que está aqui ajuda a equipe de saúde a te atender melhor. Mantenha atualizado.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
          {searchParams.then(({ aba }) => (
            <History tab={typeof aba === "string" ? aba : undefined} />
          ))}
        </Suspense>
      </div>
    </div>
  );
}

async function History({ tab }: { tab?: string }) {
  const user = await requireUser();
  const history = await api.patientHistory(user.id);

  return (
    <HistoryTabs
      initial={tab}
      tabs={[
        { id: "resumo", label: "Resumo", content: <Summary history={history} /> },
        { id: "sinais", label: "Sinais vitais", content: <VitalsPanel vitals={history.vital_signs} /> },
        { id: "remedios", label: "Medicamentos", content: <MedicationsPanel meds={history.medications} /> },
        { id: "doencas", label: "Doenças, alergias e cirurgias", content: <RecordsPanel records={history.health_records} /> },
        { id: "atendimentos", label: "Atendimentos", content: <EncounterList encounters={history.encounters} /> },
      ]}
    />
  );
}

function isActive(end: string | null) {
  return !end || end >= todayIso();
}

function Summary({ history }: { history: PatientHistory }) {
  const { profile } = history;
  const allergies = history.health_records.filter((r) => r.category === "allergy");
  const conditions = history.health_records.filter((r) => r.category === "condition" && isActive(r.ended_on));
  const meds = history.medications.filter((m) => isActive(m.ended_on));
  const lastVitals = history.vital_signs[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={cardClass}>
        <h2 className="font-semibold">Seus dados</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Item label="Nome" value={profile.name} />
          <Item label="Idade" value={`${profile.age} anos (${formatDay(profile.birth_date)})`} />
          <Item label="Sexo" value={profile.sex ? SEX_LABELS[profile.sex] : "—"} />
          <Item label="Tipo sanguíneo" value={profile.blood_type ?? "—"} />
          <Item label="Telefone" value={profile.phone ?? "—"} />
          <Item label="E-mail" value={profile.email} />
        </dl>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Alergias</h2>
        {allergies.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma alergia informada.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {allergies.map((a) => (
              <li key={a.id} className="rounded-full bg-danger/10 px-3 py-1 text-sm font-medium text-danger">
                {a.description}
              </li>
            ))}
          </ul>
        )}
        <h2 className="mt-5 font-semibold">Doenças em acompanhamento</h2>
        <p className="mt-2 text-sm">
          {conditions.length ? conditions.map((c) => c.description).join(", ") : "Nenhuma informada."}
        </p>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Remédios que você usa agora</h2>
        {meds.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {meds.map((m) => (
              <li key={m.id}>
                <span className="font-medium">{m.name}</span>
                {m.dosage && ` · ${m.dosage}`}
                {m.frequency && <span className="text-muted-foreground"> · {m.frequency}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Última medição</h2>
        {lastVitals ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(lastVitals.recorded_at)}</p>
            <p className="mt-2 text-sm">{describeVitals(lastVitals)}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma medição registrada.</p>
        )}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function describeVitals(v: VitalSignsRecord) {
  return VITAL_FIELDS.filter((f) => v[f.key] !== null && v[f.key] !== undefined)
    .map((f) => `${f.label} ${v[f.key]} ${f.unit}`)
    .join(" · ");
}

function VitalsPanel({ vitals }: { vitals: VitalSignsRecord[] }) {
  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="font-semibold">Registrar uma medição feita em casa</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Preencha só o que você mediu.</p>
        <VitalSignsForm />
      </section>

      {vitals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma medição ainda.</p>
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {vitals.map((v) => (
              <li key={v.id} className={cardClass}>
                <p className="text-sm font-medium">{formatDateTime(v.recorded_at)}</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {v.source === "patient" ? "Em casa" : `Unidade de saúde (${v.recorded_by_name})`}
                </p>
                <VitalSignsSummary vitals={v} />
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Onde</th>
                  <th className="px-3 py-3 font-medium">Pressão</th>
                  {OTHER_VITALS.map((f) => (
                    <th key={f.key} className="px-3 py-3 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium">Dor</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((v) => {
                  const alerts = new Set(criticalAlerts(v).map((a) => a.key));
                  const cell = (key: keyof VitalSigns) =>
                    `px-3 py-3 tabular-nums ${alerts.has(key) ? "font-semibold text-danger" : ""}`;
                  const bpAlert = alerts.has("systolic_bp") || alerts.has("diastolic_bp");
                  return (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3">{formatDateTime(v.recorded_at)}</td>
                      <td className="px-3 py-3">
                        {v.source === "patient" ? "Em casa" : `Unidade (${v.recorded_by_name})`}
                      </td>
                      <td className={`px-3 py-3 tabular-nums ${bpAlert ? "font-semibold text-danger" : ""}`}>
                        {v.systolic_bp || v.diastolic_bp ? `${v.systolic_bp ?? "—"}/${v.diastolic_bp ?? "—"}` : "—"}
                      </td>
                      {OTHER_VITALS.map((f) => (
                        <td key={f.key} className={cell(f.key)}>
                          {v[f.key] ?? "—"}
                        </td>
                      ))}
                      <td className="px-3 py-3 tabular-nums">{v.pain_score ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Em vermelho: valores fora da faixa de referência. Se aparecer junto com mal-estar, procure atendimento.
      </p>
    </div>
  );
}

function MedicationsPanel({ meds }: { meds: PatientMedication[] }) {
  const current = meds.filter((m) => isActive(m.ended_on));
  const past = meds.filter((m) => !isActive(m.ended_on));

  return (
    <div className="space-y-6">
      <MedicationTable title="Em uso" meds={current} empty="Nenhum remédio em uso." />
      <MedicationTable title="Já tomou" meds={past} empty="Nenhum remédio anterior." />
      <section className={cardClass}>
        <h2 className="mb-4 font-semibold">Adicionar um remédio que você toma ou já tomou</h2>
        <MedicationForm />
      </section>
    </div>
  );
}

function MedicationTable({ title, meds, empty }: { title: string; meds: PatientMedication[]; empty: string }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      {meds.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {meds.map((m) => (
            <li key={m.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3`}>
              <div>
                <p className="font-medium">
                  {m.name}
                  {m.dosage && <span className="font-normal"> · {m.dosage}</span>}
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Intervalo:</span> {m.frequency ?? "não informado"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Período:</span> {formatDay(m.started_on)} até{" "}
                  {m.ended_on ? formatDay(m.ended_on) : "hoje (uso contínuo)"}
                </p>
                {m.notes && <p className="text-sm text-muted-foreground">{m.notes}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.prescription_item_id ? "Receitado em atendimento" : "Informado por você"}
                </p>
              </div>
              {!m.prescription_item_id && <DeleteButton url={`/api/me/medications/${m.id}`} label={m.name} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CATEGORY_TITLES: Record<HealthCategory, string> = {
  condition: "Doenças e diagnósticos",
  allergy: "Alergias",
  surgery: "Cirurgias",
};

function RecordsPanel({ records }: { records: HealthRecord[] }) {
  return (
    <div className="space-y-6">
      {(Object.keys(CATEGORY_TITLES) as HealthCategory[]).map((category) => {
        const items = records.filter((r) => r.category === category);
        return (
          <section key={category}>
            <h2 className="font-semibold">{CATEGORY_TITLES[category]}</h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nada registrado.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {items.map((r) => (
                  <li key={r.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3`}>
                    <div>
                      <p className="font-medium">{r.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.started_on ? formatDay(r.started_on) : "Data não informada"}
                        {category === "condition" &&
                          (r.ended_on ? ` até ${formatDay(r.ended_on)}` : " · em acompanhamento")}
                      </p>
                      {r.notes && <p className="text-sm">{r.notes}</p>}
                      {r.encounter_id && (
                        <p className="mt-1 text-xs text-muted-foreground">Diagnóstico do atendimento nº {r.encounter_id}</p>
                      )}
                    </div>
                    {!r.encounter_id && <DeleteButton url={`/api/me/health-records/${r.id}`} label={r.description} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <section className={cardClass}>
        <h2 className="mb-4 font-semibold">Adicionar ao histórico</h2>
        <HealthRecordForm />
      </section>
    </div>
  );
}
