"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/** Aceita só caminhos internos, para não virar redirecionamento aberto. */
function safeCallback(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm() {
  const router = useRouter();
  const callbackUrl = safeCallback(useSearchParams().get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    if (result?.ok) {
      router.replace(callbackUrl);
      router.refresh();
      return;
    }
    setPending(false);
    setError("E-mail ou senha inválidos.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        E-mail
        <input name="email" type="email" required autoComplete="username" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Senha
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
