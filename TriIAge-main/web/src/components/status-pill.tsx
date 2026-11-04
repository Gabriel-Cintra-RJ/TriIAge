import type { EncounterStatus } from "@/lib/api-types";
import { STATUS_LABELS } from "@/lib/format";

const STYLES: Record<EncounterStatus, string> = {
  waiting_nurse: "bg-warning-bg text-warning-fg",
  waiting_doctor: "bg-accent/15 text-accent",
  completed: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: EncounterStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
