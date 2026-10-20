"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Play, SlidersHorizontal, Trophy, User, Users } from "lucide-react";
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

const FEATURES = [
  {
    href: "/leaderboard",
    icon: Trophy,
    title: "Leaderboard",
    text: "See how your best scores rank against other players.",
  },
  {
    href: "/duel",
    icon: Users,
    title: "Duels",
    text: "Race a friend or a random opponent on the same questions.",
  },
  {
    href: "/dashboard",
    icon: User,
    title: "Your profile",
    text: "Track your level, XP and highest score over time.",
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

const primaryButton = `bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${focusRing}`;

const secondaryButton = `border border-slate-700 bg-transparent text-slate-200 transition hover:bg-slate-800 ${focusRing}`;

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
    `rounded-lg border px-3.5 py-2 text-sm font-medium transition ${focusRing} ${
      active
        ? "border-indigo-500 bg-indigo-500/10 text-white"
        : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  const fieldClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

  const labelClass = "mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-300";

  const startDisabled =
    starting ||
    selectedLevel == null ||
    (isCustomSelected ? customError !== null : selectedTimer == null);

  const summary = isCustomSelected
    ? `Custom \u00b7 ${Number.isNaN(custom.timer) ? "-" : custom.timer}s`
    : selectedLevel != null && selectedTimer != null
      ? `Level ${selectedLevel} \u00b7 ${selectedTimer}s`
      : "Choose your settings";

  const digitSelect = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    options: number[]
  ) => (
    <label className="block text-xs font-medium text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${fieldClass} mt-1.5`}
      >
        {options.map((d) => (
          <option key={d} value={d} className="bg-slate-900">
            {d}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* Hero */}
        <header className="text-center">
          <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
            Mental math training
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Mental math, at speed.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-400">
            Pick a level and a timer, then answer as fast as you can. Climb the
            leaderboard or challenge a friend to a duel.
          </p>

          {!authLoading && !user && (
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/register"
                className={`rounded-lg px-4 py-2 text-sm font-medium ${primaryButton}`}
              >
                Get started
              </Link>
              <Link
                href="/login"
                className={`rounded-lg px-4 py-2 text-sm font-medium ${secondaryButton}`}
              >
                Log in
              </Link>
            </div>
          )}
        </header>

        {/* Start a game */}
        <section
          aria-labelledby="start-heading"
          className="mx-auto mt-10 max-w-xl rounded-xl border border-slate-800 bg-slate-900"
        >
          <div className="border-b border-slate-800 px-6 py-4">
            <h2 id="start-heading" className="text-base font-semibold text-white">
              Start a game
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {isCustomSelected
                ? "Set your own arithmetic and timer."
                : "Choose a level and a timer to begin."}
            </p>
          </div>

          <div className="px-6 py-5">
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            <div>
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
                <div className="mt-6">
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
                  <p className="mt-1.5 text-xs text-slate-500">
                    Must be more than 15 seconds (max {MAX_CUSTOM_TIMER}).
                  </p>
                </div>

                <div className="mt-6">
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

                <div className="mt-6 grid grid-cols-2 gap-4">
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
                  {digitSelect(
                    "Decimal places",
                    custom.decimalPlaces,
                    (v) => updateCustom({ decimalPlaces: v }),
                    [0, 1, 2, 3, 4]
                  )}
                </div>

                {customError && (
                  <p role="alert" className="mt-4 text-sm text-red-300">
                    {customError}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-6">
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
                      className={`${chipClass(selectedTimer === timer)} tabular-nums`}
                    >
                      {timer}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Selected: <span className="font-medium text-slate-200">{summary}</span>
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={startDisabled}
              className={`flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium ${primaryButton}`}
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
        </section>

        {/* Shortcuts */}
        <section aria-label="Explore" className="mt-14">
          <ul className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map(({ href, icon: Icon, title, text }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`block h-full rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-700 hover:bg-slate-900 ${focusRing}`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}