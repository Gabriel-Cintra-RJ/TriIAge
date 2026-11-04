import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { DoctorDashboard, NurseDashboard } from "./_painel/equipe";
import { ManagementDashboard } from "./_painel/gestao";
import { PatientDashboard } from "./_painel/paciente";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <AccessDenied searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando seu painel…</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function AccessDenied({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { negado } = await searchParams;
  if (!negado) return null;
  return (
    <p role="alert" className="rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning-fg">
      Seu perfil não tem acesso à área solicitada.
    </p>
  );
}

async function Dashboard() {
  const user = await requireUser();
  switch (user.role) {
    case "PACIENTE":
      return <PatientDashboard user={user} />;
    case "ENFERMEIRO":
    case "RECEPCIONISTA":
      return <NurseDashboard user={user} />;
    case "MEDICO":
      return <DoctorDashboard user={user} />;
    default:
      return <ManagementDashboard user={user} />;
  }
}
