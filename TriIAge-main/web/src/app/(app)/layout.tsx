import Link from "next/link";
import { Suspense } from "react";
import { HeaderNav } from "@/components/header-nav";
import { UsageNotice } from "@/components/usage-notice";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, areasFor } from "@/lib/roles";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Tri<span className="text-accent">IA</span>ge
          </Link>
          <Suspense fallback={<div className="h-9 flex-1" />}>
            <SessionChrome />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-border print:hidden">
        <UsageNotice className="mx-auto max-w-6xl px-4 py-4" />
      </footer>
    </div>
  );
}

async function SessionChrome() {
  const user = await requireUser();
  const areas = areasFor(user.role).map(({ href, label }) => ({ href, label }));

  return <HeaderNav areas={areas} userName={user.name} roleLabel={ROLE_LABELS[user.role]} />;
}
