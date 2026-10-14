"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Clock, Play, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getConfigurations,
  startGame,
  startCustomGame,
  GameConfiguration,
  CustomSettings,
} from "../lib/api";

const OPERATIONS = [
  { symbol: "+", label: "Add" },
  { symbol: "-", label: "Subtract" },
  { symbol: "*", label: "Multiply" },
  { symbol: "/", label: "Divide" },
];
const DIGIT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const MIN_CUSTOM_TIMER = 16; // must be more than 15 seconds
const MAX_CUSTOM_TIMER = 600;

const DEFAULT_CUSTOM: CustomSettings = {
  timer: 30,
  operations: ["+"],
  leftMinDigits: 2,
  leftMaxDigits: 2,
  rightMinDigits: 2,
  rightMaxDigits: 2,
  decimalPlaces: 0,
};

function validateCustom(s: CustomSettings): string | null {
  if (!Number.isInteger(s.timer) || s.timer < MIN_CUSTOM_TIMER || s.timer > MAX_CUSTOM_TIMER) {
    return `Timer must be between ${MIN_CUSTOM_TIMER} and ${MAX_CUSTOM_TIMER} seconds.`;
  }
  if (s.operations.length === 0) return "Pick at least one operation.";
  if (s.leftMaxDigits < s.leftMinDigits || s.rightMaxDigits < s.rightMinDigits) {
    return "Max digits cannot be less than min digits.";
  }
  return null;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [configs, setConfigs] = useState<GameConfiguration[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedTimer, setSelectedTimer] = useState<number | null>(null);
  const [custom, setCustom] = useState<CustomSettings>(DEFAULT_CUSTOM);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConfigurations().then((data) => {
      setConfigs(data);
      const levels = Array.from(new Set(data.map((c) => c.level))).sort((a, b) => a - b);
      if (levels.length) setSelectedLevel(levels[0]);
    });
  }, []);

  const customLevel = configs.find((c) => c.is_custom)?.level ?? null;
  const isCustomSelected = customLevel !== null && selectedLevel === customLevel;

  const levels = Array.from(new Set(configs.map((c) => c.level))).sort((a, b) => a - b);
  const timersForLevel = configs
    .filter((c) => c.level === selectedLevel && !c.is_custom)
    .map((c) => c.timer)
    .sort((a, b) => a - b);

  useEffect(() => {
    if (isCustomSelected) return;
    if (timersForLevel.length && !timersForLevel.includes(selectedTimer ?? -1)) {
      setSelectedTimer(timersForLevel[0]);
    }
  }, [selectedLevel, timersForLevel.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCustom = (patch: Partial<CustomSettings>) =>
    setCustom((prev) => ({ ...prev, ...patch }));

  const toggleOperation = (op: string) =>
    setCustom((prev) => ({
      ...prev,
      operations: prev.operations.includes(op)
        ? prev.operations.filter((o) => o !== op)
        : [...prev.operations, op],
    }));

  // Keep max >= min when the min changes
  const setLeftMin = (v: number) =>
    updateCustom({ leftMinDigits: v, leftMaxDigits: Math.max(custom.leftMaxDigits, v) });
  const setRightMin = (v: number) =>
    updateCustom({ rightMinDigits: v, rightMaxDigits: Math.max(custom.rightMaxDigits, v) });

  const customError = isCustomSelected ? validateCustom(custom) : null;

  const handleStart = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (selectedLevel == null) return;

    setStarting(true);
    setError(null);
    try {
      if (isCustomSelected) {
        const msg = validateCustom(custom);
        if (msg) {
          setError(msg);
          return;
        }
        const res = await startCustomGame(custom);
        router.push(`/game/${res.sessionId}`);
      } else {
        if (selectedTimer == null) return;
        const res = await startGame({ level: selectedLevel, timer: selectedTimer });
        router.push(`/game/${res.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setStarting(false);
    }
  };

  const chipClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
      active
        ? "scale-[1.03] bg-indigo-600 text-white shadow-sm"
        : "border border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50"
    }`;

  const selectClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  const startDisabled =
    starting ||
    selectedLevel == null ||
    (isCustomSelected ? customError !== null : selectedTimer == null);

  return (
    <main className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden bg-gray-50 px-4 py-16 sm:px-6">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-50 via-white to-gray-50" />
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-purple-200/40 blur-3xl" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {!authLoading && !user && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Welcome to EigenX</h1>
            <p className="mt-2 text-sm text-gray-500">Sign in to track your progress and compete on the leaderboard.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Log in
              </Link>
            </div>
          </div>
        )}

        <div className="w-full rounded-2xl border border-gray-200 bg-white/90 p-7 shadow-lg shadow-indigo-100/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Start a game</h2>
              <p className="text-xs text-gray-500">
                {isCustomSelected ? "Build your own challenge" : "Choose a level and a timer to begin"}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Level</p>
            <div className="flex flex-wrap gap-2">
              {levels.map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setSelectedLevel(level);
                    setError(null);
                  }}
                  className={`${chipClass(selectedLevel === level)} ${level === customLevel ? "flex items-center gap-1.5" : ""}`}
                >
                  {level === customLevel ? (
                    <>
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Custom
                    </>
                  ) : (
                    `Level ${level}`
                  )}
                </button>
              ))}
            </div>
          </div>

          {isCustomSelected ? (
            <>
              {/* Timer */}
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <Clock className="h-3 w-3" /> Timer (seconds)
                </p>
                <input
                  type="number"
                  min={MIN_CUSTOM_TIMER}
                  max={MAX_CUSTOM_TIMER}
                  value={Number.isNaN(custom.timer) ? "" : custom.timer}
                  onChange={(e) => updateCustom({ timer: e.target.value === "" ? NaN : Number(e.target.value) })}
                  className={selectClass}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Must be more than 15 seconds (max {MAX_CUSTOM_TIMER}).
                </p>
              </div>

              {/* Operations */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Operations</p>
                <div className="flex flex-wrap gap-2">
                  {OPERATIONS.map(({ symbol, label }) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => toggleOperation(symbol)}
                      className={chipClass(custom.operations.includes(symbol))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Digits */}
              <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3">
                <div>
                  <p className="mb-1 text-xs text-gray-500">Left min digits</p>
                  <select
                    value={custom.leftMinDigits}
                    onChange={(e) => setLeftMin(Number(e.target.value))}
                    className={selectClass}
                  >
                    {DIGIT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Left max digits</p>
                  <select
                    value={custom.leftMaxDigits}
                    onChange={(e) => updateCustom({ leftMaxDigits: Number(e.target.value) })}
                    className={selectClass}
                  >
                    {DIGIT_OPTIONS.filter((d) => d >= custom.leftMinDigits).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Right min digits</p>
                  <select
                    value={custom.rightMinDigits}
                    onChange={(e) => setRightMin(Number(e.target.value))}
                    className={selectClass}
                  >
                    {DIGIT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Right max digits</p>
                  <select
                    value={custom.rightMaxDigits}
                    onChange={(e) => updateCustom({ rightMaxDigits: Number(e.target.value) })}
                    className={selectClass}
                  >
                    {DIGIT_OPTIONS.filter((d) => d >= custom.rightMinDigits).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Decimals */}
              <div className="mt-3">
                <p className="mb-1 text-xs text-gray-500">Decimal places</p>
                <select
                  value={custom.decimalPlaces}
                  onChange={(e) => updateCustom({ decimalPlaces: Number(e.target.value) })}
                  className={selectClass}
                >
                  {[0, 1, 2, 3, 4].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {customError && <p className="mt-3 text-xs font-medium text-red-600">{customError}</p>}
            </>
          ) : (
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                <Clock className="h-3 w-3" /> Timer
              </p>
              <div className="flex flex-wrap gap-2">
                {timersForLevel.map((timer) => (
                  <button
                    key={timer}
                    onClick={() => setSelectedTimer(timer)}
                    className={chipClass(selectedTimer === timer)}
                  >
                    {timer}s
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={startDisabled}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md disabled:opacity-60 disabled:hover:shadow-sm"
          >
            {starting ? (
              "Starting..."
            ) : user ? (
              <>
                <Play className="h-4 w-4" /> Start game
              </>
            ) : (
              "Log in to play"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}