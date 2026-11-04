import type { VitalSignsRecord } from "@/lib/api-types";
import { VITAL_FIELDS, criticalAlerts } from "@/lib/vital-signs";

// Valores medidos de uma vez, com os que estão fora da faixa em vermelho.
export function VitalSignsSummary({ vitals }: { vitals: VitalSignsRecord }) {
  const alerts = new Set(criticalAlerts(vitals).map((a) => a.key));
  const measured = VITAL_FIELDS.filter((f) => vitals[f.key] !== null && vitals[f.key] !== undefined);

  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      {measured.map((field) => (
        <div
          key={field.key}
          className={`rounded-md border px-3 py-2 ${alerts.has(field.key) ? "border-danger bg-danger/10" : "border-border"}`}
        >
          <dt className="text-xs text-muted-foreground">{field.label}</dt>
          <dd className={`font-semibold tabular-nums ${alerts.has(field.key) ? "text-danger" : ""}`}>
            {vitals[field.key]} <span className="text-xs font-normal text-muted-foreground">{field.unit}</span>
          </dd>
        </div>
      ))}
      {vitals.pain_score !== null && (
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted-foreground">Dor</dt>
          <dd className="font-semibold tabular-nums">
            {vitals.pain_score} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
          </dd>
        </div>
      )}
    </dl>
  );
}
