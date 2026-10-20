"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDuelQuestion, submitDuelAnswer } from "@/lib/api";
import { isCorrectAnswer } from "@/lib/solveQuestion";
import DuelScene from "@/components/DuelScene";

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

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const glass =
  "rounded-2xl bg-slate-900/60 ring-1 ring-white/10 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]";

/* Circular countdown. Total time is the first value we see from the server. */
function TimerRing({
  remaining,
  total,
}: {
  remaining: number | null;
  total: number | null;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress =
    remaining !== null && total
      ? Math.max(0, Math.min(1, remaining / total))
      : 1;
  const urgent = remaining !== null && remaining <= 10;

  return (
    <div
      className="relative flex h-28 w-28 items-center justify-center"
      role="timer"
      aria-label="Time remaining"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-white/10"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
            urgent ? "stroke-rose-400" : "stroke-cyan-300"
          }`}
        />
      </svg>

      <div className="text-center">
        <p
          className={`text-3xl font-semibold tabular-nums ${
            urgent ? "text-rose-300" : "text-white"
          }`}
        >
          {remaining === null ? "--" : remaining}
        </p>
        <p className="-mt-0.5 text-xs text-slate-400">seconds</p>
      </div>
    </div>
  );
}

function Score({
  label,
  value,
  leading,
  align,
}: {
  label: string;
  value: number;
  leading: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-sm text-slate-400">{label}</p>
      <p
        className={`text-5xl font-semibold tabular-nums transition-colors ${
          leading ? "text-white" : "text-slate-300"
        }`}
      >
        {value}
      </p>
      <span
        className={`mt-2 inline-block h-1 w-10 rounded-full transition-opacity ${
          leading ? "bg-gradient-to-r from-indigo-400 to-cyan-300" : "opacity-0"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}

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
  const [totalTime, setTotalTime] = useState<number | null>(null);
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
  const inputRef = useRef<HTMLInputElement>(null);
  // Synchronous guard so auto-submit and Enter can never double fire.
  const submittingRef = useRef(false);

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
      const seconds = data.remainingTime;
      setRemainingTime(seconds);
      // The first reading is the full duel length, used for the timer ring
      setTotalTime((current) => current ?? seconds);
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

  // Put the cursor back in the answer box whenever a new question appears
  // or the form comes back after an answer.
  useEffect(() => {
    if (!gameOver && !answered && question) {
      inputRef.current?.focus();
    }
  }, [question, answered, gameOver]);

  const submitValue = async (numericAnswer: number) => {
    if (submittingRef.current || gameOver || answered) return;

    submittingRef.current = true;
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
            data.correct ? "Correct! +1 point" : "Wrong answer, try again!"
          );
        }
      }

      // Fetch the next question right away instead of waiting for the poll
      pollInProgressRef.current = false;
      await pollQuestion();

      if (data.success && !data.gameOver) {
        setLastResult(
          data.correct ? "Correct! +1 point" : "Wrong answer, try again!"
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
      submittingRef.current = false;
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  // Auto-submit the moment the typed value equals the correct answer.
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setAnswerInput(value);

    if (
      submittingRef.current ||
      gameOver ||
      answered ||
      value.trim() === ""
    ) {
      return;
    }

    const numeric = Number(value.trim());

    if (isCorrectAnswer(question, numeric)) {
      void submitValue(numeric);
    }
  };

  // Enter / button is still available for submitting wrong answers.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!answerInput.trim() || submitting || gameOver || answered) {
      return;
    }

    const numericAnswer = Number(answerInput.trim());

    if (!Number.isFinite(numericAnswer)) {
      setError("Enter a valid numeric answer.");
      return;
    }

    void submitValue(numericAnswer);
  };

  const ownScore = isPlayer1 === false ? player2Score : player1Score;
  const opponentScore = isPlayer1 === false ? player1Score : player2Score;

  const outcome: "win" | "lose" | "tie" | null = !gameOver
    ? null
    : winnerId == null
      ? "tie"
      : playerId !== null && String(winnerId) === String(playerId)
        ? "win"
        : "lose";

  const resultText =
    outcome === "tie"
      ? "The duel ended in a tie."
      : outcome === "win"
        ? "You won!"
        : outcome === "lose"
          ? "Your opponent won."
          : "";

  const resultTone =
    outcome === "win"
      ? "from-emerald-300 to-cyan-300"
      : outcome === "lose"
        ? "from-rose-300 to-orange-300"
        : "from-indigo-300 to-violet-300";

  const feedbackIsGood = lastResult?.startsWith("Correct");

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#070815] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_35%,rgba(99,102,241,0.22),transparent),radial-gradient(40%_35%_at_90%_95%,rgba(34,211,238,0.12),transparent)]"
      />
      <DuelScene focus="center" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-10">
        {/* Scoreboard */}
        <div className={`${glass} px-6 py-5`}>
          <div className="flex items-center justify-between gap-4">
            <Score
              label="You"
              value={ownScore}
              leading={ownScore > opponentScore}
              align="left"
            />
            <TimerRing remaining={remainingTime} total={totalTime} />
            <Score
              label="Opponent"
              value={opponentScore}
              leading={opponentScore > ownScore}
              align="right"
            />
          </div>
        </div>

        {gameOver ? (
          <section className={`${glass} px-6 py-12 text-center`}>
            <h1
              className={`bg-gradient-to-r bg-clip-text text-5xl font-semibold tracking-tight text-transparent ${resultTone}`}
            >
              {outcome === "win"
                ? "Victory"
                : outcome === "lose"
                  ? "Defeat"
                  : "Draw"}
            </h1>
            <p className="mt-3 text-lg text-slate-300">{resultText}</p>
            <p className="mt-1 text-sm tabular-nums text-slate-500">
              Final score {ownScore} to {opponentScore}
            </p>

            <button
              type="button"
              onClick={() => router.push("/duel")}
              className={`mt-8 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 ${focusRing}`}
            >
              Back to duels
            </button>
          </section>
        ) : (
          <section className={`${glass} px-6 py-10 text-center sm:px-10`}>
            <h1 className="sr-only">Arithmetic duel</h1>

            {question ? (
              <>
                <p
                  className="bg-gradient-to-b from-white to-indigo-200 bg-clip-text text-5xl font-semibold tabular-nums tracking-tight text-transparent sm:text-6xl"
                  aria-live="polite"
                >
                  {question}
                </p>

                <div className="mt-6 min-h-[2.75rem]">
                  {lastResult && (
                    <p
                      role="status"
                      className={`inline-block rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
                        feedbackIsGood
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30"
                          : "bg-amber-500/10 text-amber-200 ring-amber-400/30"
                      }`}
                    >
                      {lastResult}
                    </p>
                  )}
                </div>

                {answered ? (
                  <p className="mt-2 flex items-center justify-center gap-2 text-slate-400">
                    <span
                      className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    {opponentAnswered
                      ? "Both players have answered. Loading the next question..."
                      : "Answer submitted. Waiting for the next question..."}
                  </p>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="mx-auto mt-2 flex max-w-sm flex-col gap-3"
                  >
                    {/* readOnly (not disabled) while submitting, so the
                        input never loses focus between questions */}
                    <input
                      ref={inputRef}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={answerInput}
                      onChange={handleChange}
                      readOnly={submitting}
                      autoComplete="off"
                      placeholder="Your answer"
                      aria-label="Your answer"
                      className="w-full rounded-xl border-0 bg-white/5 px-4 py-4 text-center text-2xl font-medium tabular-nums text-white placeholder:text-slate-500 ring-1 ring-inset ring-white/15 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      autoFocus
                    />

                    <button
                      type="submit"
                      // Keep focus in the input when the button is clicked/tapped
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={
                        submitting ||
                        answered ||
                        !answerInput.trim() ||
                        gameOver
                      }
                      className={`w-full rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none ${focusRing}`}
                    >
                      {submitting ? "Submitting..." : "Submit answer"}
                    </button>

                    <p className="text-xs text-slate-500">
                      Correct answers submit automatically
                    </p>
                  </form>
                )}

                {waitingForOpponent && (
                  <p className="mt-5 text-sm text-slate-500">
                    Your opponent is still answering.
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 text-slate-400">
                <span
                  className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300 motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <p>Waiting for the first question...</p>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mx-auto mt-5 max-w-sm rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-200 ring-1 ring-red-400/30"
              >
                {error}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}