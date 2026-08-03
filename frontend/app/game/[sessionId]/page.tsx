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
      setRemainingTime(res.remainingTime ?? null);
      setTotalTime(res.remainingTime ?? null);
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

  const isUrgent = remainingTime != null && remainingTime <= 5;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <style jsx global>{`
        @keyframes pulse-glow {
          0%,
          100% {
            filter: drop-shadow(0 0 0 rgba(239, 68, 68, 0));
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.55));
            transform: scale(1.12);
          }
        }
        @keyframes tick-bounce {
          0% {
            transform: scale(1);
          }
          30% {
            transform: scale(1.18);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes fire-shot {
          0% {
            left: 0%;
            opacity: 0;
            transform: translate(0, -50%) scaleX(0.6);
          }
          8% {
            opacity: 1;
            transform: translate(0, -50%) scaleX(1);
          }
          80% {
            opacity: 1;
          }
          100% {
            left: 100%;
            opacity: 0;
          }
        }
        @keyframes muzzle-flash-burst {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.3);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.8);
          }
        }
        @keyframes impact-flash {
          0%,
          78% {
            opacity: 0;
            transform: scale(0.3);
          }
          88% {
            opacity: 1;
            transform: scale(1.5);
          }
          100% {
            opacity: 0;
            transform: scale(1.9);
          }
        }
        @keyframes gun-kick {
          0%,
          88% {
            transform: translateX(0);
          }
          92% {
            transform: translateX(-5px);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          Score: <span className="font-semibold text-indigo-600">{score}</span>
        </span>
        <span
          key={remainingTime}
          className={`text-lg font-bold tabular-nums ${
            isUrgent ? "text-red-600" : "text-gray-700"
          }`}
          style={{ animation: "tick-bounce 0.4s ease-out" }}
        >
          {remainingTime ?? "--"}s
        </span>
      </div>

      {/* Gun-fire timer: fires ONE bullet per second. Every tick of
          remainingTime remounts the shot (via key), so each shot fired
          is a literal 1-second beat of the countdown. */}
      <div className="relative flex h-14 w-full items-center rounded-xl bg-gray-50 px-2">
        {/* gun */}
        <div
          className="relative z-10 flex flex-shrink-0 items-center"
          style={{ animation: "gun-kick 1s ease-out infinite" }}
        >
          <div
            className="h-3 w-7 rounded-sm"
            style={{
              background: isUrgent ? "#ef4444" : "#4f46e5",
              transition: "background-color 0.4s ease",
            }}
          />
          <div
            className="-ml-1 h-5 w-5 rounded-full"
            style={{
              background: isUrgent ? "#ef4444" : "#4f46e5",
              transition: "background-color 0.4s ease",
            }}
          />
        </div>

        {/* lane between gun and target */}
        <div className="relative mx-2 h-6 flex-1 overflow-visible">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-gray-300" />

          {/* muzzle flash, fires fresh each second */}
          <div
            key={`flash-${remainingTime}`}
            className="absolute top-1/2 h-5 w-5 rounded-full"
            style={{
              left: "0%",
              background: isUrgent ? "#ef4444" : "#4f46e5",
              filter: "blur(2px)",
              animation: "muzzle-flash-burst 0.25s ease-out forwards",
            }}
          />

          {/* the bullet itself, fires fresh each second */}
          <div
            key={`bullet-${remainingTime}`}
            className="absolute top-1/2 h-1.5 w-5 rounded-full"
            style={{
              background: isUrgent ? "#ef4444" : "#4f46e5",
              boxShadow: isUrgent
                ? "0 0 10px 3px rgba(239,68,68,0.75)"
                : "0 0 8px 2px rgba(79,70,229,0.65)",
              animation: `fire-shot ${isUrgent ? 0.55 : 0.75}s cubic-bezier(0.2,0.7,0.3,1) forwards`,
            }}
          />
        </div>

        {/* target */}
        <div
          className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2"
          style={{
            borderColor: isUrgent ? "#ef4444" : "#4f46e5",
            transition: "border-color 0.4s ease",
          }}
        >
          <div
            key={`impact-${remainingTime}`}
            className="absolute inset-0 rounded-full"
            style={{
              background: isUrgent ? "#ef4444" : "#4f46e5",
              animation: `impact-flash ${isUrgent ? 0.55 : 0.75}s ease-out forwards`,
            }}
          />
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: isUrgent ? "#ef4444" : "#4f46e5" }}
          />
        </div>
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