export interface Duel {
  id: string;
  player1_id: string;
  player2_id: string;
  configuration_id: string;
  current_question: string | null;
  current_answer: number | null;
  player1_answered: boolean;
  player2_answered: boolean;
  player1_score: number;
  player2_score: number;
  started_at: string;
  ended_at: string | null;
  is_finished: boolean;
  winner_id: string | null;
  level: number;
  timer: number;
}

export interface JoinDuelResponse {
  success: boolean;
  matched: boolean;
  duel?: Duel;
  message?: string;
}

export interface DuelStatusResponse {
  success: boolean;
  matched: boolean;
  duel?: Duel;
}

export interface DuelQuestionResponse {
  success: boolean;
  gameOver?: boolean;
  question?: string;
  player1Score?: number;
  player2Score?: number;
  remainingTime?: number;
  winnerId?: string | null;
}

export interface DuelAnswerResponse {
  success: boolean;
  gameOver?: boolean;
  correct?: boolean;
  score?: number;
  opponentAnswered?: boolean;
  nextQuestion?: boolean;
  player1Score?: number;
  player2Score?: number;
  winnerId?: string | null;
}

export type ChallengeStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface DuelChallenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  configuration_id: string;
  status: ChallengeStatus;
  duel_id: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface IncomingChallenge extends DuelChallenge {
  challenger_username: string;
  challenger_avatar: string | null;
  challenger_level: number;
}

export interface ChallengeResponse {
  success: boolean;
  challenge: DuelChallenge;
  duel?: Duel;
  message?: string;
}

export interface IncomingChallengesResponse {
  success: boolean;
  challenges: IncomingChallenge[];
}