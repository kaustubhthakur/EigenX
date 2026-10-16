
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface QuestionResponse {
  success?: boolean;
  gameOver?: boolean;
  question?: string | null;
  player1Score?: number;
  player2Score?: number;
  remainingTime?: number;
  winnerId?: string | number | null;
}

export default function DuelRoomPage() {
  const params = useParams<{ duelId: string }>();
  const duelId = String(params.duelId);
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
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const lastQuestionRef = useRef<string | null>(null);
  const answeredQuestionRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const gameOverRef = useRef(false);

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
      ? String(duelMeta.player2_id)
      : String(duelMeta.player1_id);
  }, [duelMeta, user]);

  const applyScores = useCallback(
    (res: QuestionResponse) => {
      if (
        typeof res.player1Score !== "number" ||
        typeof res.player2Score !== "number"
      ) {
        return;
      }

      setMyScore(isPlayer1 ? res.player1Score : res.player2Score);
      setOpponentScore(isPlayer1 ? res.player2Score : res.player1Score);
    },
    [isPlayer1]
  );

  const finishGame = useCallback(
    (res: QuestionResponse) => {
      gameOverRef.current = true;
      setGameOver(true);
      setWinnerId(
        res.winnerId === undefined || res.winnerId === null
          ? null
          : String(res.winnerId)
      );
      applyScores(res);
    },
    [applyScores]
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!duelId || authLoading || !user) return;

    let cancelled = false;

    async function loadDuel() {
      try {
        setMetaError(null);

        const response = await getDuelById(duelId);
        const duel = response?.duel ?? response;

        if (
          !duel ||
          String(duel.id) !== duelId ||
          (String(duel.player1_id) !== String(user.id) &&
            String(duel.player2_id) !== String(user.id))
        ) {
          throw new Error("Duel not found, or you are not a participant.");
        }

        if (!cancelled) {
          setDuelMeta(duel as Duel);
          setMyScore(
            String(duel.player1_id) === String(user.id)
              ? Number(duel.player1_score ?? 0)
              : Number(duel.player2_score ?? 0)
          );
          setOpponentScore(
            String(duel.player1_id) === String(user.id)
              ? Number(duel.player2_score ?? 0)
              : Number(duel.player1_score ?? 0)
          );

          if (duel.is_finished) {
            gameOverRef.current = true;
            setGameOver(true);
            setWinnerId(
              duel.winner_id == null ? null : String(duel.winner_id)
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMetaError(
            error instanceof Error
              ? error.message
              : "Unable to load duel details."
          );
        }
      }
    }

    loadDuel();

    return () => {
      cancelled = true;
    };
  }, [duelId, authLoading, user]);

  useEffect(() => {
    if (!opponentId) return;

    let cancelled = false;

    getUserById(opponentId)
      .then((res) => {
        const data = res?.user ?? res;

        if (!cancelled) {
          setOpponent({
            id: opponentId,
            username: data?.username ?? "Opponent",
            avatar: data?.avatar ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpponent({
            id: opponentId,
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
    if (!duelId || !duelMeta || gameOver) return;

    let cancelled = false;
    let polling = false;

    const poll = async () => {
      if (cancelled || polling || gameOverRef.current) return;

      polling = true;

      try {
        const res = (await getDuelQuestion(duelId)) as QuestionResponse;

        if (cancelled || gameOverRef.current) return;

        if (res.gameOver) {
          finishGame(res);
          return;
        }

        applyScores(res);

        if (typeof res.remainingTime === "number") {
          setRemainingTime(Math.max(0, res.remainingTime));
        }

        if (typeof res.question === "string" && res.question.length > 0) {
          if (lastQuestionRef.current !== res.question) {
            lastQuestionRef.current = res.question;
            answeredQuestionRef.current = null;

            setQuestion(res.question);
            setAnswered(false);
            setLastResult(null);
            setAnswerInput("");
            setWaitingForOpponent(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to sync duel:", error);
        }
      } finally {
        polling = false;
      }
    };

    void poll();

    const interval = setInterval(() => {
      void poll();
    }, 700);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [duelId, duelMeta, gameOver, applyScores, finishGame]);

  useEffect(() => {
    if (gameOver || !duelMeta) return;

    const interval = setInterval(() => {
      setRemainingTime((time) =>
        time === null ? null : Math.max(0, time - 1)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [gameOver, duelMeta]);

  const handleSubmit = async () => {
    const currentQuestion = lastQuestionRef.current;

    if (
      !duelId ||
      !currentQuestion ||
      !answerInput.trim() ||
      !Number.isFinite(Number(answerInput)) ||
      answered ||
      submittingRef.current ||
      gameOverRef.current
    ) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const res = await submitDuelAnswer(duelId, Number(answerInput));

      if (res.gameOver) {
        finishGame(res);
        return;
      }

      applyScores(res);

      if (res.success !== false) {
        answeredQuestionRef.current = currentQuestion;
        setAnswered(true);
        setLastResult(res.correct ? "correct" : "wrong");
        setWaitingForOpponent(true);

        if (typeof res.score === "number") {
          setMyScore(res.score);
        }
      } else {
        const message = String(res.message ?? "");

        if (
          message.toLowerCase().includes("already answered") ||
          message.toLowerCase().includes("already solved")
        ) {
          answeredQuestionRef.current = currentQuestion;
          setAnswered(true);
          setWaitingForOpponent(true);
        } else {
          console.error("Answer rejected:", message);
        }
      }
    } catch (error) {
      console.error("Failed to submit duel answer:", error);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (authLoading || !user || !duelMeta) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        {metaError ? (
          <div className="text-center">
            <p className="text-sm text-red-600">{metaError}</p>
            <button
              onClick={() => router.push("/duel")}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Back to lobby
            </button>
          </div>
        ) : (
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
        )}
      </div>
    );
  }

  if (gameOver) {
    const outcome =
      winnerId === null
        ? "draw"
        : winnerId === String(user.id)
          ? "win"
          : "loss";

    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-400">
          Duel over
        </p>

        <h1
          className={`mt-2 text-3xl font-bold ${
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
            <p className="text-3xl font-bold">{myScore}</p>
            <p className="text-xs text-gray-500">You</p>
          </div>
          <span className="text-gray-300">–</span>
          <div>
            <p className="text-3xl font-bold">{opponentScore}</p>
            <p className="text-xs text-gray-500">
              {opponent?.username ?? "Opponent"}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push("/duel")}
          className="mt-10 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
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
          <span className="text-lg font-bold">{myScore}</span>
        </div>

        <div className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold tabular-nums text-white">
          {remainingTime ?? duelMeta.timer ?? "–"}s
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{opponentScore}</span>
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
            {opponent?.avatar ? (
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

        <form
          className="mt-8 flex items-center justify-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            value={answerInput}
            onChange={(event) => setAnswerInput(event.target.value)}
            disabled={answered || submitting || !question}
            placeholder="Your answer"
            className="w-40 rounded-lg border border-gray-300 px-4 py-2.5 text-center text-lg font-semibold outline-none focus:border-indigo-500 disabled:bg-gray-50"
          />

          <button
            type="submit"
            disabled={
              answered ||
              submitting ||
              !question ||
              !answerInput.trim()
            }
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>

        {lastResult && (
          <p
            className={`mt-4 text-sm font-semibold ${
              lastResult === "correct"
                ? "text-emerald-600"
                : "text-red-500"
            }`}
          >
            {lastResult === "correct" ? "Correct answer!" : "Incorrect answer"}
          </p>
        )}

        {waitingForOpponent && (
          <p className="mt-2 text-sm text-gray-500">
            Waiting for your opponent to answer…
          </p>
        )}
      </div>
    </div>
  );
}
