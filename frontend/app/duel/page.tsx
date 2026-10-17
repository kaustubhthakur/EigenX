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
import type { CustomSettings, GameConfiguration } from "../../lib/api";
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
  custom_settings?: CustomSettings | null;
};

/* ------------------------------------------------------------------ */
/* Custom rules                                                        */
/* ------------------------------------------------------------------ */

// The configuration with this level (or flagged is_custom) lets players
// set their own rules instead of using fixed ones.
const CUSTOM_LEVEL = 4;

const isCustomConfiguration = (configuration: GameConfiguration): boolean =>
  Boolean(configuration.is_custom) || configuration.level === CUSTOM_LEVEL;

const DEFAULT_CUSTOM_SETTINGS: CustomSettings = {
  timer: 60,
  operations: ["+", "-"],
  leftMinDigits: 1,
  leftMaxDigits: 2,
  rightMinDigits: 1,
  rightMaxDigits: 2,
  decimalPlaces: 0,
};

const OPERATIONS = [
  { value: "+", label: "+", name: "Addition" },
  { value: "-", label: "\u2212", name: "Subtraction" },
  { value: "*", label: "\u00d7", name: "Multiplication" },
  { value: "/", label: "\u00f7", name: "Division" },
];

function range(min: number, max: number): string {
  return min === max ? String(min) : `${min}-${max}`;
}

function describeSettings(settings: CustomSettings): string {
  const ops = OPERATIONS.filter((op) =>
    settings.operations.includes(op.value)
  )
    .map((op) => op.label)
    .join(" ");

  const parts = [
    formatTimer(settings.timer),
    ops,
    `${range(settings.leftMinDigits, settings.leftMaxDigits)} and ${range(
      settings.rightMinDigits,
      settings.rightMaxDigits
    )} digits`,
  ];

  if (settings.decimalPlaces > 0) {
    parts.push(
      `${settings.decimalPlaces} decimal${settings.decimalPlaces > 1 ? "s" : ""}`
    );
  }

  return parts.join(", ");
}

function validateSettings(settings: CustomSettings): string | null {
  const isInt = (n: number) => Number.isInteger(n);

  if (!isInt(settings.timer) || settings.timer < 10 || settings.timer > 600) {
    return "Time limit must be between 10 and 600 seconds.";
  }

  if (settings.operations.length === 0) {
    return "Choose at least one operation.";
  }

  const digits = [
    settings.leftMinDigits,
    settings.leftMaxDigits,
    settings.rightMinDigits,
    settings.rightMaxDigits,
  ];

  if (!digits.every((d) => isInt(d) && d >= 1 && d <= 6)) {
    return "Digits must be between 1 and 6.";
  }

  if (
    settings.leftMinDigits > settings.leftMaxDigits ||
    settings.rightMinDigits > settings.rightMaxDigits
  ) {
    return "The minimum digits can't be larger than the maximum.";
  }

  if (
    !isInt(settings.decimalPlaces) ||
    settings.decimalPlaces < 0 ||
    settings.decimalPlaces > 3
  ) {
    return "Decimal places must be between 0 and 3.";
  }

  return null;
}

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

