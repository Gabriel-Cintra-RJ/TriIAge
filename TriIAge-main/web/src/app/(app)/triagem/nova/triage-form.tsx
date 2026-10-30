"use client";

import { useState } from "react";
import { LevelBadge } from "@/components/level-badge";
import type { Sex, TriageInput, TriageResult, VitalSigns } from "@/lib/triage-types";
import { VITAL_FIELDS, criticalAlerts } from "@/lib/vital-signs";

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const sectionClass = "rounded-lg border border-border bg-surface p-5";

function readVitals(form: FormData): VitalSigns {
  const vitals: VitalSigns = {};
  for (const field of VITAL_FIELDS) {
    const raw = form.get(field.key);
    if (typeof raw === "string" && raw.trim() !== "") vitals[field.key] = Number(raw);
  }
  return vitals;
}

// os campos de sintomas e doenças são texto livre separado por vírgula; aqui vira lista
function readList(form: FormData, name: string): string[] {
  return String(form.get(name) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TriageForm() {
  const [vitals, setVitals] = useState<VitalSigns>({});
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const alerts = criticalAlerts(vitals);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sex = String(form.get("sex") ?? "");
    const vitalSigns = readVitals(form);
    const input: TriageInput = {
      age: Number(form.get("age")),
      sex: sex ? (sex as Sex) : undefined,
      pregnant: form.get("pregnant") === "on",
      description: String(form.get("description")).trim(),
      symptoms: readList(form, "symptoms"),
      conditions: readList(form, "conditions"),
      vital_signs: Object.keys(vitalSigns).length > 0 ? vitalSigns : undefined,
    };

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/triages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível classificar.");
        return;
      }
      setResult(body);
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setResult(null);
    setVitals({});
  }

  if (result) {
    return (
      <TriageResultPanel
        result={result}
        alerts={alerts.map((a) => a.message)}
        onReset={reset}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={(e) => setVitals(readVitals(new FormData(e.currentTarget)))}
      className="mt-8 space-y-6"
    >
      <fieldset className={sectionClass}>
        <legend className="px-1 font-semibold">Paciente</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Idade (anos)
            <input name="age" type="number" min={0} max={130} required className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            Sexo
            <select name="sex" defaultValue="" className={inputClass}>
              <option value="">Não informado</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input name="pregnant" type="checkbox" className="accent-accent" />
            Gestante
          </label>
        </div>
        <label className="mt-4 block text-sm font-medium">
          Doenças que a pessoa já tem{" "}
          <span className="font-normal text-muted-foreground">(separe por vírgula)</span>
          <input
            name="conditions"
            placeholder="Ex.: hipertensão, diabetes"
            className={inputClass}
          />
        </label>
        <p className="mt-3 text-xs text-muted-foreground">
          Paciente sem documento: informe a idade estimada. O cadastro provisório
          (RF11) entra quando a API tiver a tabela de pacientes.
        </p>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="px-1 font-semibold">Relato e sintomas</legend>
        <label className="block text-sm font-medium">
          O que a pessoa está sentindo, nas palavras dela
          <textarea
            name="description"
            required
            minLength={3}
            rows={3}
            placeholder="Ex.: aperto forte no peito desde cedo, com falta de ar"
            className={inputClass}
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Outros sintomas{" "}
          <span className="font-normal text-muted-foreground">(separe por vírgula)</span>
          <input name="symptoms" placeholder="Ex.: suor frio, náusea" className={inputClass} />
        </label>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="px-1 font-semibold">Sinais vitais</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {VITAL_FIELDS.map((field) => {
            const critical = alerts.some((a) => a.key === field.key);
            return (
              <label key={field.key} className="block text-sm font-medium">
                {field.label} <span className="font-normal text-muted-foreground">({field.unit})</span>
                <input
                  name={field.key}
                  type="number"
                  inputMode="decimal"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  aria-invalid={critical || undefined}
                  className={`${inputClass} ${critical ? "border-danger ring-1 ring-danger" : ""}`}
                />
              </label>
            );
          })}
        </div>
        {alerts.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
            {alerts.map((a) => (
              <li key={a.key}>⚠ {a.message}</li>
            ))}
          </ul>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Classificando…" : "Classificar risco"}
      </button>
    </form>
  );
}

function TriageResultPanel({
  result,
  alerts,
  onReset,
}: {
  result: TriageResult;
  alerts: string[];
  onReset: () => void;
}) {
  const record = result.matched_record;

  return (
    <section className="mt-8 max-w-2xl space-y-6" aria-live="polite">
      <div className={sectionClass}>
        <p className="text-sm text-muted-foreground">Nível sugerido</p>

        {result.matched && result.priority ? (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <LevelBadge priority={result.priority} size="lg" />
            {result.care_timeframe && (
              <span className="text-sm text-muted-foreground">Prazo: {result.care_timeframe}</span>
            )}
          </div>
        ) : (
          <p className="mt-2 rounded-md bg-warning-bg px-4 py-3 text-sm font-medium text-warning-fg">
            Sem correspondência na base: o sistema não tem informação suficiente para sugerir um nível.
            A enfermagem decide o nível.
          </p>
        )}

        <p className="mt-4 text-sm">{result.guidance}</p>

        {result.escalated && (
          <p className="mt-4 rounded-md bg-warning-bg px-4 py-3 text-sm text-warning-fg">
            O nível foi elevado porque uma situação mais grave também era plausível para este relato.
          </p>
        )}

        {result.needs_human_review && (
          <p className="mt-4 rounded-md bg-warning-bg px-4 py-3 text-sm font-medium text-warning-fg">
            Revisão humana necessária: confiança abaixo do limiar. A enfermagem
            deve decidir o nível explicitamente.
          </p>
        )}

        {(alerts.length > 0 || result.warning_signs.length > 0) && (
          <div className="mt-4 text-sm">
            <p className="font-medium">Sinais de alerta</p>
            <ul className="mt-1 space-y-1 text-danger">
              {alerts.map((a) => (
                <li key={a}>⚠ {a}</li>
              ))}
              {result.warning_signs.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          </div>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Confiança</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {result.confidence === null ? "—" : `${(result.confidence * 100).toFixed(0)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Modelo</dt>
            <dd className="font-medium">{result.model ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Triagem nº</dt>
            <dd className="font-medium tabular-nums">{result.id}</dd>
          </div>
        </dl>
      </div>

      {record && (
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold">Situação correspondente na base</h2>
          <p className="mt-2 text-sm font-medium">{record.main_symptom}</p>
          <p className="mt-1 text-sm text-muted-foreground">{record.description}</p>
          <p className="mt-3 text-sm">{record.clinical_rationale}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Fonte:{" "}
            <a href={record.source_url} target="_blank" rel="noreferrer" className="underline">
              {record.source}
            </a>
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{result.disclaimer}</p>

      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-border px-5 py-2 text-sm font-medium hover:bg-muted"
      >
        Nova triagem
      </button>
    </section>
  );
}
