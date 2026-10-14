"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

// Podium styling, keyed by position (0 = first place).
const PODIUM = [
  {
    label: "1st",
    ring: "ring-[#D4AF37]",
    badge: "bg-[#FBF3D5] text-[#8A6A00]",
    pedestal: "from-[#FBF3D5] to-[#F3E4AE] border-[#D4AF37]/50",
    height: "h-20 sm:h-24",
    avatar: "h-16 w-16 sm:h-20 sm:w-20",
  },
  {
    label: "2nd",
    ring: "ring-[#9AA0AE]",
    badge: "bg-[#EEF0F3] text-[#555C6B]",
    pedestal: "from-[#F1F2F4] to-[#E1E4E9] border-[#9AA0AE]/50",
    height: "h-14 sm:h-16",
    avatar: "h-14 w-14 sm:h-16 sm:w-16",
  },
  {
    label: "3rd",
    ring: "ring-[#C08552]",
    badge: "bg-[#FAEADB] text-[#8F532B]",
    pedestal: "from-[#FBEEE3] to-[#F0D5BC] border-[#C08552]/50",
    height: "h-10 sm:h-12",
    avatar: "h-14 w-14 sm:h-16 sm:w-16",
  },
];

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

const formatScore = (n: number | null | undefined) =>
  n && n > 0 ? n.toLocaleString("en-US") : "—";

