"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDuelQuestion, submitDuelAnswer } from "@/lib/api";

type DuelResponse = {
  success: boolean;
  gameOver?: boolean;
  isPlayer1?: boolean;
  question?: string | null;
  player1Score?: number;
  player2Score?: number;
  player1Answered?: boolean;
  player2Answered?: boolean;
  answered?: boolean;
  opponentAnswered?: boolean;
  waitingForOpponent?: boolean;
  remainingTime?: number;
  winnerId?: string | number | null;
  duel?: {
    player1_id: string | number;
    player2_id: string | number;
    player1_score: number;
    player2_score: number;
    winner_id?: string | number | null;
  };
  message?: string;
};

type AnswerResponse = DuelResponse & {
  correct?: boolean;
  score?: number;
  nextQuestion?: boolean;
};

export default function DuelPage() {
  const params = useParams<{ duelId: string }>();
  const router = useRouter();
  const duelId = params.duelId;

  const [question, setQuestion] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [isPlayer1, setIsPlayer1] = useState<boolean | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winnerId, setWinnerId] = useState<string | number | null>(null);
  const [playerId, setPlayerId] = useState<string | number | null>(null);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const lastQuestionRef = useRef("");
  const gameOverRef = useRef(false);
  const pollInProgressRef = useRef(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setPlayerId(user.id ?? user.user?.id ?? null);
      } catch {
        setPlayerId(null);
      }
    }
  }, []);

  const applyDuelState = useCallback((data: DuelResponse) => {
    if (typeof data.isPlayer1 === "boolean") {
      setIsPlayer1(data.isPlayer1);
    }

    if (typeof data.player1Score === "number") {
      setPlayer1Score(data.player1Score);
    }

    if (typeof data.player2Score === "number") {
      setPlayer2Score(data.player2Score);
    }

    if (typeof data.remainingTime === "number") {
      setRemainingTime(data.remainingTime);
    }

    if (data.duel) {
      setPlayer1Score(data.duel.player1_score);
      setPlayer2Score(data.duel.player2_score);
      setWinnerId(data.duel.winner_id ?? null);
    }

    if (data.winnerId !== undefined) {
      setWinnerId(data.winnerId);
    }

    if (data.gameOver) {
      gameOverRef.current = true;
      setGameOver(true);
      setAnswered(true);
      return;
    }

    // A new question (or the same one after a reset) means a fresh round
    if (data.question && data.question !== lastQuestionRef.current) {
      lastQuestionRef.current = data.question;
      setQuestion(data.question);
      setAnswerInput("");
      setAnswered(false);
      setOpponentAnswered(false);
      setWaitingForOpponent(false);
      setLastResult(null);
    }

    // The question was cleared (someone scored). Forget it so the next
    // poll can load the new one, even if the text happens to be identical.
    if (data.question === null) {
      lastQuestionRef.current = "";
    }

    if (typeof data.answered === "boolean") {
      setAnswered(data.answered);
    }

    if (typeof data.opponentAnswered === "boolean") {
      setOpponentAnswered(data.opponentAnswered);
    }

    setWaitingForOpponent(Boolean(data.waitingForOpponent));
  }, []);

  const pollQuestion = useCallback(async () => {
    if (!duelId || gameOverRef.current || pollInProgressRef.current) {
      return;
    }

    pollInProgressRef.current = true;

    try {
      const response = await getDuelQuestion(duelId);
      const data = response as DuelResponse;

      if (data.success) {
        applyDuelState(data);
        setError("");
      }
    } catch (err) {
      console.error("Failed to fetch duel question:", err);
    } finally {
      pollInProgressRef.current = false;
    }
  }, [duelId, applyDuelState]);

  useEffect(() => {
    if (!duelId) return;

    pollQuestion();

    const interval = window.setInterval(pollQuestion, 1000);

    return () => window.clearInterval(interval);
  }, [duelId, pollQuestion]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!answerInput.trim() || submitting || gameOver || answered) {
      return;
    }

    const numericAnswer = Number(answerInput.trim());

    if (!Number.isFinite(numericAnswer)) {
      setError("Enter a valid numeric answer.");
      return;
    }

    const submittedQuestion = question;

    try {
      setSubmitting(true);
      setError("");

      const data = (await submitDuelAnswer(
        duelId,
        numericAnswer,
        submittedQuestion
      )) as AnswerResponse;

      setAnswerInput("");

      if (data.success) {
        applyDuelState(data);

        if (!data.gameOver) {
          setLastResult(
            data.correct
              ? "Correct! +1 point"
              : "Wrong answer. Waiting for your opponent..."
          );
        }
      }

      // Fetch the next question right away instead of waiting for the poll
      pollInProgressRef.current = false;
      await pollQuestion();

      if (data.success && !data.gameOver) {
        setLastResult(
          data.correct
            ? "Correct! +1 point"
            : "Wrong answer. Waiting for your opponent..."
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit answer.";

      setAnswerInput("");
      pollInProgressRef.current = false;
      await pollQuestion();

      if (message.toLowerCase().includes("too late")) {
        // The opponent scored first and the question already changed
        setLastResult("Too late! Your opponent answered first.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const ownScore = isPlayer1 === false ? player2Score : player1Score;
  const opponentScore = isPlayer1 === false ? player1Score : player2Score;

  const resultText = gameOver
    ? winnerId == null
      ? "The duel ended in a tie."
      : playerId !== null && String(winnerId) === String(playerId)
        ? "You won!"
        : "Your opponent won."
    : "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="w-full rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Your score</p>
            <p className="text-3xl font-bold">{ownScore}</p>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">Time remaining</p>
            <p className="text-2xl font-semibold">
              {remainingTime === null ? "--" : `${remainingTime}s`}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Opponent</p>
            <p className="text-3xl font-bold">{opponentScore}</p>
          </div>
        </div>
      </div>

      {gameOver ? (
        <section className="w-full rounded-2xl border p-8 text-center">
          <h1 className="text-3xl font-bold">Duel finished</h1>
          <p className="mt-3 text-lg">{resultText}</p>

          <button
            type="button"
            onClick={() => router.push("/duel")}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white"
          >
            Back to duels
          </button>
        </section>
      ) : (
        <section className="w-full rounded-2xl border p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Arithmetic Duel</h1>

          {question ? (
            <>
              <p className="my-8 text-4xl font-bold">{question}</p>

              {lastResult && (
                <p className="mb-4 font-medium">{lastResult}</p>
              )}

              {answered ? (
                <p className="mb-4 text-gray-500">
                  {opponentAnswered
                    ? "Both players have answered. Loading the next question..."
                    : "Answer submitted. Waiting for the next question..."}
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={answerInput}
                    onChange={(event) => setAnswerInput(event.target.value)}
                    disabled={submitting || gameOver}
                    placeholder="Enter your answer"
                    className="w-full rounded-xl border px-4 py-3 text-lg"
                    autoFocus
                  />

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      answered ||
                      !answerInput.trim() ||
                      gameOver
                    }
                    className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit answer"}
                  </button>
                </form>
              )}

              {waitingForOpponent && (
                <p className="mt-4 text-sm text-gray-500">
                  Your opponent is still answering.
                </p>
              )}
            </>
          ) : (
            <p className="py-10 text-gray-500">
              Waiting for the first question...
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </section>
      )}
    </main>
  );
}