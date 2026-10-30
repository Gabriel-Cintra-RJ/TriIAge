"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
    >
      Sair
    </button>
  );
}
