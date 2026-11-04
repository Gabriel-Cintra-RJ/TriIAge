"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// recarrega os dados da página de tempos em tempos (usado nas filas, para aparecer quem acabou de chegar)
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);

  return null;
}
