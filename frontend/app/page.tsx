"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <main>
    
      <section className="border-b border-gray-100 bg-gradient-to-b from-indigo-50 to-white px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {!authLoading && !user && (
            <div className="mt-8 flex justify-center gap-3">
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
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
          )}
        </div>
      </section>

  
      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Start a game</h2>
          <p className="mt-1 text-sm text-gray-500">Choose a level and a timer to begin.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Level</p>
            <div className="flex flex-wrap gap-2">
              {levels.map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    selectedLevel === level
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Level {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Timer</p>
            <div className="flex flex-wrap gap-2">
              {timersForLevel.map((timer) => (
                <button
                  key={timer}
                  onClick={() => setSelectedTimer(timer)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    selectedTimer === timer
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
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
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {starting ? "Starting..." : user ? "Start game" : "Log in to play"}
          </button>
        </div>
      </section>
    </main>
  );
}