"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Space_Grotesk } from "next/font/google";
import { getLeaderboard, resolveAvatarUrl, type LeaderboardEntry } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

// Used for the numerals and the page title.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

type Phase = "loading" | "loaded" | "error";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const glass =
  "rounded-2xl bg-slate-950/60 ring-1 ring-cyan-300/10 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.7)]";

/** Which difficulty a player's best score was set on. */
const levelLabel = (d: number | null | undefined, score: number) =>
  score > 0 ? (d ? `Level ${d}` : "Custom") : "—";

const formatScore = (n: number | null | undefined) =>
  n && n > 0 ? n.toLocaleString("en-US") : "—";

/** Shield colour by rank band, like the tier badges in the reference. */
const tierOf = (rank: number) =>
  rank <= 3
    ? { name: "Podium", cls: "text-cyan-300" }
    : rank <= 10
      ? { name: "Top 10", cls: "text-fuchsia-300" }
      : { name: "Ranked", cls: "text-slate-500" };

const rankTone = (rank: number) =>
  rank === 2 ? "text-slate-200" : rank === 3 ? "text-orange-300" : "text-slate-400";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  rank: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  score: "M12 3v3m0 12v3M3 12h3m12 0h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  chase: "M7 17 17 7M9 7h8v8",
  level: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8",
  search: "m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4",
};

