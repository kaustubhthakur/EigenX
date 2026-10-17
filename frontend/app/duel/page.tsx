"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelChallenge,
  challengeFriend,
  getActiveDuel,
  getConfigurations,
  getDuelStatus,
  getFriends,
  getIncomingChallenges,
  joinDuel,
  leaveDuelQueue,
  resolveAvatarUrl,
  respondToChallenge,
} from "../../lib/api";
import type { GameConfiguration } from "../../lib/api";
import type { Challenge, Duel } from "../../types/duel";

interface Friend {
  id: string | number;
  username: string;
  avatar?: string | null;
  is_online: boolean;
}

interface SentChallenge {
  id: string;
  friendName: string;
}

type IncomingChallenge = Challenge & {
  challenger_avatar?: string | null;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatTimer(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds}s`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function initials(name: string): string {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function Avatar({
  name,
  src,
  online,
}: {
  name: string;
  src?: string | null;
  online?: boolean;
}) {
  const url = resolveAvatarUrl(src);

  return (
    <div className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200">
          {initials(name)}
        </div>
      )}

      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
            online ? "bg-emerald-500" : "bg-slate-300"
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`}
    >
      <p>{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="-m-1 rounded p-1 opacity-60 transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.3 5.3a1 1 0 011.4 0L10 8.6l3.3-3.3a1 1 0 111.4 1.4L11.4 10l3.3 3.3a1 1 0 01-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 01-1.4-1.4L8.6 10 5.3 6.7a1 1 0 010-1.4z" />
        </svg>
      </button>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-16 rounded bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-16 rounded-lg bg-slate-100" />
            <div className="h-9 w-16 rounded-lg bg-slate-100" />
            <div className="h-9 w-16 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DuelLobbyPage() {
  const router = useRouter();

  const [configurations, setConfigurations] = useState<GameConfiguration[]>([]);
  const [selectedConfigurationId, setSelectedConfigurationId] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<
    IncomingChallenge[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [findingOpponent, setFindingOpponent] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [challengingFriendId, setChallengingFriendId] = useState<string | null>(
    null
  );
  const [respondingChallengeId, setRespondingChallengeId] = useState<
    string | null
  >(null);
  const [sentChallenge, setSentChallenge] = useState<SentChallenge | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const findingRef = useRef(false);

  const showDuel = useCallback(
    (duel: Duel) => {
      router.push(`/duel/${duel.id}`);
    },
    [router]
  );

  /* ---------------------------- data loading ---------------------------- */

  const loadLobby = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [configResponse, friendResponse, challengeResponse] =
        await Promise.all([
          getConfigurations(),
          getFriends(),
          getIncomingChallenges(),
        ]);

      setConfigurations(configResponse);

      const availableFriends = (
        friendResponse as unknown as { friends?: Friend[] }
      ).friends;

      setFriends(Array.isArray(availableFriends) ? availableFriends : []);

      setIncomingChallenges(
        Array.isArray(challengeResponse.challenges)
          ? (challengeResponse.challenges as IncomingChallenge[])
          : []
      );

      setSelectedConfigurationId((current) => {
        if (
          current &&
          configResponse.some(
            (configuration) => String(configuration.id) === current
          )
        ) {
          return current;
        }

        return "";
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load the duel lobby."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLobby();
  }, [loadLobby]);

  // Keep friends' online status and incoming challenges fresh without a
  // manual refresh.
  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const [friendResponse, challengeResponse] = await Promise.all([
          getFriends(),
          getIncomingChallenges(),
        ]);

        const availableFriends = (
          friendResponse as unknown as { friends?: Friend[] }
        ).friends;

        if (Array.isArray(availableFriends)) setFriends(availableFriends);

        if (Array.isArray(challengeResponse.challenges)) {
          setIncomingChallenges(
            challengeResponse.challenges as IncomingChallenge[]
          );
        }
      } catch {
        // silent: the next tick will try again
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  // Elapsed time while searching for an opponent
  useEffect(() => {
    if (!findingOpponent) {
      setSearchSeconds(0);
      return;
    }

    const interval = window.setInterval(
      () => setSearchSeconds((seconds) => seconds + 1),
      1000
    );

    return () => window.clearInterval(interval);
  }, [findingOpponent]);

  // After sending a challenge, wait for the friend to accept and enter
  // the duel as soon as it exists.
  useEffect(() => {
    if (!sentChallenge) return;

    const interval = window.setInterval(async () => {
      try {
        const data = await getActiveDuel();

        if (data.success && data.duelId) {
          setSentChallenge(null);
          router.push(`/duel/${data.duelId}`);
        }
      } catch {
        // silent
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [sentChallenge, router]);

  // Leave the matchmaking queue if the page is closed while searching
  useEffect(() => {
    return () => {
      if (findingRef.current) {
        findingRef.current = false;
        void leaveDuelQueue().catch(() => {});
      }
    };
  }, []);

  /* ------------------------------ actions ------------------------------- */

  const handleFindOpponent = async () => {
    const configurationId = String(selectedConfigurationId ?? "").trim();

    if (!configurationId) {
      setError("Choose a level and time limit first.");
      return;
    }

    if (findingRef.current) return;

    findingRef.current = true;
    setFindingOpponent(true);
    setError("");
    setMessage("");

    try {
      const result = await joinDuel(configurationId);

      if (result.matched && result.duel) {
        findingRef.current = false;
        setFindingOpponent(false);
        showDuel(result.duel);
        return;
      }

      while (findingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!findingRef.current) break;

        const status = await getDuelStatus();

        if (status.matched && status.duel) {
          findingRef.current = false;
          setFindingOpponent(false);
          showDuel(status.duel);
          return;
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to find an opponent."
      );
    } finally {
      findingRef.current = false;
      setFindingOpponent(false);
    }
  };

  const handleLeaveQueue = async () => {
    findingRef.current = false;
    setFindingOpponent(false);

    try {
      await leaveDuelQueue();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to leave the queue."
      );
    }
  };

  const handleChallengeFriend = async (friend: Friend) => {
    const normalizedFriendId = String(friend.id ?? "").trim();
    const configurationId = String(selectedConfigurationId ?? "").trim();

    if (!normalizedFriendId) {
      setError("Choose a friend to challenge.");
      return;
    }

    if (!configurationId) {
      setError("Choose a level and time limit before sending a challenge.");
      return;
    }

    setChallengingFriendId(normalizedFriendId);
    setError("");
    setMessage("");

    try {
      const result = await challengeFriend(normalizedFriendId, configurationId);

      const challengeId = (
        result as unknown as { challenge?: { id?: string | number } }
      ).challenge?.id;

      setSentChallenge({
        id: challengeId != null ? String(challengeId) : "",
        friendName: friend.username || "your friend",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send the challenge."
      );
    } finally {
      setChallengingFriendId(null);
    }
  };

  const handleRespondToChallenge = async (
    challengeId: string,
    accept: boolean
  ) => {
    setRespondingChallengeId(challengeId);
    setError("");

    try {
      const result = await respondToChallenge(challengeId, accept);

      setIncomingChallenges((current) =>
        current.filter((challenge) => String(challenge.id) !== challengeId)
      );

      if (accept && result.duel) {
        showDuel(result.duel);
        return;
      }

      setMessage(accept ? "Challenge accepted." : "Challenge declined.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to respond to challenge."
      );
    } finally {
      setRespondingChallengeId(null);
    }
  };

  const handleCancelChallenge = async () => {
    if (!sentChallenge) return;

    const { id } = sentChallenge;
    setSentChallenge(null);
    setError("");

    if (!id) return;

    try {
      await cancelChallenge(id);
      setMessage("Challenge cancelled.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel the challenge."
      );
    }
  };

  /* ------------------------------ derived ------------------------------- */

  const levels = useMemo(() => {
    const byLevel = new Map<number, GameConfiguration[]>();

    configurations.forEach((configuration) => {
      const list = byLevel.get(configuration.level) ?? [];
      list.push(configuration);
      byLevel.set(configuration.level, list);
    });

    return Array.from(byLevel.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, items]) => ({
        level,
        items: [...items].sort((a, b) => a.timer - b.timer),
      }));
  }, [configurations]);

  const selectedConfiguration = configurations.find(
    (configuration) => String(configuration.id) === selectedConfigurationId
  );

  const sortedFriends = useMemo(
    () =>
      [...friends].sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
        return (a.username || "").localeCompare(b.username || "");
      }),
    [friends]
  );

  const onlineCount = friends.filter((friend) => friend.is_online).length;

  const focusRing =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

  /* ------------------------------- render ------------------------------- */

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Duel lobby</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Race an opponent through the same questions. The first correct
            answer takes the point, and the highest score when time runs out
            wins.
          </p>
        </header>

        {(error || message) && (
          <div className="mb-6 space-y-3">
            {error && (
              <Banner tone="error" onDismiss={() => setError("")}>
                {error}
              </Banner>
            )}
            {message && (
              <Banner tone="success" onDismiss={() => setMessage("")}>
                {message}
              </Banner>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* -------------------------- Quick match -------------------------- */}
          <section
            aria-labelledby="quick-match-heading"
            className="self-start rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-3"
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 id="quick-match-heading" className="text-lg font-semibold">
                Quick match
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                We pair you with an online player close to your level.
              </p>
            </div>

            {findingOpponent ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-indigo-200 opacity-60 motion-reduce:animate-none" />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Spinner className="h-7 w-7" />
                  </span>
                </div>

                <p className="mt-6 text-lg font-semibold">
                  Looking for an opponent
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedConfiguration
                    ? `Level ${selectedConfiguration.level}, ${formatTimer(
                        selectedConfiguration.timer
                      )}`
                    : "Searching"}{" "}
                  · {formatElapsed(searchSeconds)}
                </p>

                <button
                  type="button"
                  onClick={handleLeaveQueue}
                  className={`mt-8 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${focusRing}`}
                >
                  Cancel search
                </button>
              </div>
            ) : (
              <>
                <div className="px-6 py-5">
                  {loading ? (
                    <SkeletonRows count={4} />
                  ) : levels.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No game settings are available right now. Try refreshing
                      the page in a moment.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {levels.map(({ level, items }) => (
                        <div
                          key={level}
                          role="group"
                          aria-label={`Level ${level} time limits`}
                          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6"
                        >
                          <p className="w-20 shrink-0 text-sm font-semibold text-slate-900">
                            Level {level}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {items.map((configuration) => {
                              const id = String(configuration.id);
                              const selected = selectedConfigurationId === id;

                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setSelectedConfigurationId(id)}
                                  aria-pressed={selected}
                                  className={`min-w-[4.5rem] rounded-lg px-3.5 py-2 text-sm font-medium transition ${focusRing} ${
                                    selected
                                      ? "bg-indigo-600 text-white shadow-sm"
                                      : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
                                  }`}
                                >
                                  {formatTimer(configuration.timer)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    {selectedConfiguration ? (
                      <>
                        Selected:{" "}
                        <span className="font-semibold text-slate-900">
                          Level {selectedConfiguration.level},{" "}
                          {formatTimer(selectedConfiguration.timer)}
                        </span>
                      </>
                    ) : (
                      "Pick a level and a time limit to start."
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={handleFindOpponent}
                    disabled={loading || !selectedConfigurationId}
                    className={`rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 ${focusRing}`}
                  >
                    Find opponent
                  </button>
                </div>
              </>
            )}
          </section>

          {/* ------------------------- Right column ------------------------- */}
          <div className="space-y-6 lg:col-span-2">
            {/* Incoming challenges */}
            <section
              aria-labelledby="incoming-heading"
              className={`rounded-2xl bg-white shadow-sm ring-1 ${
                incomingChallenges.length > 0
                  ? "ring-indigo-300"
                  : "ring-slate-200"
              }`}
            >
              <div className="flex items-center justify-between px-6 py-5">
                <h2 id="incoming-heading" className="text-lg font-semibold">
                  Challenges for you
                </h2>

                {incomingChallenges.length > 0 && (
                  <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {incomingChallenges.length}
                  </span>
                )}
              </div>

              {incomingChallenges.length === 0 ? (
                <p className="border-t border-slate-100 px-6 py-5 text-sm text-slate-500">
                  Nothing waiting. New challenges show up here automatically.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {incomingChallenges.map((challenge) => {
                    const challengeId = String(challenge.id);
                    const name = challenge.challenger_username || "A friend";
                    const busy = respondingChallengeId !== null;

                    return (
                      <li key={challengeId} className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} src={challenge.challenger_avatar} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Level {challenge.challenger_level ?? "-"} player
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleRespondToChallenge(challengeId, true)
                            }
                            disabled={busy}
                            className={`flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 ${focusRing}`}
                          >
                            {respondingChallengeId === challengeId
                              ? "Joining..."
                              : "Accept"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRespondToChallenge(challengeId, false)
                            }
                            disabled={busy}
                            className={`flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 disabled:opacity-50 ${focusRing}`}
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Friends */}
            <section
              aria-labelledby="friends-heading"
              className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between px-6 py-5">
                <div>
                  <h2 id="friends-heading" className="text-lg font-semibold">
                    Challenge a friend
                  </h2>
                  {!loading && friends.length > 0 && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {onlineCount} of {friends.length} online
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void loadLobby()}
                  disabled={loading}
                  className={`rounded-md px-2 py-1 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 ${focusRing}`}
                >
                  Refresh
                </button>
              </div>

              {sentChallenge && (
                <div
                  role="status"
                  className="mx-6 mb-4 flex items-center justify-between gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900 ring-1 ring-indigo-200"
                >
                  <div className="flex items-center gap-3">
                    <Spinner className="h-4 w-4 shrink-0 text-indigo-600" />
                    <p>
                      Waiting for{" "}
                      <span className="font-semibold">
                        {sentChallenge.friendName}
                      </span>{" "}
                      to accept
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelChallenge}
                    className={`shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 ${focusRing}`}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {loading ? (
                <div
                  className="animate-pulse space-y-4 border-t border-slate-100 px-6 py-5"
                  aria-hidden="true"
                >
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200" />
                      <div className="h-4 w-28 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : friends.length === 0 ? (
                <p className="border-t border-slate-100 px-6 py-5 text-sm text-slate-500">
                  You have no friends yet. Add friends to challenge them to a
                  duel.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {sortedFriends.map((friend) => {
                    const friendId = String(friend.id);
                    const name = friend.username || "Friend";
                    const sending = challengingFriendId === friendId;

                    const disabled =
                      !friend.is_online ||
                      !selectedConfigurationId ||
                      challengingFriendId !== null ||
                      sentChallenge !== null;

                    return (
                      <li
                        key={friendId}
                        className="flex items-center justify-between gap-3 px-6 py-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            name={name}
                            src={friend.avatar}
                            online={friend.is_online}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {name}
                            </p>
                            <p
                              className={`text-xs ${
                                friend.is_online
                                  ? "text-emerald-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {friend.is_online ? "Online" : "Offline"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleChallengeFriend(friend)}
                          disabled={disabled}
                          title={
                            !friend.is_online
                              ? "Friends can only be challenged while online"
                              : !selectedConfigurationId
                                ? "Choose a level and time limit first"
                                : undefined
                          }
                          className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${focusRing} ${
                            disabled
                              ? "bg-slate-100 text-slate-400"
                              : "bg-indigo-600 text-white hover:bg-indigo-700"
                          }`}
                        >
                          {sending ? "Sending..." : "Challenge"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!loading &&
                friends.length > 0 &&
                !selectedConfigurationId &&
                onlineCount > 0 && (
                  <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                    Choose a level and time limit in Quick match to enable
                    challenges.
                  </p>
                )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}