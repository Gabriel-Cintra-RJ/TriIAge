import Link from "next/link";
import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out-button";
import { UsageNotice } from "@/components/usage-notice";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, areasFor } from "@/lib/roles";
import { isMockMode } from "@/lib/triage-api";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Tri<span className="text-accent">IA</span>ge
          </Link>
          <Suspense fallback={<div className="h-9 flex-1" />}>
            <SessionChrome />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <MockBanner />
        </Suspense>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-border">
        <UsageNotice className="mx-auto max-w-6xl px-4 py-4" />
      </footer>
    </div>
  );
}

async function MockBanner() {
  if (!(await isMockMode())) return null;
  return (
    <div className="bg-warning-bg px-4 py-1.5 text-center text-xs font-medium text-warning-fg">
      Modo simulado: respostas da API de triagem são fictícias (TRIAGE_API_MOCK=true).
    </div>
  );
}

async function SessionChrome() {
  const user = await requireUser();

  return (
    <>
      <nav aria-label="Principal" className="flex flex-1 flex-wrap gap-1">
        {areasFor(user.role).map((area) => (
          <NavLink key={area.href} href={area.href}>
            {area.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
        </div>
        <SignOutButton />
      </div>
    </>
  );
}
