"use client";

import { useState } from "react";
import type { Medication, MedicationLookupResult, MedicationResult } from "@/lib/triage-types";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const sectionClass = "rounded-lg border border-border bg-surface p-5";
const MAX_ITEMS = 20; // mesmo limite da API

export function MedicationLookup({ suggestions }: { suggestions: string[] }) {
  const [items, setItems] = useState<string[]>([""]);
  const [result, setResult] = useState<MedicationLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(index: number, value: string) {
    setItems((current) => current.map((item, i) => (i === index ? value : item)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const medications = items.map((item) => item.trim()).filter(Boolean);
    if (medications.length === 0) {
      setError("Informe pelo menos um medicamento.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/medications/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medications }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível consultar os medicamentos.");
        return;
      }
      setResult(body);
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 max-w-3xl space-y-6">
      <form onSubmit={handleSubmit} className={sectionClass}>
        <p className="font-semibold">Medicamentos da receita</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pode digitar como está na receita (ex.: &quot;Losartana 50mg&quot;, &quot;Amoxil&quot;).
        </p>

        <datalist id="medication-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <ul className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <input
                value={item}
                onChange={(e) => update(index, e.target.value)}
                list="medication-suggestions"
                placeholder={`Medicamento ${index + 1}`}
                aria-label={`Medicamento ${index + 1}`}
                className={inputClass}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  className="rounded-md border border-border px-3 text-sm hover:bg-muted"
                  aria-label={`Remover medicamento ${index + 1}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={items.length >= MAX_ITEMS}
            onClick={() => setItems((current) => [...current, ""])}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            + Adicionar medicamento
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-6 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Consultando…" : "Consultar bulas"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section aria-live="polite" className="space-y-4">
          {result.results.map((item, index) => (
            <ResultCard key={`${item.query}-${index}`} item={item} />
          ))}
          <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
        </section>
      )}
    </div>
  );
}

function ResultCard({ item }: { item: MedicationResult }) {
  return (
    <article className={sectionClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">“{item.query}”</h2>
        <span className="text-xs text-muted-foreground">
          {item.match_method === "jev" ? "identificado pelo JEV" : item.found ? "encontrado pelo nome" : "não encontrado"}
        </span>
      </div>
      <p
        className={`mt-2 text-sm ${item.found ? "text-muted-foreground" : "rounded-md bg-warning-bg px-4 py-3 text-warning-fg"}`}
      >
        {item.message}
      </p>
      {item.medications.map((med) => (
        <MedicationDetails key={med.id} med={med} />
      ))}
    </article>
  );
}

function MedicationDetails({ med }: { med: Medication }) {
  return (
    <div className="mt-4 border-t border-border pt-4 text-sm">
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
        <Detail label="Condições relacionadas" values={med.related_conditions} />
        {med.mechanism_of_action && <Detail label="Como age" values={[med.mechanism_of_action]} />}
        <Detail label="Via" values={med.administration_routes} />
        {med.age_range && <Detail label="Faixa etária" values={[med.age_range]} />}
        <Detail label="Contraindicações" values={med.contraindications} />
        <Detail label="Advertências" values={med.warnings} />
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
