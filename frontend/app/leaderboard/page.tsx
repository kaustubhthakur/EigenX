"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeaderboard, resolveAvatarUrl, type LeaderboardEntry } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type Phase = "loading" | "loaded" | "error";

const rankStyles: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-700 border-yellow-300",
  2: "bg-gray-100 text-gray-700 border-gray-300",
  3: "bg-orange-100 text-orange-700 border-orange-300",
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

  if (phase === "loading") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm font-medium text-red-600">{errorMsg}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Leaderboard</h1>
        <p className="mt-1 text-sm text-gray-500">Top scores across all players</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-sm text-gray-500">No scores yet — be the first to play!</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const isMe = user?.id === entry.id;
              const avatarUrl = resolveAvatarUrl(entry.avatar);

              return (
                <li
                  key={entry.id}
                  className={`flex items-center gap-4 px-4 py-3.5 sm:px-6 ${
                    isMe ? "bg-indigo-50/60" : ""
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      rankStyles[entry.rank] || "border-gray-200 text-gray-500"
                    }`}
                  >
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
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                        {entry.username?.[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                    {entry.is_online && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {entry.username}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-indigo-600">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      Level {entry.level} · {entry.xp} XP
                      {entry.top_score_at && (
                        <> · High score on {new Date(entry.top_score_at).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-bold text-indigo-600">
                    {entry.top_score}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}