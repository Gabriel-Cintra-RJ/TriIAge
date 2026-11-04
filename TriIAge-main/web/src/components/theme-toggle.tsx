"use client";

import { useSyncExternalStore } from "react";

type Theme = "claro" | "escuro";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "escuro" : "claro";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setTheme(theme: Theme) {
  if (theme === "escuro") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem("tema", theme);
  } catch {
    // navegador sem localStorage (aba anônima bloqueada): o tema só não fica salvo
  }
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // no servidor não dá para saber o tema, então assume o claro (que é o padrão)
  const theme = useSyncExternalStore(subscribe, readTheme, () => "claro" as Theme);
  const next = theme === "claro" ? "escuro" : "claro";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Mudar para o tema ${next}`}
      title={`Tema ${next}`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted ${className}`}
    >
      {theme === "claro" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
