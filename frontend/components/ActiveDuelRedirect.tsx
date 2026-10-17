"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getActiveDuel } from "@/lib/api";

// Polls for an active duel and sends the user into it. This is what moves
// the challenger into the game once the friend accepts the challenge.
export default function ActiveDuelRedirect() {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    // Already inside a duel
    if (pathname.startsWith("/duel/")) return;

    let cancelled = false;
    let lastError = "";

    const check = async () => {
      try {
        const data = await getActiveDuel();

        if (!cancelled && data.success && data.duelId) {
          router.push(`/duel/${data.duelId}`);
        }
      } catch (err) {
        // Logged once per distinct error so you can see why it fails
        // (401 = not logged in, 400/404/500 = route problem)
        const message = err instanceof Error ? err.message : String(err);

        if (message !== lastError) {
          lastError = message;
          console.warn("[ActiveDuelRedirect] /duel/active failed:", message);
        }
      }
    };

    check();
    const interval = window.setInterval(check, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pathname, router]);

  return null;
}