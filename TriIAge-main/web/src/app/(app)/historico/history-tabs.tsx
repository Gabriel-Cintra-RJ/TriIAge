"use client";

import { useState } from "react";

type Tab = { id: string; label: string; content: React.ReactNode };

// O conteúdo de cada aba já vem pronto do servidor; aqui só troca qual aparece.
// No celular as abas não cabem lado a lado, então viram um select.
export function HistoryTabs({ tabs, initial }: { tabs: Tab[]; initial?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial! : tabs[0].id);

  return (
    <div>
      <label className="block text-sm font-medium sm:hidden">
        Ver
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </label>

      <div role="tablist" aria-label="Histórico" className="hidden flex-wrap gap-1 border-b border-border sm:flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={active !== tab.id} className="pt-6">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
