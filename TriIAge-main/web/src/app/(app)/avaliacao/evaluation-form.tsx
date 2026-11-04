"use client";

import Link from "next/link";
import { useState } from "react";
import { PatientResult } from "@/components/patient-result";
import type { EncounterDetail, EncounterInput } from "@/lib/api-types";

const COMMON_SYMPTOMS = [
  "Febre",
  "Tosse",
  "Falta de ar",
  "Dor no peito",
  "Náusea ou vômito",
  "Diarreia",
  "Dor de cabeça",
  "Tontura",
  "Dor na barriga",
  "Manchas na pele",
  "Dor ou ardor ao urinar",
  "Sangramento",
];

const ONSET_OPTIONS = ["Começou hoje", "Desde ontem", "Há 2 ou 3 dias", "Há mais de uma semana"];

const PAIN_LABELS = ["Sem dor", "Leve", "Leve", "Leve", "Moderada", "Moderada", "Moderada", "Forte", "Forte", "Muito forte", "Insuportável"];

const inputClass = "mt-2 w-full rounded-lg border border-border bg-background px-4 py-3";
const cardClass = "rounded-xl border border-border bg-surface p-5";

export function EvaluationForm({ canBePregnant, known }: { canBePregnant: boolean; known: string[] }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [pain, setPain] = useState(0);
  const [result, setResult] = useState<EncounterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggle(symptom: string) {
    setChecked((current) =>
      current.includes(symptom) ? current.filter((s) => s !== symptom) : [...current, symptom],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const others = String(form.get("others") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const input: EncounterInput = {
      description: String(form.get("description")).trim(),
      symptoms: [...checked, ...others],
      onset: String(form.get("onset") ?? "") || undefined,
      pain_score: pain,
      pregnant: form.get("pregnant") === "on",
    };

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível enviar sua avaliação.");
        return;
      }
      setResult(body);
      window.scrollTo({ top: 0 });
    } catch {
      setError("Falha de conexão. Tente de novo.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <section className="mt-8 space-y-6" aria-live="polite">
        <div className={cardClass}>
          <p className="text-sm text-muted-foreground">Resultado da sua avaliação</p>
          <div className="mt-3">
            {result.pre_analysis && <PatientResult classification={result.pre_analysis} />}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="font-semibold">Atendimento nº {result.id} registrado</h2>
          <p className="mt-2 text-sm">
            Ao chegar na unidade de saúde, diga seu nome na recepção. A enfermagem já vai ter o que você
            contou aqui, vai medir seus sinais vitais (pressão, batimentos, temperatura) e confirmar a
            classificação.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/atendimentos/${result.id}`}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
            >
              Acompanhar meu atendimento
            </Link>
            <Link href="/" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted">
              Voltar ao início
            </Link>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className={cardClass}>
        <label htmlFor="description" className="text-lg font-semibold">
          O que você está sentindo?
        </label>
        <p className="text-sm text-muted-foreground">Escreva do seu jeito, como explicaria para alguém.</p>
        <textarea
          id="description"
          name="description"
          required
          minLength={3}
          maxLength={2000}
          rows={4}
          placeholder="Ex.: estou com dor de garganta forte desde ontem e com febre"
          className={inputClass}
        />
      </div>

      <fieldset className={cardClass}>
        {/* legend flutuando para o título ficar dentro do cartão, igual aos outros blocos */}
        <legend className="float-left w-full text-lg font-semibold">Marque o que também está acontecendo</legend>
        <div className="clear-both flex flex-wrap gap-2 pt-3">
          {COMMON_SYMPTOMS.map((symptom) => {
            const on = checked.includes(symptom);
            return (
              <button
                key={symptom}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(symptom)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  on ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-muted"
                }`}
              >
                {symptom}
              </button>
            );
          })}
        </div>
        <label className="mt-4 block text-sm font-medium">
          Outros sintomas <span className="font-normal text-muted-foreground">(separe por vírgula)</span>
          <input name="others" placeholder="Ex.: dor no corpo, cansaço" className={inputClass} />
        </label>
      </fieldset>

      <fieldset className={cardClass}>
        <legend className="float-left w-full text-lg font-semibold">Desde quando?</legend>
        <div className="clear-both grid gap-2 pt-3 sm:grid-cols-4">
          {ONSET_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10"
            >
              <input type="radio" name="onset" value={option} className="accent-accent" />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={cardClass}>
        <label htmlFor="pain" className="text-lg font-semibold">
          Se está com dor, qual a intensidade?
        </label>
        <div className="mt-4 flex items-center gap-4">
          <input
            id="pain"
            type="range"
            min={0}
            max={10}
            value={pain}
            onChange={(e) => setPain(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="w-36 text-right font-semibold tabular-nums">
            {pain} · {PAIN_LABELS[pain]}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>0 sem dor</span>
          <span>10 insuportável</span>
        </div>
      </div>

      {canBePregnant && (
        <label className={`${cardClass} flex items-center gap-3 font-medium`}>
          <input name="pregnant" type="checkbox" className="h-5 w-5 accent-accent" />
          Estou grávida
        </label>
      )}

      {known.length > 0 && (
        <div className="rounded-xl bg-muted/60 px-5 py-4 text-sm">
          <p className="font-medium">Também vamos considerar o que está no seu histórico:</p>
          <p className="mt-1 text-muted-foreground">{known.join(" · ")}</p>
          <Link href="/historico" className="mt-2 inline-block text-accent underline">
            Atualizar meu histórico
          </Link>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-semibold text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Analisando…" : "Ver a urgência do meu caso"}
      </button>
    </form>
  );
}
