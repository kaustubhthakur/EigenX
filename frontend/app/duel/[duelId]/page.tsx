
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import {
  getDuelQuestion,
  getDuelById,
  getUserById,
  resolveAvatarUrl,
  submitDuelAnswer,
} from "../../../lib/api";
import type { Duel } from "../../../types/duel";

interface OpponentInfo {
  id: string;
  username: string;
  avatar?: string | null;
}

function loadStoredDuel(duelId: string): Duel | null {
  try {
    const raw = sessionStorage.getItem(`duel:${duelId}`);
    return raw ? (JSON.parse(raw) as Duel) : null;
  } catch {
    return null;
  }
}

export default function DuelRoomPage() {
  const params = useParams<{ duelId: string }>();
  const duelId = params.duelId;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [duelMeta, setDuelMeta] = useState<Duel | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);

  const [question, setQuestion] = useState<string | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(
    null
  );

  const [gameOver, setGameOver] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null | undefined>(
    undefined
  );

  const [answerInput, setAnswerInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lastQuestionRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Load duel metadata from session storage or the backend.
  useEffect(() => {
    if (!duelId || authLoading || !user) return;

    let cancelled = false;

    async function loadDuel() {
      setMetaError(null);
      setDuelMeta(null);

      try {
        const stored = loadStoredDuel(duelId);

        if (stored) {
          const isParticipant =
            String(stored.player1_id) === String(user.id) ||
            String(stored.player2_id) === String(user.id);

          if (
            String(stored.id) === String(duelId) &&
            isParticipant
          ) {
            if (!cancelled) {
              setDuelMeta(stored);
              return;
            }
          }
        }

        const response = await getDuelById(duelId);
        const duel = response?.duel ?? response;

        if (
          !duel ||
          String(duel.id) !== String(duelId) ||
          (String(duel.player1_id) !== String(user.id) &&
            String(duel.player2_id) !== String(user.id))
        ) {
          throw new Error(
            "Duel not found, or you are not a participant in this duel."
          );
        }

        if (!cancelled) {
          setDuelMeta(duel as Duel);
          sessionStorage.setItem(
            `duel:${duelId}`,
            JSON.stringify(duel)
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMetaError(
            error instanceof Error
              ? error.message
              : "Unable to load duel details. Please return to the lobby."
          );
        }
      }
    }

    loadDuel();

    return () => {
      cancelled = true;
    };
  }, [duelId, authLoading, user]);

  const isPlayer1 = useMemo(
    () =>
      !!duelMeta &&
      !!user &&
      String(duelMeta.player1_id) === String(user.id),
    [duelMeta, user]
  );

  const opponentId = useMemo(() => {
    if (!duelMeta || !user) return null;

    return String(duelMeta.player1_id) === String(user.id)
      ? duelMeta.player2_id
      : duelMeta.player1_id;
  }, [duelMeta, user]);

  useEffect(() => {
    if (!opponentId) return;

    let cancelled = false;

    getUserById(String(opponentId))
      .then((res) => {
        const u =
          (res as unknown as { user?: OpponentInfo })?.user ??
          (res as unknown as OpponentInfo);

        if (!cancelled) {
          setOpponent({
            id: String(opponentId),
            username: u.username ?? "Opponent",
            avatar: u.avatar ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpponent({
            id: String(opponentId),
            username: "Opponent",
            avatar: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [opponentId]);

  useEffect(() => {
    if (!duelId || !duelMeta) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await getDuelQuestion(duelId);

        if (cancelled) return;

        if (res.gameOver) {
          setGameOver(true);
          setWinnerId(res.winnerId ?? null);

          if (typeof res.player1Score === "number") {
            setMyScore(
              isPlayer1 ? res.player1Score : res.player2Score ?? 0
            );
            setOpponentScore(
              isPlayer1 ? res.player2Score ?? 0 : res.player1Score
            );
          }

          if (pollRef.current) clearInterval(pollRef.current);
          if (tickRef.current) clearInterval(tickRef.current);
          return;
        }

        if (typeof res.player1Score === "number") {
          setMyScore(
            isPlayer1 ? res.player1Score : res.player2Score ?? 0
          );
          setOpponentScore(
            isPlayer1 ? res.player2Score ?? 0 : res.player1Score
          );
        }

        if (typeof res.remainingTime === "number") {
          setRemainingTime(res.remainingTime);
        }

        if (res.question && res.question !== lastQuestionRef.current) {
          lastQuestionRef.current = res.question;
          setQuestion(res.question);
          setAnswered(false);
          setOpponentAnswered(false);
          setLastResult(null);
          setAnswerInput("");
        }
      } catch {
        // Retry on the next poll.
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1200);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [duelId, duelMeta, isPlayer1]);

  useEffect(() => {
    if (gameOver || !duelMeta) return;

    tickRef.current = setInterval(() => {
      setRemainingTime((t) =>
        t === null ? t : Math.max(0, t - 1)
      );
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [gameOver, duelMeta]);

  const handleSubmit = async () => {
    if (!duelId || !answerInput || answered || submitting) return;

    setSubmitting(true);

    try {
      const res = await submitDuelAnswer(
        duelId,
        Number(answerInput)
      );

      if (res.gameOver) {
        setGameOver(true);
        setWinnerId(res.winnerId ?? null);

        if (typeof res.player1Score === "number") {
          setMyScore(
            isPlayer1 ? res.player1Score : res.player2Score ?? 0
          );
          setOpponentScore(
            isPlayer1 ? res.player2Score ?? 0 : res.player1Score
          );
        }

        return;
      }

      setAnswered(true);
      setLastResult(res.correct ? "correct" : "wrong");

      if (typeof res.score === "number") {
        setMyScore(res.score);
      }

      setOpponentAnswered(!!res.opponentAnswered);
    } catch (error) {
      console.error("Failed to submit duel answer:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-gray-600">{metaError}</p>
        <button
          onClick={() => router.push("/duel")}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to lobby
        </button>
      </div>
    );
  }

  if (!duelMeta) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (gameOver) {
    const outcome =
      winnerId === undefined || winnerId === null
        ? "draw"
        : String(winnerId) === String(user.id)
          ? "win"
          : "loss";

    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-400">
          Duel over
        </p>

        <h1
          className={`mt-2 text-3xl font-bold tracking-tight ${
            outcome === "win"
              ? "text-emerald-600"
              : outcome === "loss"
                ? "text-red-500"
                : "text-gray-700"
          }`}
        >
          {outcome === "win"
            ? "You won!"
            : outcome === "loss"
              ? "You lost"
              : "It's a draw"}
        </h1>

        <div className="mx-auto mt-8 flex max-w-xs items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900">{myScore}</p>
            <p className="text-xs text-gray-500">You</p>
          </div>

          <span className="text-gray-300">–</span>

          <div>
            <p className="text-3xl font-bold text-gray-900">
              {opponentScore}
            </p>
            <p className="text-xs text-gray-500">
              {opponent?.username ?? "Opponent"}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push("/duel")}
          className="mt-10 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Back to lobby
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
            {user.username?.[0]?.toUpperCase() || "?"}
          </span>
          <span className="text-lg font-bold text-gray-900">
            {myScore}
          </span>
        </div>

        <div className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold tabular-nums text-white">
          {remainingTime ?? duelMeta.timer ?? "–"}s
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">
            {opponentScore}
          </span>

          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
            {opponent?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveAvatarUrl(opponent.avatar)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              opponent?.username?.[0]?.toUpperCase() || "?"
            )}
          </span>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {question ? (
          <p className="text-4xl font-bold tracking-tight text-gray-900">
            {question}
          </p>
        ) : (
          <div className="mx-auto h-10 w-40 animate-pulse rounded-lg bg-gray-100" />
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && handleSubmit()
            }
            disabled={answered || submitting || !question}
            placeholder="Your answer"
            className="w-40 rounded-lg border border-gray-300 px-4 py-2.5 text-center text-lg font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
          />

          <button
            onClick={handleSubmit}
            disabled={
              answered || submitting || !question || !answerInput
            }
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
