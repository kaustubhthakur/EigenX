"use client";

import { use, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getQuestion, submitAnswer } from "../../../lib/api";
import { isCorrectAnswer } from "../../../lib/solveQuestion";

const CountdownOrb = dynamic(() => import("../../../components/CountdownOrb"), {
  ssr: false,
  loading: () => <div className="mx-auto h-48 w-48" />,
});

type Phase = "loading" | "playing" | "gameover" | "error";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:focus-visible:outline-cyan-300";

const primaryButton = `bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.5)] transition hover:brightness-110 dark:shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] ${focusRing}`;

const ghostButton = `bg-white text-slate-700 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 dark:bg-white/5 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/10 ${focusRing}`;

export default function GameSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard so auto-submit and manual submit can never double fire.
  const submittingRef = useRef(false);

  const loadNextQuestion = async () => {
    try {
      const res = await getQuestion(sessionId);
      setScore(res.score);

      if (res.gameOver) {
        setPhase("gameover");
        return;
      }

      setQuestion(res.question ?? null);
      // One continuous timer for the whole session: never reset it per question.
      const serverTime = res.remainingTime ?? null;
      setRemainingTime((prev) =>
        serverTime == null
          ? prev
          : prev == null || prev <= 0
            ? serverTime
            : Math.min(prev, serverTime)
      );
      setTotalTime((prev) =>
        serverTime == null ? prev : prev == null ? serverTime : Math.max(prev, serverTime)
      );
      setPhase("playing");
      setAnswer("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load question");
      setPhase("error");
    }
  };

  useEffect(() => {
    loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Always put the cursor back in the answer box whenever a new question shows up.
  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase, question]);

  useEffect(() => {
    if (phase !== "playing" || remainingTime == null) return;
    if (remainingTime <= 0) {
      loadNextQuestion();
      return;
    }
    const t = setTimeout(() => setRemainingTime((r) => (r != null ? r - 1 : r)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingTime]);

  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    };
  }, []);

  const submitValue = async (value: number) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const res = await submitAnswer(sessionId, value);
      setScore(res.score);

      if (res.gameOver) {
        setPhase("gameover");
        return;
      }

      setFeedback(res.correct ? "correct" : "wrong");
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => setFeedback(null), 500);

      await loadNextQuestion();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit answer");
      setPhase("error");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  // Auto-submit the moment the typed value equals the correct answer.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAnswer(value);

    if (phase !== "playing" || submittingRef.current || value.trim() === "") return;

    const num = Number(value);
    if (isCorrectAnswer(question, num)) {
      void submitValue(num);
    }
  };

  // Manual submit (Enter / button) is still available for wrong answers.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    void submitValue(Number(answer));
  };

  if (phase === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 px-6 py-20">
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 motion-reduce:animate-none dark:border-white/15 dark:border-t-cyan-300"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Loading your session…
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-1 max-w-xs text-sm text-slate-600 dark:text-slate-400">
            {errorMsg}
          </p>
          <Link
            href="/"
            className={`mt-6 rounded-lg px-5 py-2.5 text-sm font-semibold ${primaryButton}`}
          >
            Back to home
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "gameover") {
    return (
      <Shell>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <h1 className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Session complete
          </h1>
          <p className="mt-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 bg-clip-text text-7xl font-semibold tabular-nums tracking-tight text-transparent dark:from-indigo-300 dark:via-violet-200 dark:to-cyan-200">
            {score}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {score === 1 ? "point" : "points"} scored
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-2 sm:flex-row">
            <Link
              href="/"
              className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${primaryButton}`}
            >
              Play again
            </Link>
            <Link
              href="/dashboard"
              className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium ${ghostButton}`}
            >
              View profile
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none dark:bg-emerald-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Session in progress
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 rounded-full bg-slate-100 px-3 py-1 ring-1 ring-inset ring-slate-300 dark:bg-white/5 dark:ring-white/15">
          <span className="text-xs text-slate-600 dark:text-slate-400">Score</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
            {score}
          </span>
        </div>
      </div>

      <div className="px-6 pb-6 pt-5">
        {/* Countdown */}
        <CountdownOrb remaining={remainingTime} total={totalTime} />

        {/* Question */}
        <div
          className={`mt-3 rounded-xl px-6 py-8 text-center ring-1 transition-all duration-200 ${
            feedback === "correct"
              ? "bg-emerald-50 shadow-[0_0_30px_-6px_rgba(16,185,129,0.35)] ring-emerald-400/60 dark:bg-emerald-500/10 dark:shadow-[0_0_30px_-6px_rgba(52,211,153,0.5)] dark:ring-emerald-400/50"
              : feedback === "wrong"
                ? "bg-rose-50 shadow-[0_0_30px_-6px_rgba(244,63,94,0.3)] ring-rose-400/60 dark:bg-rose-500/10 dark:shadow-[0_0_30px_-6px_rgba(251,113,133,0.5)] dark:ring-rose-400/50"
                : "bg-slate-50 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/10"
          }`}
        >
          <p className="bg-gradient-to-b from-slate-900 to-indigo-700 bg-clip-text text-5xl font-semibold tabular-nums tracking-tight text-transparent dark:from-white dark:to-indigo-200">
            {question}
          </p>
          <span className="sr-only" aria-live="polite">
            {feedback === "correct" ? "Correct" : feedback === "wrong" ? "Incorrect" : ""}
          </span>
        </div>

        {/* Answer */}
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="any"
            value={answer}
            onChange={handleChange}
            placeholder="Type your answer"
            aria-label="Your answer"
            autoComplete="off"
            autoFocus
            className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-white px-4 text-center text-lg font-semibold tabular-nums text-slate-900 ring-1 ring-inset ring-slate-300 transition placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-white/5 dark:text-white dark:ring-white/15 dark:placeholder:text-slate-500 dark:focus:ring-cyan-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="submit"
            // Keep focus in the input when the button is clicked/tapped.
            onMouseDown={(e) => e.preventDefault()}
            disabled={submitting || !answer.trim()}
            className={`h-12 rounded-xl px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-slate-500 ${primaryButton}`}
          >
            {submitting ? "Checking…" : "Submit"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-slate-500">
          Correct answers submit automatically
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#f4f5fb] text-slate-900 transition-colors duration-300 dark:bg-[#070815] dark:text-slate-100">
      {/* Ambient colour: two layers that cross-fade when the theme changes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_35%,rgba(99,102,241,0.14),transparent),radial-gradient(40%_35%_at_90%_95%,rgba(34,211,238,0.10),transparent)] opacity-100 transition-opacity duration-500 dark:opacity-0"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_35%,rgba(99,102,241,0.22),transparent),radial-gradient(40%_35%_at_90%_95%,rgba(34,211,238,0.12),transparent)] opacity-0 transition-opacity duration-500 dark:opacity-100"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-10 sm:py-14">
        <div className="w-full overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-200 transition-colors duration-300 dark:bg-slate-900/60 dark:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] dark:ring-white/10 dark:backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}