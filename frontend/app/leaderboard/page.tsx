"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { getLeaderboard, resolveAvatarUrl, type LeaderboardEntry } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

type Phase = "loading" | "loaded" | "error";

const PODIUM_STYLE: Record<
  number,
  { label: string; ring: string; text: string; pedestal: string; height: string }
> = {
  1: {
    label: "1st",
    ring: "ring-[#D4AF37]",
    text: "text-[#B8860B]",
    pedestal: "bg-gradient-to-b from-[#FDF6E3] to-[#F5EBCB] border-[#D4AF37]/40",
    height: "h-24 sm:h-28",
  },
  2: {
    label: "2nd",
    ring: "ring-[#9AA0AE]",
    text: "text-[#6B7280]",
    pedestal: "bg-gradient-to-b from-[#F1F2F4] to-[#E4E6EA] border-[#9AA0AE]/40",
    height: "h-16 sm:h-20",
  },
  3: {
    label: "3rd",
    ring: "ring-[#C08552]",
    text: "text-[#A9673A]",
    pedestal: "bg-gradient-to-b from-[#FBEEE3] to-[#F3DCC7] border-[#C08552]/40",
    height: "h-12 sm:h-14",
  },
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

  // Visual order on the podium: 2nd - 1st - 3rd, 1st standing tallest in the middle.
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardEntry[];

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gray-50 px-4 py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gray-50 px-4 py-24 text-center">
        <p className="text-sm font-medium text-red-500">{errorMsg}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA]"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="mb-10 text-center sm:mb-14">
          <h1 className={`${display.className} mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl`}>
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {entries.length > 0 ? `${entries.length} players competing` : "Top scores across all players"}
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No scores yet. Be the first on the board.</p>
          </div>
        ) : (
          <>
            {/* Podium — top 3. Card content has a natural height; only the pedestal
                bar beneath it varies in height, so nothing ever clips or overflows. */}
            <div className="mb-10 flex items-end justify-center gap-3 sm:gap-4">
              {podiumOrder.map((entry) => {
                const isMe = user?.id === entry.id;
                const avatarUrl = resolveAvatarUrl(entry.avatar);
                const style = PODIUM_STYLE[entry.rank] ?? PODIUM_STYLE[3];

                return (
                  <div key={entry.id} className="flex w-24 flex-col items-center sm:w-32">
                    <div
                      className={`flex w-full flex-col items-center gap-2 rounded-t-2xl border border-b-0 bg-white px-3 pb-4 pt-6 shadow-sm ${
                        isMe ? "border-[#4F46E5]/50" : "border-gray-200"
                      }`}
                    >
                      <div className={`relative shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-white ${style.ring}`}>
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={entry.username}
                            className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14"
                          />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-base font-semibold text-gray-700 sm:h-14 sm:w-14">
                            {entry.username?.[0]?.toUpperCase() || "?"}
                          </span>
                        )}
                        {entry.is_online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#22C55E]" />
                        )}
                      </div>

                      <span className={`${display.className} text-[11px] font-bold tracking-wide ${style.text}`}>
                        {style.label}
                      </span>

                      <div className="w-full text-center">
                        <p className="truncate text-xs font-semibold text-gray-900 sm:text-sm">
                          {entry.username}
                        </p>
                        {isMe && (
                          <p className="text-[10px] font-medium text-[#4F46E5]">You</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          Level {entry.level}
                          {entry.top_score_at && (
                            <> · {new Date(entry.top_score_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>

                      <p className={`${display.className} text-sm font-bold text-gray-900 sm:text-base`}>
                        {entry.top_score}
                      </p>
                    </div>

                    <div
                      className={`flex w-full items-start justify-center rounded-b-lg border pt-2 ${style.pedestal} ${style.height} ${
                        isMe ? "border-[#4F46E5]/50" : ""
                      }`}
                    >
                      <span className={`${display.className} text-lg font-black text-gray-900/15 sm:text-xl`}>
                        {entry.rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ranked list — 4th onward */}
            {rest.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <ul className="divide-y divide-gray-100">
                  {rest.map((entry) => {
                    const isMe = user?.id === entry.id;
                    const avatarUrl = resolveAvatarUrl(entry.avatar);
                    const barWidth = Math.max(4, Math.round(((entry.top_score || 0) / maxScore) * 100));

                    return (
                      <li key={entry.id} className="relative">
                        {/* score bar — width encodes score relative to the top score */}
                        <span
                          className="pointer-events-none absolute inset-y-0 left-0 bg-[#4F46E5]/[0.04]"
                          style={{ width: `${barWidth}%` }}
                          aria-hidden="true"
                        />
                        <div
                          className={`relative flex items-center gap-4 px-4 py-3.5 transition-colors sm:px-6 ${
                            isMe ? "bg-[#4F46E5]/[0.06]" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className={`${display.className} w-6 shrink-0 text-center text-sm font-bold text-gray-400`}>
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
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                                {entry.username?.[0]?.toUpperCase() || "?"}
                              </span>
                            )}
                            {entry.is_online && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#22C55E]" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {entry.username}
                              {isMe && (
                                <span className="ml-1.5 rounded-full bg-[#4F46E5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#4F46E5]">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">
                              Level {entry.level} · {entry.xp} XP
                              {entry.top_score_at && (
                                <> · High score {new Date(entry.top_score_at).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>

                          <span className={`${display.className} shrink-0 text-sm font-bold text-gray-900`}>
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