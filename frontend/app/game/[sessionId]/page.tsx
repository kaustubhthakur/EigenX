"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getQuestion, submitAnswer } from "../../../lib/api";

const CountdownOrb = dynamic(() => import("../../../components/CountdownOrb"), {
  ssr: false,
  loading: () => <div className="mx-auto h-48 w-48" />,
});

type Phase = "loading" | "playing" | "gameover" | "error";

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
      inputRef.current?.focus();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load question");
      setPhase("error");
    }
  };

  useEffect(() => {
    loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await submitAnswer(sessionId, Number(answer));
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
      setSubmitting(false);
    }
  };

  if (phase === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 px-6 py-20">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading your session…</p>
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-1 max-w-xs text-sm text-slate-500">{errorMsg}</p>
          <Link
            href="/"
            className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
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
          <h1 className="text-sm font-medium text-slate-500">Session complete</h1>
          <p className="mt-3 text-6xl font-semibold tabular-nums tracking-tight text-slate-900">{score}</p>
          <p className="mt-1 text-sm text-slate-500">{score === 1 ? "point" : "points"} scored</p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-2 sm:flex-row">
            <Link
              href="/"
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Play again
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
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
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-slate-600">Session in progress</span>
        </div>
        <div className="flex items-baseline gap-1.5 rounded-full bg-slate-50 px-3 py-1 ring-1 ring-inset ring-slate-200">
          <span className="text-xs text-slate-500">Score</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{score}</span>
        </div>
      </div>

      <div className="px-6 pb-6 pt-5">
        {/* Countdown */}
        <CountdownOrb remaining={remainingTime} total={totalTime} />

        {/* Question */}
        <div
          className={`mt-3 rounded-xl border px-6 py-8 text-center transition-colors duration-200 ${
            feedback === "correct"
              ? "border-emerald-200 bg-emerald-50"
              : feedback === "wrong"
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50/60"
          }`}
        >
          <p className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900">{question}</p>
          <span className="sr-only" aria-live="polite">
            {feedback === "correct" ? "Correct" : feedback === "wrong" ? "Incorrect" : ""}
          </span>
        </div>

        {/* Answer */}
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer"
            aria-label="Your answer"
            autoFocus
            className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-center text-lg font-semibold text-slate-900 shadow-sm transition placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="submit"
            disabled={submitting || !answer.trim()}
            className="h-12 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Submit"}
          </button>
        </form>
        <p className="mt-3 hidden text-center text-xs text-slate-400 sm:block">Press Enter to submit</p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-14">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}