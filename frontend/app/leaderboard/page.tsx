"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getLeaderboard, resolveAvatarUrl, type LeaderboardEntry } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type Phase = "loading" | "loaded" | "error";

// Rank 1/2/3 get a restrained medal ring. Everyone else gets a plain numbered slot.
const medal: Record<number, { ring: string; text: string; label: string }> = {
  1: { ring: "ring-[#C9A227]", text: "text-[#C9A227]", label: "1st" },
  2: { ring: "ring-[#9AA0AE]", text: "text-[#9AA0AE]", label: "2nd" },
  3: { ring: "ring-[#B0805A]", text: "text-[#B0805A]", label: "3rd" },
};

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getLeaderboard();
        setEntries(res.leaderboard);
        setPhase("loaded");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load leaderboard");
        setPhase("error");
      }
    })();
  }, []);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const maxScore = useMemo(() => Math.max(1, ...entries.map((e) => e.top_score || 0)), [entries]);

  // Podium visual order: 2nd - 1st - 3rd, with 1st sitting tallest in the middle.
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardEntry[];
  const podiumHeight: Record<number, string> = { 1: "sm:h-40", 2: "sm:h-28", 3: "sm:h-20" };

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#0B0C10] px-4 py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#5B5FEF] border-t-transparent" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#0B0C10] px-4 py-24 text-center">
        <p className="text-sm font-medium text-[#E8697A]">{errorMsg}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-[#5B5FEF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4B4FD9]"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0C10]">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap");
        .font-display {
          font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        }
      `}</style>

      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#7377A8]">
            Season standings
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight text-[#F4F4F6]">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-[#8B8D9A]">
            {entries.length > 0 ? `${entries.length} players competing` : "Top scores across all players"}
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2A2D38] bg-[#111319] px-6 py-16 text-center">
            <p className="text-sm text-[#8B8D9A]">No scores yet. Be the first on the board.</p>
          </div>
        ) : (
          <>
            {/* Podium — top 3 */}
            <div className="mb-8 flex items-end justify-center gap-3 sm:gap-4">
              {podiumOrder.map((entry) => {
                const isMe = user?.id === entry.id;
                const avatarUrl = resolveAvatarUrl(entry.avatar);
                const m = medal[entry.rank] ?? medal[3];
                return (
                  <div
                    key={entry.id}
                    className={`flex w-24 flex-col items-center rounded-xl border bg-[#14151B] px-3 pb-4 pt-6 shadow-sm sm:w-32 ${podiumHeight[entry.rank] ?? ""} ${
                      isMe ? "border-[#3E41A8]" : "border-[#22242E]"
                    }`}
                  >
                    <div className={`relative rounded-full ring-2 ring-offset-2 ring-offset-[#14151B] ${m.ring}`}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={entry.username}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1F2129] text-base font-semibold text-[#F4F4F6]">
                          {entry.username?.[0]?.toUpperCase() || "?"}
                        </span>
                      )}
                      {entry.is_online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#14151B] bg-[#34D399]" />
                      )}
                    </div>
                    <span className={`font-display mt-2 text-[11px] font-semibold tracking-wide ${m.text}`}>{m.label}</span>
                    <p className="mt-1 w-full truncate text-center text-xs font-semibold text-[#F4F4F6]">
                      {entry.username}
                      {isMe && <span className="block text-[10px] font-normal text-[#8A8EE0]">You</span>}
                    </p>
                    <p className="font-display mt-1 text-sm font-semibold text-[#F4F4F6]">{entry.top_score}</p>
                  </div>
                );
              })}
            </div>

            {/* Ranked list — 4th onward */}
            {rest.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[#22242E] bg-[#111319]">
                <ul className="divide-y divide-[#1D1F28]">
                  {rest.map((entry) => {
                    const isMe = user?.id === entry.id;
                    const avatarUrl = resolveAvatarUrl(entry.avatar);
                    const barWidth = Math.max(4, Math.round(((entry.top_score || 0) / maxScore) * 100));

                    return (
                      <li key={entry.id} className="relative">
                        {/* score bar — width encodes score relative to the top score */}
                        <span
                          className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.03]"
                          style={{ width: `${barWidth}%` }}
                          aria-hidden="true"
                        />
                        <div
                          className={`relative flex items-center gap-4 px-4 py-3.5 transition-colors sm:px-6 ${
                            isMe ? "bg-[#3E41A8]/[0.10]" : "hover:bg-[#161822]"
                          }`}
                        >
                          <span className="font-display w-6 shrink-0 text-center text-sm font-bold text-[#565A68]">
                            {entry.rank}
                          </span>

                          <div className="relative shrink-0">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={entry.username}
                                className="h-9 w-9 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1F2129] text-sm font-semibold text-[#F4F4F6]">
                                {entry.username?.[0]?.toUpperCase() || "?"}
                              </span>
                            )}
                            {entry.is_online && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111319] bg-[#34D399]" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#F4F4F6]">
                              {entry.username}
                              {isMe && (
                                <span className="ml-1.5 rounded-full bg-[#3E41A8]/25 px-1.5 py-0.5 text-[10px] font-medium text-[#9EA1E8]">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[#71758A]">
                              Level {entry.level} · {entry.xp} XP
                              {entry.top_score_at && (
                                <> · High score {new Date(entry.top_score_at).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>

                          <span className="font-display shrink-0 text-sm font-bold text-[#F4F4F6]">
                            {entry.top_score}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}