function Avatar({
  entry,
  className,
  textClass = "text-sm",
}: {
  entry: LeaderboardEntry;
  className: string;
  textClass?: string;
}) {
  const url = resolveAvatarUrl(entry.avatar);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${className} rounded-full object-cover`} />
  ) : (
    <span
      className={`${className} ${textClass} flex items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600`}
      aria-hidden="true"
    >
      {entry.username?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

function OnlineDot({ className }: { className: string }) {
  return (
    <span
      className={`absolute rounded-full border-2 border-white bg-emerald-500 ${className}`}
      title="Online"
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50" aria-busy="true" aria-label="Loading leaderboard">
      <div className="mx-auto max-w-3xl animate-pulse px-4 py-12 sm:py-16">
        <div className="mx-auto mb-10 h-8 w-48 rounded bg-gray-200" />
        <div className="mb-10 flex items-end justify-center gap-3 sm:gap-4">
          {[40, 56, 32].map((h, i) => (
            <div key={i} className="w-28 sm:w-40">
              <div className="h-44 rounded-t-2xl bg-gray-200" />
              <div className="rounded-b-lg bg-gray-300" style={{ height: h * 1.5 }} />
            </div>
          ))}
        </div>
        <div className="space-y-px overflow-hidden rounded-xl border border-gray-200 bg-white">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await getLeaderboard();
      setEntries(res.leaderboard);
      setPhase("loaded");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load leaderboard");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isMe = useCallback(
    (e: LeaderboardEntry) => user?.id != null && String(user.id) === String(e.id),
    [user]
  );

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  // Visual order: 2nd, 1st, 3rd, keeping 1st tallest in the middle.
  const podiumSlots = [1, 0, 2]
    .filter((i) => podium[i])
    .map((i) => ({ entry: podium[i], place: i }));

  // The API returns shared ranks for equal scores, so flag ties explicitly.
  const tiedRanks = useMemo(() => {
    const counts = new Map<number, number>();
    entries.forEach((e) => counts.set(e.rank, (counts.get(e.rank) ?? 0) + 1));
    return new Set([...counts].filter(([, c]) => c > 1).map(([r]) => r));
  }, [entries]);

  const myIndex = entries.findIndex(isMe);
  const me = myIndex >= 0 ? entries[myIndex] : null;
  const gapToNext =
    me && myIndex > 0 ? Math.max(0, (entries[myIndex - 1].top_score || 0) - (me.top_score || 0)) : 0;

  if (phase === "loading") return <LoadingSkeleton />;

  if (phase === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gray-50 px-4 py-24 text-center">
        <p className="text-sm font-semibold text-gray-900">Couldn&apos;t load the leaderboard</p>
        <p className="mt-1 text-sm text-gray-500">{errorMsg}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={load}
            className="rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
          >
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Header */}
        <header className="mb-8 text-center sm:mb-12">
          <h1 className={`${display.className} text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl`}>
            Leaderboard
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {entries.length > 0
              ? `Ranked by best score · ${entries.length} ${entries.length === 1 ? "player" : "players"}`
              : "Top scores across all players"}
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-900">No scores yet</p>
            <p className="mt-1 text-sm text-gray-500">Play a game to take the first spot.</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA]"
            >
              Start playing
            </Link>
          </div>
        ) : (
          <>
            {/* Your position */}
            {me && (
              <section
                aria-label="Your position"
                className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-[#4F46E5]/20 bg-[#4F46E5]/[0.05] px-4 py-3 sm:px-5"
              >
                <div className="flex items-center gap-3">
                  <Avatar entry={me} className="h-10 w-10" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Your position</p>
                    <p className="text-xs text-gray-500">
                      {gapToNext > 0
                        ? `${gapToNext.toLocaleString("en-US")} pts behind the player above`
                        : myIndex === 0
                        ? "You lead the board"
                        : "Tied with the player above"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`${display.className} text-xl font-bold tabular-nums text-[#4F46E5]`}>
                    {tiedRanks.has(me.rank) ? "T" : ""}#{me.rank}
                  </p>
                  <p className="text-xs tabular-nums text-gray-500">Best {formatScore(me.top_score)}</p>
                </div>
              </section>
            )}

            {/* Podium: top 3 */}
            <section aria-label="Top three players" className="mb-10 flex items-end justify-center gap-2 sm:gap-4">
              {podiumSlots.map(({ entry, place }) => {
                const s = PODIUM[place];
                const mine = isMe(entry);
                const date = formatDate(entry.top_score_at);

                return (
                  <div key={entry.id} className="flex w-28 flex-col items-center sm:w-40">
                    <div
                      className={`flex w-full flex-col items-center rounded-t-2xl border border-b-0 bg-white px-2 pb-4 pt-5 shadow-sm sm:px-3 ${
                        mine ? "border-[#4F46E5]/50" : "border-gray-200"
                      }`}
                    >
                      <div className={`relative rounded-full ring-2 ring-offset-2 ring-offset-white ${s.ring}`}>
                        <Avatar entry={entry} className={s.avatar} textClass="text-lg" />
                        {entry.is_online && <OnlineDot className="-bottom-0.5 -right-0.5 h-3.5 w-3.5" />}
                      </div>

                      <span className={`mt-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.badge}`}>
                        {s.label}
                      </span>

                      <p
                        className="mt-2 w-full truncate text-center text-sm font-semibold text-gray-900"
                        title={entry.username}
                      >
                        {entry.username}
                      </p>
                      {mine && <p className="text-[11px] font-medium text-[#4F46E5]">You</p>}

                      <p className={`${display.className} mt-2 text-xl font-bold tabular-nums text-gray-900 sm:text-2xl`}>
                        {formatScore(entry.top_score)}
                      </p>
                      <p className="text-[11px] text-gray-400">best score</p>

                      <p className="mt-2 text-center text-[11px] leading-4 text-gray-400">
                        Level {entry.level}
                        {date && <span className="block">{date}</span>}
                      </p>
                    </div>

                    <div
                      className={`flex w-full items-start justify-center rounded-b-lg border bg-gradient-to-b pt-2 ${s.pedestal} ${s.height}`}
                    >
                      <span className={`${display.className} text-xl font-bold tabular-nums text-gray-900/25`}>
                        {place + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Ranked list: 4th onward */}
            {rest.length > 0 && (
              <section
                aria-label="Full rankings"
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="hidden grid-cols-[3rem_1fr_4rem_5rem_6rem] items-center gap-4 border-b border-gray-200 bg-gray-50 px-6 py-2.5 text-xs font-medium text-gray-500 sm:grid">
                  <span className="text-center">Rank</span>
                  <span>Player</span>
                  <span className="text-right">Level</span>
                  <span className="text-right">XP</span>
                  <span className="text-right">Best score</span>
                </div>

                <ul className="divide-y divide-gray-100">
                  {rest.map((entry) => {
                    const mine = isMe(entry);
                    const date = formatDate(entry.top_score_at);
                    const tied = tiedRanks.has(entry.rank);

                    return (
                      <li
                        key={entry.id}
                        className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors sm:grid-cols-[3rem_1fr_4rem_5rem_6rem] sm:gap-4 sm:px-6 ${
                          mine ? "bg-[#4F46E5]/[0.06]" : "hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`${display.className} text-center text-sm font-bold tabular-nums text-gray-500`}
                          title={tied ? "Tied rank" : undefined}
                        >
                          {tied && <span className="mr-px text-[10px] font-medium text-gray-400">T</span>}
                          {entry.rank}
                        </span>

                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar entry={entry} className="h-9 w-9" />
                            {entry.is_online && <OnlineDot className="-bottom-0.5 -right-0.5 h-3 w-3" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {entry.username}
                              {mine && (
                                <span className="ml-2 rounded-full bg-[#4F46E5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#4F46E5]">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              <span className="sm:hidden">
                                Level {entry.level} · {entry.xp.toLocaleString("en-US")} XP
                                {date ? " · " : ""}
                              </span>
                              {date ? `Set ${date}` : <span className="hidden sm:inline">No score recorded</span>}
                            </p>
                          </div>
                        </div>

                        <span className="hidden text-right text-sm tabular-nums text-gray-600 sm:block">
                          {entry.level}
                        </span>
                        <span className="hidden text-right text-sm tabular-nums text-gray-600 sm:block">
                          {entry.xp.toLocaleString("en-US")}
                        </span>
                        <span
                          className={`${display.className} text-right text-base font-bold tabular-nums ${
                            entry.top_score > 0 ? "text-gray-900" : "text-gray-300"
                          }`}
                        >
                          {formatScore(entry.top_score)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}