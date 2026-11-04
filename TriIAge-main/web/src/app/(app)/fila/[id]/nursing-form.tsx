"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NursingInput, VitalSigns } from "@/lib/api-types";
import { LEVEL_BY_PRIORITY, levelStyle } from "@/lib/levels";
import { VITAL_FIELDS, criticalAlerts } from "@/lib/vital-signs";

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function readVitals(form: FormData): VitalSigns {
  const vitals: VitalSigns = {};
  for (const field of VITAL_FIELDS) {
    const raw = form.get(field.key);
    if (typeof raw === "string" && raw.trim() !== "") vitals[field.key] = Number(raw.replace(",", "."));
  }
  return vitals;
}

type Props = {
  encounterId: number;
  patientPain: number | null;
  /** nível atual do atendimento (da pré-análise ou da última triagem) */
  suggestedPriority: number | null;
  retriage: boolean;
};

export function NursingForm({ encounterId, patientPain, suggestedPriority, retriage }: Props) {
  const router = useRouter();
  const [vitals, setVitals] = useState<VitalSigns>({});
  const [pain, setPain] = useState(patientPain ?? 0);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const alerts = criticalAlerts(vitals);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vitalSigns = readVitals(form);
    if (vitalSigns.systolic_bp === undefined || vitalSigns.heart_rate === undefined) {
      setError("Informe pelo menos a pressão sistólica e a frequência cardíaca.");
      return;
    }
    const level = Number(form.get("level"));
    const input: NursingInput = {
      vital_signs: vitalSigns,
      pain_score: pain,
      notes: String(form.get("notes") ?? "").trim() || undefined,
      urgency_level: manual ? LEVEL_BY_PRIORITY[level as keyof typeof LEVEL_BY_PRIORITY] : undefined,
      override_reason: manual ? String(form.get("override_reason") ?? "").trim() : undefined,
    };

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/encounters/${encounterId}/nursing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.detail?.[0]?.msg === "string" ? body.detail[0].msg : (body.error ?? "Não foi possível salvar."));
        return;
      }
      // tira o ?nova=1 da URL e recarrega para mostrar a triagem que acabou de ser feita
      router.replace(`/fila/${encounterId}`);
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={(e) => setVitals(readVitals(new FormData(e.currentTarget)))}
      className="space-y-5 rounded-xl border border-accent bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{retriage ? "Nova triagem (retriagem)" : "Triagem"}</h2>
          <p className="text-sm text-muted-foreground">
            {retriage
              ? "Meça os sinais vitais de novo. A triagem anterior continua no histórico."
              : "Os sinais vitais vão junto com o relato para o JEV classificar de novo."}
          </p>
        </div>
        {retriage && (
          <Link href={`/fila/${encounterId}`} className="text-sm text-muted-foreground underline hover:text-foreground">
            Cancelar
          </Link>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Sinais vitais</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
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
          <ul role="alert" className="mt-3 space-y-1 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
            {alerts.map((a) => (
              <li key={a.key}>⚠ {a.message}</li>
            ))}
          </ul>
        )}
      </fieldset>

      <label className="block text-sm font-medium">
        Escala de dor (avaliada na triagem)
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={10}
            value={pain}
            onChange={(e) => setPain(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="w-12 text-right font-semibold tabular-nums">{pain}/10</span>
        </div>
        {patientPain !== null && (
          <span className="text-xs font-normal text-muted-foreground">Paciente informou {patientPain}/10 no app.</span>
        )}
      </label>

      <label className="block text-sm font-medium">
        Observações da enfermagem
        <textarea
          name="notes"
          rows={3}
          placeholder="Ex.: consciente e orientada, sem esforço respiratório"
          className={inputClass}
        />
      </label>

      <fieldset className="space-y-2 text-sm">
        <legend className="font-semibold">Nível de urgência</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="mode" checked={!manual} onChange={() => setManual(false)} className="mt-1 accent-accent" />
          <span>
            Usar a classificação do sistema, recalculada com os sinais vitais
            {suggestedPriority && (
              <span className="block text-xs text-muted-foreground">
                {retriage ? "Nível atual" : "Pré-análise do paciente"}: {levelStyle(suggestedPriority).label}
              </span>
            )}
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="mode" checked={manual} onChange={() => setManual(true)} className="mt-1 accent-accent" />
          Definir o nível manualmente
        </label>
        {manual && (
          <div className="space-y-3 pl-6">
            <select name="level" required defaultValue={suggestedPriority ?? 3} className={inputClass}>
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  {p} · {levelStyle(p).color} · {levelStyle(p).label}
                </option>
              ))}
            </select>
            <textarea
              name="override_reason"
              required
              minLength={10}
              rows={2}
              placeholder="Justificativa (obrigatória, mínimo 10 caracteres)"
              className={inputClass}
            />
          </div>
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
        className="w-full rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Classificando…" : retriage ? "Salvar nova triagem" : "Concluir triagem e encaminhar ao médico"}
      </button>
    </form>
  );
}
