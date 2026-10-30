import Link from "next/link";
import { Suspense } from "react";
import { LevelBadge } from "@/components/level-badge";
import { requireUser } from "@/lib/auth";
import { LEVEL_MEANING } from "@/lib/levels";
import { ROLE_LABELS, areasFor } from "@/lib/roles";
import { triageApi } from "@/lib/triage-api";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <AccessDenied searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<div className="h-24" />}>
        <Welcome />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Níveis de urgência</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A mesma régua usada pela base de pré-consulta da API.
          </p>
          <Classifications />
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Status da API de triagem</h2>
          <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground">Verificando…</p>}>
            <ApiStatus />
          </Suspense>
        </section>
      </div>
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

async function Welcome() {
  const user = await requireUser();
  const areas = areasFor(user.role);

  return (
    <section>
      <h1 className="text-2xl font-semibold">Olá, {user.name}</h1>
      <p className="mt-1 text-muted-foreground">Perfil: {ROLE_LABELS[user.role]}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {areas.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium hover:border-accent"
          >
            {area.label} →
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Erros da API viram null; o componente decide o que mostrar. */
async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

// os níveis são fixos (1 a 5), então não precisa buscar na API
function Classifications() {
  return (
    <ul className="mt-4 space-y-3">
      {[1, 2, 3, 4, 5].map((priority) => (
        <li key={priority} className="flex flex-wrap items-center gap-3">
          <LevelBadge priority={priority} />
          <span className="text-sm text-muted-foreground">{LEVEL_MEANING[priority]}</span>
        </li>
      ))}
    </ul>
  );
}

async function ApiStatus() {
  const health = await orNull(triageApi.health());
  if (!health) {
    return (
      <p className="mt-4 text-sm text-danger">
        API indisponível. Confira TRIAGE_API_URL e se o microsserviço está no ar.
      </p>
    );
  }

  return (
    <dl className="mt-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">API</dt>
        <dd className="font-medium text-level-4">{health.status}</dd>
      </div>
      <div className="flex justify-between">
        {/* o /health da API só responde ok se conseguir consultar o banco */}
        <dt className="text-muted-foreground">Banco</dt>
        <dd className="font-medium">conectado</dd>
      </div>
    </dl>
  );
}
