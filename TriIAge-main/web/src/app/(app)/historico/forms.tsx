"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HealthCategory } from "@/lib/api-types";
import { CATEGORY_LABELS } from "@/lib/format";
import { VITAL_FIELDS } from "@/lib/vital-signs";

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const buttonClass =
  "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60";

// todo formulário daqui faz a mesma coisa: manda pro BFF e recarrega a página para a lista atualizar
function useSend() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(url: string, method: "POST" | "DELETE", body?: unknown) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Não foi possível salvar.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Falha de conexão. Tente de novo.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { send, error, pending };
}

// campos vazios não vão para a API
function compact(form: FormData) {
  const data: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && value.trim()) data[key] = value.trim();
  }
  return data;
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

export function VitalSignsForm() {
  const { send, error, pending } = useSend();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const values = Object.fromEntries(Object.entries(compact(new FormData(formEl))).map(([k, v]) => [k, Number(v)]));
    if (Object.keys(values).length === 0) return;
    if (await send("/api/me/vital-signs", "POST", values)) formEl.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VITAL_FIELDS.map((field) => (
          <label key={field.key} className="text-sm font-medium">
            {field.label} <span className="font-normal text-muted-foreground">({field.unit})</span>
            <input
              name={field.key}
              type="number"
              inputMode="decimal"
              min={field.min}
              max={field.max}
              step={field.step}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <ErrorText error={error} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Salvando…" : "Registrar medição"}
      </button>
    </form>
  );
}

export function MedicationForm() {
  const { send, error, pending } = useSend();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    if (await send("/api/me/medications", "POST", compact(new FormData(formEl)))) formEl.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Remédio
          <input name="name" required minLength={2} placeholder="Ex.: Metformina" className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Dose
          <input name="dosage" placeholder="Ex.: 850 mg" className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Intervalo entre as doses
          <input name="frequency" placeholder="Ex.: de 12 em 12 horas" className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Começou em
          <input name="started_on" type="date" className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Parou em <span className="font-normal text-muted-foreground">(vazio se ainda toma)</span>
          <input name="ended_on" type="date" className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Observação
          <input name="notes" placeholder="Ex.: depois do café" className={inputClass} />
        </label>
      </div>
      <ErrorText error={error} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Salvando…" : "Adicionar remédio"}
      </button>
    </form>
  );
}

export function HealthRecordForm() {
  const { send, error, pending } = useSend();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    if (await send("/api/me/health-records", "POST", compact(new FormData(formEl)))) formEl.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm font-medium">
          Tipo
          <select name="category" required defaultValue="condition" className={inputClass}>
            {(Object.keys(CATEGORY_LABELS) as HealthCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-3">
          Descrição
          <input
            name="description"
            required
            minLength={2}
            placeholder="Ex.: Diabetes tipo 2, alergia a camarão, retirada da vesícula"
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium">
          Desde / data
          <input name="started_on" type="date" className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Até <span className="font-normal text-muted-foreground">(se já passou)</span>
          <input name="ended_on" type="date" className={inputClass} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Observação
          <input name="notes" className={inputClass} />
        </label>
      </div>
      <ErrorText error={error} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Salvando…" : "Adicionar ao histórico"}
      </button>
    </form>
  );
}

export function DeleteButton({ url, label }: { url: string; label: string }) {
  const { send, error, pending } = useSend();

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Remover "${label}" do seu histórico?`)) send(url, "DELETE");
        }}
        className="text-xs text-muted-foreground underline hover:text-danger disabled:opacity-60"
      >
        Remover
      </button>
      <ErrorText error={error} />
    </span>
  );
}
