
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelChallenge,
  challengeFriend,
  getConfigurations,
  getDuelStatus,
  getFriends,
  getIncomingChallenges,
  joinDuel,
  leaveDuelQueue,
  respondToChallenge,
} from "../../lib/api";
import type { GameConfiguration } from "../../lib/api";
import type {
  Challenge,
  Duel,
} from "../../types/duel";

interface Friend {
  id: string | number;
  username: string;
  avatar?: string | null;
  is_online: boolean;
}

export default function DuelLobbyPage() {
  const router = useRouter();

  const [configurations, setConfigurations] = useState<GameConfiguration[]>([]);
  const [selectedConfigurationId, setSelectedConfigurationId] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [findingOpponent, setFindingOpponent] = useState(false);
  const [challengingFriendId, setChallengingFriendId] = useState<string | null>(null);
  const [respondingChallengeId, setRespondingChallengeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pollingRef = useRef(false);
  const findingRef = useRef(false);

  const showDuel = useCallback(
    (duel: Duel) => {
      router.push(`/duel/${duel.id}`);
    },
    [router]
  );

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
          ? challengeResponse.challenges
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

  const handleFindOpponent = async () => {
    const configurationId = String(selectedConfigurationId ?? "").trim();

    if (!configurationId) {
      setError("Please select a game configuration.");
      return;
    }

    if (findingRef.current) return;

    findingRef.current = true;
    setFindingOpponent(true);
    setError("");
    setMessage("Searching for an opponent...");

    try {
      const result = await joinDuel(configurationId);

      if (result.matched && result.duel) {
        findingRef.current = false;
        setFindingOpponent(false);
        showDuel(result.duel);
        return;
      }

      setMessage("Waiting for an opponent...");

      while (findingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!findingRef.current) break;

        const status = await getDuelStatus();

        if (status.matched && status.duel) {
          findingRef.current = false;
          setFindingOpponent(false);
          setMessage("");
          showDuel(status.duel);
          return;
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to find an opponent."
      );
      setMessage("");
    } finally {
      findingRef.current = false;
      setFindingOpponent(false);
    }
  };

  const handleLeaveQueue = async () => {
    findingRef.current = false;
    setFindingOpponent(false);
    setMessage("");

    try {
      await leaveDuelQueue();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to leave the queue."
      );
    }
  };

  const handleChallengeFriend = async (friendId: string | number) => {
    const normalizedFriendId = String(friendId ?? "").trim();
    const configurationId = String(selectedConfigurationId ?? "").trim();

    if (!normalizedFriendId) {
      setError("Please select a valid friend.");
      return;
    }

    if (!configurationId) {
      setError("Please select a game configuration.");
      return;
    }

    setChallengingFriendId(normalizedFriendId);
    setError("");
    setMessage("");

    try {
      await challengeFriend(normalizedFriendId, configurationId);
      setMessage("Challenge sent successfully.");
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
        current.filter((challenge) => challenge.id !== challengeId)
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

  const handleCancelChallenge = async (challengeId: string) => {
    setError("");

    try {
      await cancelChallenge(challengeId);
      setMessage("Challenge cancelled.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel challenge."
      );
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Duel Lobby</h1>
          <p className="mt-2 text-sm text-slate-600">
            Find an opponent or challenge a friend.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Find an opponent</h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">
              Loading configurations...
            </p>
          ) : configurations.length === 0 ? (
            <p className="mt-4 text-sm text-red-600">
              No game configurations are available.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {configurations.map((configuration) => {
                const id = String(configuration.id);
                const selected = selectedConfigurationId === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedConfigurationId(id)}
                    disabled={findingOpponent}
                    aria-pressed={selected}
                    className={`rounded-lg border px-3 py-3 text-sm transition ${
                      selected
                        ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-700"
                        : "border-slate-200 bg-white hover:border-indigo-300"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Lvl {configuration.level} · {configuration.timer}s
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleFindOpponent}
              disabled={loading || findingOpponent || !selectedConfigurationId}
              className="flex-1 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {findingOpponent ? "Finding opponent..." : "Find opponent"}
            </button>

            {findingOpponent && (
              <button
                type="button"
                onClick={handleLeaveQueue}
                className="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
            )}
          </div>

          {message && (
            <p role="status" className="mt-4 text-sm text-emerald-700">
              {message}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Challenge a friend</h2>
            <button
              type="button"
              onClick={() => void loadLobby()}
              disabled={loading || challengingFriendId !== null}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading friends...</p>
          ) : friends.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No friends found.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {friends.map((friend) => {
                const friendId = String(friend.id);

                return (
                  <li
                    key={friendId}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {friend.username || "Friend"}
                      </p>
                      <p
                        className={`text-xs ${
                          friend.is_online
                            ? "text-emerald-600"
                            : "text-slate-500"
                        }`}
                      >
                        {friend.is_online ? "Online" : "Offline"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleChallengeFriend(friend.id)}
                      disabled={
                        !friend.is_online ||
                        !selectedConfigurationId ||
                        challengingFriendId !== null
                      }
                      className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {challengingFriendId === friendId
                        ? "Sending..."
                        : "Send challenge"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Incoming challenges</h2>

          {incomingChallenges.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No pending challenges.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {incomingChallenges.map((challenge) => (
                <li
                  key={challenge.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {challenge.challenger_username || "A friend"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Level {challenge.challenger_level ?? "—"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleRespondToChallenge(challenge.id, true)
                      }
                      disabled={respondingChallengeId !== null}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Accept
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleRespondToChallenge(challenge.id, false)
                      }
                      disabled={respondingChallengeId !== null}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
