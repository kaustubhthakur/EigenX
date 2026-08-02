"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  challengeFriend,
  getConfigurations,
  getFriends,
  joinDuel,
  leaveDuelQueue,
  getDuelStatus,
  resolveAvatarUrl,
  type GameConfiguration,
} from "../../lib/api";


interface FriendLite {
  id: string;
  username: string;
  avatar?: string | null;
  is_online?: boolean;
}

type Tab = "quick" | "challenge";

function storeDuel(duel: unknown) {
  try {
    const d = duel as { id: string };
    sessionStorage.setItem(`duel:${d.id}`, JSON.stringify(duel));
  } catch {
  
  }
}

export default function DuelLobbyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("quick");

  const [configurations, setConfigurations] = useState<GameConfiguration[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [configsLoading, setConfigsLoading] = useState(true);

  const [inQueue, setInQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [friends, setFriends] = useState<FriendLite[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [challengeConfigId, setChallengeConfigId] = useState<string | null>(null);
  const [sendingChallenge, setSendingChallenge] = useState(false);
  const [challengeFeedback, setChallengeFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    getConfigurations()
      .then((cfgs) => {
        setConfigurations(cfgs);
        if (cfgs.length > 0) {
          setSelectedConfigId(cfgs[0].id);
          setChallengeConfigId(cfgs[0].id);
        }
      })
      .finally(() => setConfigsLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "challenge") return;
    setFriendsLoading(true);
    getFriends()
      .then((res) => {
        const list = ((res as unknown as { friends?: FriendLite[] })?.friends) ?? [];
        setFriends(list);
      })
      .catch(() => setFriends([]))
      .finally(() => setFriendsLoading(false));
  }, [tab]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const handleFindOpponent = async () => {
    if (!selectedConfigId) return;
    setQueueError(null);
    setSearching(true);
    try {
      const res = await joinDuel(selectedConfigId);
      if (res.matched && res.duel) {
        storeDuel(res.duel);
        router.push(`/duel/${res.duel.id}`);
        return;
      }
      setInQueue(true);
      pollRef.current = setInterval(async () => {
        try {
          const status = await getDuelStatus();
          if (status.matched && status.duel) {
            stopPolling();
            storeDuel(status.duel);
            router.push(`/duel/${status.duel.id}`);
          }
        } catch {
          
        }
      }, 2500);
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Couldn't join the queue");
    } finally {
      setSearching(false);
    }
  };

  const handleCancelSearch = async () => {
    stopPolling();
    setInQueue(false);
    try {
      await leaveDuelQueue();
    } catch {
     
    }
  };

  const handleSendChallenge = async () => {
    if (!selectedFriendId || !challengeConfigId) return;
    setSendingChallenge(true);
    setChallengeFeedback(null);
    try {
      await challengeFriend(selectedFriendId, challengeConfigId);
      setChallengeFeedback("Challenge sent.");
    } catch (err) {
      setChallengeFeedback(err instanceof Error ? err.message : "Couldn't send the challenge");
    } finally {
      setSendingChallenge(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Duel</h1>
      <p className="mt-1 text-sm text-gray-500">
        Race an opponent to answer arithmetic questions before the clock runs out.
      </p>

      <div className="mt-6 flex gap-1 rounded-xl bg-gray-100 p-1 text-sm font-medium">
        {([
          ["quick", "Quick match"],
          ["challenge", "Challenge a friend"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg px-3 py-2 transition ${
              tab === value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "quick" && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {configsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : inQueue ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              <div>
                <p className="font-semibold text-gray-900">Searching for an opponent…</p>
                <p className="mt-1 text-sm text-gray-500">
                  We'll take you to the duel the moment someone matches you.
                </p>
              </div>
              <button
                onClick={handleCancelSearch}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel search
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Choose a difficulty</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {configurations.map((cfg) => (
                  <button
                    key={cfg.id}
                    onClick={() => setSelectedConfigId(cfg.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      selectedConfigId === cfg.id
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">Level {cfg.level}</p>
                    <p className="text-xs text-gray-500">{cfg.timer}s</p>
                  </button>
                ))}
              </div>

              {queueError && (
                <p className="mt-3 text-sm text-red-600">{queueError}</p>
              )}

              <button
                onClick={handleFindOpponent}
                disabled={!selectedConfigId || searching}
                className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {searching ? "Joining…" : "Find opponent"}
              </button>
            </>
          )}
        </section>
      )}

      {tab === "challenge" && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {friendsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Add some friends first — you can only challenge people on your friends list.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Pick a friend</p>
              <div className="mt-3 max-h-52 space-y-1 overflow-y-auto">
                {friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      selectedFriendId === friend.id
                        ? "bg-indigo-50 ring-1 ring-indigo-500"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {friend.avatar ? (
                      
                        <img
                          src={resolveAvatarUrl(friend.avatar)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        friend.username?.[0]?.toUpperCase() || "?"
                      )}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-900">
                      {friend.username}
                    </span>
                    {friend.is_online && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-sm font-medium text-gray-700">Difficulty</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {configurations.map((cfg) => (
                  <button
                    key={cfg.id}
                    onClick={() => setChallengeConfigId(cfg.id)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      challengeConfigId === cfg.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Lvl {cfg.level} · {cfg.timer}s
                  </button>
                ))}
              </div>

              {challengeFeedback && (
                <p className="mt-3 text-sm text-gray-600">{challengeFeedback}</p>
              )}

              <button
                onClick={handleSendChallenge}
                disabled={!selectedFriendId || !challengeConfigId || sendingChallenge}
                className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {sendingChallenge ? "Sending…" : "Send challenge"}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}