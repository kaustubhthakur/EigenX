"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Clock, Play } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getConfigurations, startGame, GameConfiguration } from "../lib/api";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [configs, setConfigs] = useState<GameConfiguration[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedTimer, setSelectedTimer] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConfigurations().then((data) => {
      setConfigs(data);
      const levels = Array.from(new Set(data.map((c) => c.level))).sort((a, b) => a - b);
      if (levels.length) setSelectedLevel(levels[0]);
    });
  }, []);

  const levels = Array.from(new Set(configs.map((c) => c.level))).sort((a, b) => a - b);
  const timersForLevel = configs
    .filter((c) => c.level === selectedLevel)
    .map((c) => c.timer)
    .sort((a, b) => a - b);

  useEffect(() => {
    if (timersForLevel.length && !timersForLevel.includes(selectedTimer ?? -1)) {
      setSelectedTimer(timersForLevel[0]);
    }
  }, [selectedLevel, timersForLevel.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (selectedLevel == null || selectedTimer == null) return;

    setStarting(true);
    setError(null);
    try {
      const res = await startGame({ level: selectedLevel, timer: selectedTimer });
      router.push(`/game/${res.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setStarting(false);
    }
  };

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
              <p className="text-xs text-gray-500">Choose a level and a timer to begin</p>
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
                  onClick={() => setSelectedLevel(level)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    selectedLevel === level
                      ? "scale-[1.03] bg-indigo-600 text-white shadow-sm"
                      : "border border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50"
                  }`}
                >
                  Level {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              <Clock className="h-3 w-3" /> Timer
            </p>
            <div className="flex flex-wrap gap-2">
              {timersForLevel.map((timer) => (
                <button
                  key={timer}
                  onClick={() => setSelectedTimer(timer)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    selectedTimer === timer
                      ? "scale-[1.03] bg-indigo-600 text-white shadow-sm"
                      : "border border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50"
                  }`}
                >
                  {timer}s
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={starting || selectedLevel == null || selectedTimer == null}
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