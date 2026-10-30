import type { Metadata } from "next";
import { Suspense } from "react";
import { UsageNotice } from "@/components/usage-notice";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold tracking-tight">
          Tri<span className="text-accent">IA</span>ge
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apoio à decisão clínica na classificação de risco.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <details className="mt-4 text-sm text-muted-foreground">
          <summary className="cursor-pointer">Contas de demonstração</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            <li>recepcao@triiage.local</li>
            <li>enfermagem@triiage.local</li>
            <li>medico@triiage.local</li>
            <li>auditoria@triiage.local</li>
            <li>gestao@triiage.local</li>
          </ul>
          <p className="mt-2">Senha: valor de AUTH_DEMO_PASSWORD no .env.local.</p>
        </details>

        <UsageNotice className="mt-8" />
      </div>
    </main>
  );
}