function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="relative mt-1">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isNaN(value) ? "" : value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-8 flex items-center text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
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
  const [customSettings, setCustomSettings] = useState<CustomSettings>(
    DEFAULT_CUSTOM_SETTINGS
  );

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

    if (customError) {
      setError(customError);
      return;
    }

    if (findingRef.current) return;

    findingRef.current = true;
    setFindingOpponent(true);
    setError("");
    setMessage("");

    try {
      const result = await joinDuel(
        configurationId,
        isCustomSelected ? customSettings : null
      );

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

    if (customError) {
      setError(customError);
      return;
    }

    setChallengingFriendId(normalizedFriendId);
    setError("");
    setMessage("");

    try {
      const result = await challengeFriend(
        normalizedFriendId,
        configurationId,
        isCustomSelected ? customSettings : null
      );

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

  const isCustomSelected = selectedConfiguration
    ? isCustomConfiguration(selectedConfiguration)
    : false;

  const customError = isCustomSelected
    ? validateSettings(customSettings)
    : null;

  const selectedLabel = !selectedConfiguration
    ? ""
    : isCustomSelected
      ? "Custom rules"
      : `Level ${selectedConfiguration.level}, ${formatTimer(
          selectedConfiguration.timer
        )}`;

  const toggleOperation = (operation: string) => {
    setCustomSettings((current) => ({
      ...current,
      operations: current.operations.includes(operation)
        ? current.operations.filter((op) => op !== operation)
        : [...current.operations, operation],
    }));
  };

  const updateCustom = (patch: Partial<CustomSettings>) => {
    setCustomSettings((current) => ({ ...current, ...patch }));
  };

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
                  {selectedLabel || "Searching"} ·{" "}
                  {formatElapsed(searchSeconds)}
                </p>

                {isCustomSelected && (
                  <p className="mt-3 max-w-sm text-xs leading-5 text-slate-500">
                    {describeSettings(customSettings)}. You will be paired with
                    a player who picked the same rules.
                  </p>
                )}

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
                      {levels.map(({ level, items }) => {
                        const customGroup = items.some(isCustomConfiguration);
                        const groupName = customGroup
                          ? "Custom"
                          : `Level ${level}`;

                        return (
                        <div
                          key={level}
                          role="group"
                          aria-label={`${groupName} options`}
                          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6"
                        >
                          <p className="w-20 shrink-0 text-sm font-semibold text-slate-900">
                            {groupName}
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
                                  {isCustomConfiguration(configuration)
                                    ? "Set your own rules"
                                    : formatTimer(configuration.timer)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {isCustomSelected && (
                  <div className="border-t border-slate-100 px-6 py-5">
                    <h3 className="text-sm font-semibold">Custom rules</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Quick match pairs you with a player who chose exactly the
                      same rules. A challenge uses your rules.
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <NumberField
                        label="Time limit (seconds)"
                        value={customSettings.timer}
                        min={10}
                        max={600}
                        onChange={(timer) => updateCustom({ timer })}
                      />
                      <NumberField
                        label="Decimal places"
                        value={customSettings.decimalPlaces}
                        min={0}
                        max={3}
                        onChange={(decimalPlaces) =>
                          updateCustom({ decimalPlaces })
                        }
                      />
                    </div>

                    <fieldset className="mt-5">
                      <legend className="text-xs font-medium text-slate-600">
                        Operations
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {OPERATIONS.map((operation) => {
                          const on = customSettings.operations.includes(
                            operation.value
                          );

                          return (
                            <button
                              key={operation.value}
                              type="button"
                              onClick={() => toggleOperation(operation.value)}
                              aria-pressed={on}
                              aria-label={operation.name}
                              title={operation.name}
                              className={`h-10 w-12 rounded-lg text-lg font-medium transition ${focusRing} ${
                                on
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {operation.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <NumberField
                        label="First number: min digits"
                        value={customSettings.leftMinDigits}
                        min={1}
                        max={6}
                        onChange={(leftMinDigits) =>
                          updateCustom({ leftMinDigits })
                        }
                      />
                      <NumberField
                        label="First number: max digits"
                        value={customSettings.leftMaxDigits}
                        min={1}
                        max={6}
                        onChange={(leftMaxDigits) =>
                          updateCustom({ leftMaxDigits })
                        }
                      />
                      <NumberField
                        label="Second number: min digits"
                        value={customSettings.rightMinDigits}
                        min={1}
                        max={6}
                        onChange={(rightMinDigits) =>
                          updateCustom({ rightMinDigits })
                        }
                      />
                      <NumberField
                        label="Second number: max digits"
                        value={customSettings.rightMaxDigits}
                        min={1}
                        max={6}
                        onChange={(rightMaxDigits) =>
                          updateCustom({ rightMaxDigits })
                        }
                      />
                    </div>

                    {(customSettings.decimalPlaces > 0 ||
                      customSettings.operations.includes("/")) && (
                      <p className="mt-4 text-xs leading-5 text-slate-500">
                        With decimals, only the first number has decimal places
                        in multiplication and division. Division always has an
                        exact answer.
                      </p>
                    )}

                    {customError && (
                      <p role="alert" className="mt-4 text-sm text-red-600">
                        {customError}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-4 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    {selectedConfiguration ? (
                      <>
                        Selected:{" "}
                        <span className="font-semibold text-slate-900">
                          {selectedLabel}
                        </span>
                        {isCustomSelected && !customError && (
                          <span className="block text-xs text-slate-500">
                            {describeSettings(customSettings)}
                          </span>
                        )}
                      </>
                    ) : (
                      "Pick a level and a time limit to start."
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={handleFindOpponent}
                    disabled={
                      loading ||
                      !selectedConfigurationId ||
                      Boolean(customError)
                    }
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

                        {challenge.custom_settings && (
                          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                            Custom rules:{" "}
                            {describeSettings(challenge.custom_settings)}
                          </p>
                        )}

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
                      sentChallenge !== null ||
                      Boolean(customError);

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