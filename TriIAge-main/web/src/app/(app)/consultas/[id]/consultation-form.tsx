"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PrescriptionInput, PrescriptionItemInput } from "@/lib/api-types";

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const MAX_ITEMS = 20; // mesmo limite da API

const EMPTY_ITEM: PrescriptionItemInput = { name: "", dosage: "", frequency: "", duration: "", instructions: "" };

export function ConsultationForm({ encounterId, suggestions }: { encounterId: number; suggestions: string[] }) {
  const router = useRouter();
  const [items, setItems] = useState<PrescriptionItemInput[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(index: number, field: keyof PrescriptionItemInput, value: string) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    const input: PrescriptionInput = {
      diagnosis: String(form.get("diagnosis")).trim(),
      clinical_notes: text("clinical_notes"),
      recommendations: text("recommendations"),
      // linha sem nome de remédio é ignorada; campos vazios não vão
      items: items
        .filter((item) => item.name.trim())
        .map((item) =>
          Object.fromEntries(
            Object.entries(item)
              .map(([key, value]) => [key, (value ?? "").trim()])
              .filter(([, value]) => value),
          ) as PrescriptionItemInput,
        ),
    };

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/encounters/${encounterId}/prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível salvar a consulta.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-accent bg-surface p-5">
      <h2 className="font-semibold">Diagnóstico e receita</h2>

      <label className="block text-sm font-medium">
        Diagnóstico
        <input
          name="diagnosis"
          required
          minLength={3}
          maxLength={500}
          placeholder="Ex.: Faringoamigdalite bacteriana aguda"
          className={inputClass}
        />
      </label>

      <label className="block text-sm font-medium">
        Observações clínicas <span className="font-normal text-muted-foreground">(o paciente não vê)</span>
        <textarea name="clinical_notes" rows={3} className={inputClass} />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">Receituário</legend>
        <p className="text-xs text-muted-foreground">
          Escreva o remédio como na receita. O sistema procura a bula de cada um para mostrar ao paciente.
        </p>
        <datalist id="medication-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <ol className="mt-3 space-y-4">
          {items.map((item, index) => (
            <li key={index} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Remédio {index + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    className="text-xs text-muted-foreground underline hover:text-danger"
                  >
                    Remover
                  </button>
                )}
              </div>
              <input
                list="medication-suggestions"
                value={item.name}
                onChange={(e) => update(index, "name", e.target.value)}
                placeholder="Ex.: Amoxicilina 500 mg"
                aria-label={`Nome do remédio ${index + 1}`}
                className={inputClass}
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  value={item.dosage}
                  onChange={(e) => update(index, "dosage", e.target.value)}
                  placeholder="Dose (1 cápsula)"
                  aria-label="Dose"
                  className={inputClass}
                />
                <input
                  value={item.frequency}
                  onChange={(e) => update(index, "frequency", e.target.value)}
                  placeholder="Intervalo (8 em 8 h)"
                  aria-label="Intervalo"
                  className={inputClass}
                />
                <input
                  value={item.duration}
                  onChange={(e) => update(index, "duration", e.target.value)}
                  placeholder="Duração (7 dias)"
                  aria-label="Duração"
                  className={inputClass}
                />
              </div>
              <input
                value={item.instructions}
                onChange={(e) => update(index, "instructions", e.target.value)}
                placeholder="Orientação (ex.: tomar após as refeições)"
                aria-label="Orientação"
                className={inputClass}
              />
            </li>
          ))}
        </ol>
        {items.length < MAX_ITEMS && (
          <button
            type="button"
            onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
            className="mt-3 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            + Adicionar remédio
          </button>
        )}
      </fieldset>

      <label className="block text-sm font-medium">
        Recomendações ao paciente
        <textarea
          name="recommendations"
          rows={3}
          placeholder="Ex.: repouso, hidratação, retornar se a febre passar de 48 horas"
          className={inputClass}
        />
      </label>

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
        {pending ? "Salvando e consultando as bulas…" : "Finalizar consulta e enviar receita ao paciente"}
      </button>
    </form>
  );
}
