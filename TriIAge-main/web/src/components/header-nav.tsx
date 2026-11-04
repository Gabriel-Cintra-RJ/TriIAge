"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { NavArea } from "@/lib/roles";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

type Props = {
  areas: Pick<NavArea, "href" | "label">[];
  userName: string;
  roleLabel: string;
};

export function HeaderNav({ areas, userName, roleLabel }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const user = (
    <div className="leading-tight md:text-right">
      <div className="text-sm font-medium">{userName}</div>
      <div className="text-xs text-muted-foreground">{roleLabel}</div>
    </div>
  );

  return (
    <>
      <nav aria-label="Principal" className="hidden flex-1 flex-wrap gap-1 md:flex">
        {areas.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            aria-current={isActive(area.href) ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive(area.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {area.label}
          </Link>
        ))}
      </nav>

      <div className="hidden items-center gap-3 md:flex">
        {user}
        <ThemeToggle />
        <SignOutButton />
      </div>

      {/* celular e tablet pequeno: tudo vai para dentro do menu */}
      <div className="ml-auto flex items-center gap-2 md:hidden">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-celular"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div id="menu-celular" className="w-full border-t border-border pt-3 md:hidden">
          <nav aria-label="Principal" className="flex flex-col gap-1">
            {areas.map((area) => (
              <Link
                key={area.href}
                href={area.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(area.href) ? "page" : undefined}
                className={`rounded-md px-3 py-3 font-medium ${
                  isActive(area.href) ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                }`}
              >
                {area.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 pb-1">
            {user}
            <SignOutButton />
          </div>
        </div>
      )}
    </>
  );
}
