"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getActiveDuel } from "@/lib/api";

// Polls for an active duel and sends the user into it. This is what moves
// the challenger into the game once the friend accepts the challenge.
export default function ActiveDuelRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Already inside a duel
    if (pathname.startsWith("/duel/")) return;

    // Not logged in: nothing to check
    if (!localStorage.getItem("user")) return;

    let cancelled = false;

    const check = async () => {
      try {
        const data = await getActiveDuel();

        if (!cancelled && data.success && data.duelId) {
          router.push(`/duel/${data.duelId}`);
        }
      } catch {
        // ignore (not logged in, network hiccup, etc.)
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