/** Shield with a star, used for the tier badge on every row and the champion. */
function Shield({ className = "h-7 w-7", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path
        d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m12 7.5 1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4L12 7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Avatar({
  entry,
  size,
  shape = "rounded-full",
  text = "text-xs",
}: {
  entry: LeaderboardEntry;
  size: string;
  shape?: string;
  text?: string;
}) {
  const url = resolveAvatarUrl(entry.avatar);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`${size} ${shape} shrink-0 object-cover ring-2 ring-white/10`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} ${shape} ${text} flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white ring-2 ring-white/10`}
    >
      {entry.username?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

function YouBadge() {
  return (
    <span className="shrink-0 rounded-full bg-indigo-400/15 px-1.5 py-px text-[10px] font-medium text-indigo-200 ring-1 ring-inset ring-indigo-300/30">
      You
    </span>
  );
}

/** Dark navy stage with a faint circuit pattern and neon flares. No WebGL. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.16] [mask-image:radial-gradient(80%_65%_at_50%_25%,#000,transparent)]"
          aria-hidden="true"
        >
          <defs>
            <pattern id="lb-circuit" width="120" height="120" patternUnits="userSpaceOnUse">
              <path
                d="M0 30H50V0M70 120V90H120M0 90H20V60H60M100 0V40H120"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1"
              />
              <circle cx="50" cy="30" r="2.5" fill="#38bdf8" />
              <circle cx="120" cy="90" r="2.5" fill="#38bdf8" />
              <circle cx="60" cy="60" r="2.5" fill="#38bdf8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lb-circuit)" />
        </svg>
        <div className="absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_0%,rgba(99,102,241,0.28),transparent),radial-gradient(35%_30%_at_0%_45%,rgba(14,165,233,0.30),transparent),radial-gradient(35%_30%_at_100%_45%,rgba(14,165,233,0.30),transparent),radial-gradient(40%_30%_at_50%_100%,rgba(217,70,239,0.12),transparent)]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

type Stat = { label: string; value: string; hint?: string; icon: string; accent?: boolean };

function StatCards({ items }: { items: Stat[] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={`${glass} p-4 sm:p-5`}>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs font-medium text-slate-400">{item.label}</dt>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                item.accent
                  ? "bg-cyan-400/10 text-cyan-200 ring-cyan-300/30"
                  : "bg-white/[0.05] text-slate-400 ring-white/10"
              }`}
            >
              <Icon d={item.icon} />
            </span>
          </div>
          <dd
            className={`${display.className} mt-3 truncate text-2xl font-bold tabular-nums ${
              item.accent
                ? "bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent"
                : "text-white"
            }`}
          >
            {item.value}
          </dd>
          {item.hint && <p className="mt-1 truncate text-xs text-slate-500">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

/** Rank 1: large avatar, big score, a few facts. */
function Champion({
  entry,
  mine,
  lead,
}: {
  entry: LeaderboardEntry;
  mine: boolean;
  lead: number | null;
}) {
  return (
    <section
      aria-label="Current leader"
      className="relative mb-6 overflow-hidden rounded-3xl bg-slate-950/60 px-4 py-8 text-center ring-1 ring-cyan-300/20 backdrop-blur-xl shadow-[0_0_70px_-18px_rgba(56,189,248,0.55)] sm:py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,rgba(251,191,36,0.14),transparent_70%)]"
      />
      <div className="relative">
        <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
          <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-br from-amber-300/50 via-cyan-300/30 to-indigo-400/40 blur-xl" />
          <div className="relative rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 p-[3px]">
            <Avatar
              entry={entry}
              size="h-[106px] w-[106px] sm:h-[122px] sm:w-[122px]"
              shape="rounded-[1.25rem]"
              text="text-4xl"
            />
          </div>
          <Shield
            className="absolute -right-4 -top-3 h-11 w-11 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
            title="Rank 1"
          />
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-300">
          <span className={`${display.className} font-bold text-amber-300`}>#01</span>
          <span className="max-w-[16rem] truncate font-semibold text-white">{entry.username}</span>
          {mine && <YouBadge />}
        </p>
        <p
          className={`${display.className} mt-1 text-5xl font-bold tabular-nums tracking-tight text-white sm:text-6xl`}
        >
          {formatScore(entry.top_score)}
        </p>
        <p className="mt-1 text-xs text-slate-400">Best score</p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full bg-cyan-400/10 px-3 py-1 font-medium text-cyan-200 ring-1 ring-inset ring-cyan-300/20">
            Set on {levelLabel(entry.difficulty_level, entry.top_score)}
          </span>
          <span className="rounded-full bg-white/[0.06] px-3 py-1 font-medium tabular-nums text-slate-300 ring-1 ring-inset ring-white/10">
            Level {entry.level} · {entry.xp.toLocaleString("en-US")} XP
          </span>
          {lead !== null && lead > 0 && (
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 font-medium tabular-nums text-emerald-300 ring-1 ring-inset ring-emerald-300/20">
              +{lead.toLocaleString("en-US")} pts ahead of 2nd
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <Shell>
      <div
        className="mx-auto max-w-4xl animate-pulse px-4 py-10 sm:px-6 sm:py-14"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="h-9 w-48 rounded-lg bg-white/10" />
        <div className="mt-3 h-4 w-64 rounded bg-white/10" />
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] rounded-2xl bg-white/5 ring-1 ring-white/10" />
          ))}
        </div>
        <div className="mt-6 h-[300px] rounded-3xl bg-white/[0.03] ring-1 ring-white/10" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 ring-1 ring-white/10" />
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const cols =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto_1.75rem] sm:grid-cols-[3rem_minmax(0,1fr)_6rem_8rem_2rem] items-center gap-3 sm:gap-4";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "online">("all");

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

  /** Quiet refresh: keeps the page on screen instead of flashing the skeleton. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getLeaderboard();
      setEntries(res.leaderboard);
    } catch {
      /* keep what we have */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const meId = user?.id != null ? String(user.id) : null;
  const champion = entries[0] ?? null;
  const rest = useMemo(() => entries.slice(1), [entries]);

  const onlineCount = useMemo(() => rest.filter((e) => e.is_online).length, [rest]);
  const visibleRest = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rest.filter(
      (e) =>
        (filter === "all" || e.is_online) &&
        (!q || (e.username || "").toLowerCase().includes(q))
    );
  }, [rest, query, filter]);

  const tiedRanks = useMemo(() => {
    const counts = new Map<number, number>();
    entries.forEach((e) => counts.set(e.rank, (counts.get(e.rank) ?? 0) + 1));
    return new Set([...counts].filter(([, c]) => c > 1).map(([r]) => r));
  }, [entries]);

  const myIndex = meId ? entries.findIndex((e) => String(e.id) === meId) : -1;
  const me = myIndex >= 0 ? entries[myIndex] : null;
  const gap =
    me && myIndex > 0 ? Math.max(0, (entries[myIndex - 1].top_score || 0) - (me.top_score || 0)) : 0;
  const maxScore = entries[0]?.top_score || 0;
  const lead = entries.length > 1 ? (entries[0].top_score || 0) - (entries[1].top_score || 0) : null;

  if (phase === "loading") return <Skeleton />;

  if (phase === "error") {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-300 ring-1 ring-red-400/30">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <p className="mt-4 text-sm font-semibold text-white">Couldn&apos;t load the leaderboard</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{errorMsg}</p>
          <button
            onClick={load}
            className={`mt-5 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 ${focusRing}`}
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const stats: Stat[] = [
    me
      ? {
          label: "Your rank",
          value: `${tiedRanks.has(me.rank) ? "T" : ""}#${me.rank}`,
          hint: `of ${entries.length} players`,
          icon: ICONS.rank,
          accent: true,
        }
      : {
          label: "Players",
          value: entries.length.toLocaleString("en-US"),
          hint: "ranked",
          icon: ICONS.users,
          accent: true,
        },
    me
      ? {
          label: "Your best score",
          value: formatScore(me.top_score),
          hint:
            me.top_score > 0
              ? `Set on ${levelLabel(me.difficulty_level, me.top_score)}`
              : "Play a game to set one",
          icon: ICONS.score,
        }
      : { label: "Top score", value: formatScore(maxScore), icon: ICONS.score },
    me
      ? myIndex === 0
        ? { label: "Lead", value: "You’re 1st", hint: "Keep it up", icon: ICONS.chase }
        : {
            label: "To pass next",
            value: gap > 0 ? `${gap.toLocaleString("en-US")} pts` : "Tied",
            hint: "behind the player above",
            icon: ICONS.chase,
          }
      : { label: "Leader", value: entries[0]?.username ?? "—", icon: ICONS.chase },
    me
      ? { label: "Level", value: String(me.level), hint: `${me.xp.toLocaleString("en-US")} XP`, icon: ICONS.level }
      : { label: "Online now", value: String(entries.filter((e) => e.is_online).length), hint: "players", icon: ICONS.users },
  ];

  return (
    <Shell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className={`${display.className} text-3xl font-bold tracking-tight text-white sm:text-4xl`}
            >
              Leaderboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {entries.length > 0
                ? `${entries.length.toLocaleString("en-US")} ${entries.length === 1 ? "player" : "players"} ranked by best score`
                : "Rankings update as players finish games"}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={`inline-flex h-9 items-center gap-2 self-start rounded-lg bg-white/[0.05] px-3.5 text-sm font-medium text-slate-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-60 sm:self-auto ${focusRing}`}
          >
            <Icon d={ICONS.refresh} className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </header>

        {!champion ? (
          <div className={`${glass} border border-dashed border-white/15 px-6 py-16 text-center`}>
            <p className="text-sm font-semibold text-white">No scores yet</p>
            <p className="mt-1 text-sm text-slate-400">Finish a game to claim the first spot.</p>
          </div>
        ) : (
          <>
            <StatCards items={stats} />

            <Champion
              entry={champion}
              mine={meId !== null && String(champion.id) === meId}
              lead={lead}
            />

            {rest.length > 0 && (
              <section className={`overflow-hidden ${glass}`}>
                {/* Toolbar */}
                <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h2 className="text-sm font-semibold text-white">All players</h2>
                    <p className="text-xs text-slate-500">
                      Ranked 2nd and below · {rest.length.toLocaleString("en-US")}{" "}
                      {rest.length === 1 ? "player" : "players"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      role="group"
                      aria-label="Filter players"
                      className="inline-flex rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-inset ring-white/10"
                    >
                      {(
                        [
                          { id: "all", label: "All", count: rest.length },
                          { id: "online", label: "Online", count: onlineCount },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={filter === t.id}
                          onClick={() => setFilter(t.id)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
                            filter === t.id
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          } ${focusRing}`}
                        >
                          {t.id === "online" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          )}
                          {t.label}
                          <span className="tabular-nums text-slate-500">{t.count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                        <Icon d={ICONS.search} />
                      </span>
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search players"
                        aria-label="Search players"
                        className="h-9 w-full rounded-lg bg-white/[0.05] pl-8 pr-3 text-sm text-white outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-slate-500 focus:bg-white/[0.07] focus:ring-cyan-300/60"
                      />
                    </div>
                  </div>
                </div>

                {visibleRest.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <p className="text-sm font-semibold text-white">No players found</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Try a different name or switch the filter back to All.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-2 p-3 sm:p-4">
                    {visibleRest.map((entry) => {
                      const mine = meId !== null && String(entry.id) === meId;
                      const tied = tiedRanks.has(entry.rank);
                      const tier = tierOf(entry.rank);
                      const pct =
                        maxScore > 0 ? Math.max(2, ((entry.top_score || 0) / maxScore) * 100) : 0;
                      return (
                        <li
                          key={entry.id}
                          aria-current={mine ? "true" : undefined}
                          className={`relative rounded-xl px-3 py-2.5 ring-1 ring-inset transition-colors sm:px-4 ${cols} ${
                            mine
                              ? "bg-cyan-400/10 ring-cyan-300/40 shadow-[0_0_24px_-8px_rgba(56,189,248,0.6)]"
                              : "bg-slate-900/50 ring-white/10 hover:bg-slate-900/80 hover:ring-cyan-300/25"
                          }`}
                        >
                          <span
                            className={`${display.className} text-center text-base font-bold tabular-nums ${rankTone(entry.rank)}`}
                            title={tied ? "Tied rank" : undefined}
                          >
                            {tied ? "T" : ""}
                            {String(entry.rank).padStart(2, "0")}
                          </span>

                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative shrink-0">
                              <Avatar entry={entry} size="h-10 w-10" shape="rounded-lg" />
                              {entry.is_online && (
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                                  title="Online"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                                <span className="truncate">{entry.username}</span>
                                {mine && <YouBadge />}
                              </p>
                              <p className="mt-0.5 truncate text-xs tabular-nums text-slate-500">
                                Level {entry.level} · {entry.xp.toLocaleString("en-US")} XP
                                {entry.top_score > 0 && (
                                  <span className="sm:hidden">
                                    {" "}· {levelLabel(entry.difficulty_level, entry.top_score)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <span className="hidden sm:block">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                entry.top_score > 0
                                  ? "bg-cyan-400/10 text-cyan-200 ring-cyan-300/20"
                                  : "text-slate-600 ring-transparent"
                              }`}
                            >
                              {levelLabel(entry.difficulty_level, entry.top_score)}
                            </span>
                          </span>

                          <div className="text-right">
                            <span
                              className={`${display.className} text-lg font-bold tabular-nums ${
                                entry.top_score > 0 ? "text-white" : "text-slate-600"
                              }`}
                            >
                              {formatScore(entry.top_score)}
                            </span>
                            {entry.top_score > 0 && (
                              <div className="ml-auto mt-1 hidden h-1 w-full overflow-hidden rounded-full bg-white/10 sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    mine
                                      ? "bg-gradient-to-r from-cyan-300 to-indigo-400"
                                      : "bg-slate-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <Shield className={`h-7 w-7 justify-self-end ${tier.cls}`} title={tier.name} />
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="border-t border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-slate-500 sm:px-5">
                  Showing {visibleRest.length.toLocaleString("en-US")} of{" "}
                  {rest.length.toLocaleString("en-US")}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}