"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Play, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import DuelScene from "../components/DuelScene";
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

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const primaryButton = `bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 ${focusRing}`;

const ghostButton = `bg-white/5 text-slate-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 ${focusRing}`;

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
    getConfigurations()
      .then((data) => {
        setConfigs(data);
        const levels = Array.from(new Set(data.map((c) => c.level))).sort((a, b) => a - b);
        if (levels.length) setSelectedLevel(levels[0]);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load game settings")
      );
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
    `rounded-lg px-4 py-2 text-sm font-medium transition ${focusRing} ${
      active
        ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]"
        : "bg-white/5 text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white"
    }`;

  const fieldClass =
    "w-full rounded-lg border-0 bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-inset ring-white/10 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-300";

  const labelClass = "mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400";

  const startDisabled =
    starting ||
    selectedLevel == null ||
    (isCustomSelected ? customError !== null : selectedTimer == null);

  const digitSelect = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    options: number[]
  ) => (
    <div>
      <label className="mb-1 block text-xs text-slate-400">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${fieldClass} mt-1`}
        >
          {options.map((d) => (
            <option key={d} value={d} className="bg-slate-900">
              {d}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <main className="relative isolate flex min-h-[calc(100vh-64px)] items-center overflow-hidden bg-[#070815] px-4 py-16 text-slate-100 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_30%,rgba(99,102,241,0.22),transparent),radial-gradient(45%_40%_at_10%_90%,rgba(34,211,238,0.12),transparent)]"
      />
      <DuelScene focus="side" />

      <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        {/* Hero */}
        <div className="text-center lg:text-left">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Mental math, at speed.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-400 lg:mx-0">
            Pick a level and a timer, then answer as fast as you can. Climb the
            leaderboard or challenge a friend to a duel.
          </p>

          {!authLoading && !user && (
            <div className="mt-7 flex justify-center gap-3 lg:justify-start">
              <Link
                href="/register"
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${primaryButton}`}
              >
                Get started
              </Link>
              <Link
                href="/login"
                className={`rounded-lg px-5 py-2.5 text-sm font-medium ${ghostButton}`}
              >
                Log in
              </Link>
            </div>
          )}
        </div>

        {/* Start a game */}
        <div className="w-full rounded-2xl bg-slate-900/60 p-7 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-semibold text-white">Start a game</h2>
            <p className="mt-1 text-sm text-slate-400">
              {isCustomSelected
                ? "Set your own arithmetic and timer."
                : "Choose a level and a timer to begin."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 ring-1 ring-red-400/30"
            >
              {error}
            </div>
          )}

          <div className="mt-6">
            <p className={labelClass}>Level</p>
            <div className="flex flex-wrap gap-2">
              {levels.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selectedLevel === level}
                  onClick={() => {
                    setSelectedLevel(level);
                    setError(null);
                  }}
                  className={`${chipClass(selectedLevel === level)} ${
                    level === customLevel ? "flex items-center gap-1.5" : ""
                  }`}
                >
                  {level === customLevel ? (
                    <>
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Unknown
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
                <label className={labelClass} htmlFor="custom-timer">
                  <Clock className="h-3.5 w-3.5" /> Timer (seconds)
                </label>
                <input
                  id="custom-timer"
                  type="number"
                  min={MIN_CUSTOM_TIMER}
                  max={MAX_CUSTOM_TIMER}
                  value={Number.isNaN(custom.timer) ? "" : custom.timer}
                  onChange={(e) =>
                    updateCustom({ timer: e.target.value === "" ? NaN : Number(e.target.value) })
                  }
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Must be more than 15 seconds (max {MAX_CUSTOM_TIMER}).
                </p>
              </div>

              {/* Operations */}
              <div className="mt-5">
                <p className={labelClass}>Operations</p>
                <div className="flex flex-wrap gap-2">
                  {OPERATIONS.map(({ symbol, label }) => (
                    <button
                      key={symbol}
                      type="button"
                      aria-pressed={custom.operations.includes(symbol)}
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
                {digitSelect("Left min digits", custom.leftMinDigits, setLeftMin, DIGIT_OPTIONS)}
                {digitSelect(
                  "Left max digits",
                  custom.leftMaxDigits,
                  (v) => updateCustom({ leftMaxDigits: v }),
                  DIGIT_OPTIONS.filter((d) => d >= custom.leftMinDigits)
                )}
                {digitSelect("Right min digits", custom.rightMinDigits, setRightMin, DIGIT_OPTIONS)}
                {digitSelect(
                  "Right max digits",
                  custom.rightMaxDigits,
                  (v) => updateCustom({ rightMaxDigits: v }),
                  DIGIT_OPTIONS.filter((d) => d >= custom.rightMinDigits)
                )}
              </div>

              {/* Decimals */}
              <div className="mt-3">
                {digitSelect(
                  "Decimal places",
                  custom.decimalPlaces,
                  (v) => updateCustom({ decimalPlaces: v }),
                  [0, 1, 2, 3, 4]
                )}
              </div>

              {customError && (
                <p role="alert" className="mt-3 text-xs font-medium text-red-300">
                  {customError}
                </p>
              )}
            </>
          ) : (
            <div className="mt-5">
              <p className={labelClass}>
                <Clock className="h-3.5 w-3.5" /> Timer
              </p>
              <div className="flex flex-wrap gap-2">
                {timersForLevel.map((timer) => (
                  <button
                    key={timer}
                    type="button"
                    aria-pressed={selectedTimer === timer}
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
            type="button"
            onClick={handleStart}
            disabled={startDisabled}
            className={`mt-7 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none ${primaryButton}`}
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