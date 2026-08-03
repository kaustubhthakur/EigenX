"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getQuestion, submitAnswer } from "../../../lib/api";

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
      setRemainingTime(res.remainingTime ?? null);
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
   
  }, [sessionId]);

 
  useEffect(() => {
    if (phase !== "playing" || remainingTime == null) return;
    if (remainingTime <= 0) {
      loadNextQuestion(); 
      return;
    }
    const t = setTimeout(() => setRemainingTime((r) => (r != null ? r - 1 : r)), 1000);
    return () => clearTimeout(t);
    
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
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm font-medium text-red-600">{errorMsg}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Back home
        </Link>
      </div>
    );
  }

  if (phase === "gameover") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-400">Game over</p>
        <p className="mt-2 text-5xl font-bold text-indigo-600">{score}</p>
        <p className="mt-1 text-sm text-gray-500">points</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Play again
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            View profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-500">
          Score: <span className="font-semibold text-indigo-600">{score}</span>
        </span>
        <span
          className={`font-semibold ${
            remainingTime != null && remainingTime <= 5 ? "text-red-600" : "text-gray-700"
          }`}
        >
          {remainingTime ?? "--"}s
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            remainingTime != null && remainingTime <= 5 ? "bg-red-500" : "bg-indigo-600"
          }`}
          style={{ width: remainingTime != null ? `${Math.max(0, remainingTime) * 2}%` : "0%" }}
        />
      </div>

      <div
        className={`mt-12 rounded-2xl border p-10 text-center transition-colors ${
          feedback === "correct"
            ? "border-green-300 bg-green-50"
            : feedback === "wrong"
              ? "border-red-300 bg-red-50"
              : "border-gray-200 bg-white"
        }`}
      >
        <p className="text-3xl font-bold tracking-tight text-gray-900">{question}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer"
          autoFocus
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-center text-lg font-semibold shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={submitting || !answer.trim()}
          className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? "..." : "Submit"}
        </button>
      </form>
    </div>
  );
}