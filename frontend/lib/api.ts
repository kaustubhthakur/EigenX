import type {
  ApiErrorBody,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from "../types/auth";

import type {
  UserProfile,
  ProfileResponse,
  UpdateScorePayload,
} from "../types/user";

import type {
  FriendsResponse,
  PendingRequestsResponse,
} from "../types/friend";

import type {
  JoinDuelResponse,
  DuelStatusResponse,
  DuelQuestionResponse,
  DuelAnswerResponse,
  ChallengeResponse,
  IncomingChallengesResponse,
} from "../types/duel";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/auth";

const USERS_API_URL =
  process.env.NEXT_PUBLIC_USERS_API_URL || "http://localhost:8081/users";

const FRIENDS_API_URL =
  process.env.NEXT_PUBLIC_FRIENDS_API_URL || "http://localhost:8081/friends";

const CONFIG_API_URL =
  process.env.NEXT_PUBLIC_CONFIG_API_URL || "http://localhost:8081/configuration";

const GAME_API_URL =
  process.env.NEXT_PUBLIC_GAME_API_URL || "http://localhost:8081/game";

const DASHBOARD_API_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:8081/dashboard";

const DUEL_API_URL =
  process.env.NEXT_PUBLIC_DUEL_API_URL || "http://localhost:8081/duel";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  base: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  let data: unknown = null;

  try {
    data = await res.json();
  } catch {
    // Response has no JSON body.
  }

  if (!res.ok) {
    const body = data as (ApiErrorBody & { message?: string }) | null;
    const message =
      body?.error ||
      body?.message ||
      "Something went wrong. Please try again.";

    throw new Error(message);
  }

  return data as T;
}

export const ASSET_BASE_URL = USERS_API_URL.replace(/\/users$/, "");

export function resolveAvatarUrl(
  avatar?: string | null
): string | undefined {
  if (!avatar) return undefined;

  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }

  return `${ASSET_BASE_URL}${avatar}`;
}



export function registerUser(
  payload: RegisterPayload
): Promise<RegisterResponse> {
  return request<RegisterResponse>(API_URL, "/register", {
    method: "POST",
    body: payload,
  });
}

export function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  return request<LoginResponse>(API_URL, "/login", {
    method: "POST",
    body: payload,
  });
}

export function verifyOtp(
  payload: VerifyOtpPayload
): Promise<VerifyOtpResponse> {
  return request<VerifyOtpResponse>(API_URL, "/verifyOtp", {
    method: "POST",
    body: payload,
  });
}

export function logoutUser(): Promise<{ message: string }> {
  return request<{ message: string }>(API_URL, "/logout", {
    method: "POST",
  });
}



export function getProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/Profile");
}

export function getUserById(id: string): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, `/${id}`);
}

export function getAllUsers(): Promise<{
  success: boolean;
  count: number;
  users: UserProfile[];
}> {
  return request(USERS_API_URL, "/");
}

export function updateProfile(payload: {
  username?: string;
  avatar?: string;
}): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/profile", {
    method: "PUT",
    body: payload,
  });
}

export function updateScore(
  payload: UpdateScorePayload
): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/score", {
    method: "PUT",
    body: payload,
  });
}

export async function uploadAvatar(file: File): Promise<ProfileResponse> {
  const base64Image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image"));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  return request<ProfileResponse>(USERS_API_URL, "/avatar", {
    method: "POST",
    body: { image: base64Image },
  });
}

// Friends

export interface SendFriendRequestResponse {
  success: boolean;
  alreadyRequested?: boolean;
  message: string;
  request?: unknown;
}

export interface SentRequestsResponse {
  success: boolean;
  count: number;
  requests: {
    receiver_id: string | number;
  }[];
}

export function sendFriendRequest(
  receiverId: string
): Promise<SendFriendRequestResponse> {
  return request<SendFriendRequestResponse>(FRIENDS_API_URL, "/request", {
    method: "POST",
    body: { receiverId },
  });
}

export function acceptFriendRequest(
  requestId: string
): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, `/accept/${requestId}`, {
    method: "PUT",
  });
}

export function getFriends(): Promise<FriendsResponse> {
  return request<FriendsResponse>(FRIENDS_API_URL, "/");
}

export function getPendingRequests(): Promise<PendingRequestsResponse> {
  return request<PendingRequestsResponse>(FRIENDS_API_URL, "/requests");
}

export function getSentRequests(): Promise<SentRequestsResponse> {
  return request<SentRequestsResponse>(FRIENDS_API_URL, "/sent");
}

export function removeFriend(
  friendId: string
): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, `/${friendId}`, {
    method: "DELETE",
  });
}

// Game configuration

export interface GameConfiguration {
  id: string;
  level: number;
  timer: number;
  is_custom?: boolean;
}

export interface CustomSettings {
  timer: number;
  operations: string[];
  leftMinDigits: number;
  leftMaxDigits: number;
  rightMinDigits: number;
  rightMaxDigits: number;
  decimalPlaces: number;
}

export interface StartGameResponse {
  success: boolean;
  message: string;
  sessionId: string;
}

export async function getConfigurations(): Promise<GameConfiguration[]> {
  try {
    const res = await request<{
      success: boolean;
      configurations: GameConfiguration[];
    }>(CONFIG_API_URL, "/");

    return res.configurations;
  } catch {
    return [1, 2, 3].flatMap((level) =>
      [30, 60, 90].map((timer) => ({
        id: `fallback-${level}-${timer}`,
        level,
        timer,
      }))
    );
  }
}

export function startGame(payload: {
  level: number;
  timer: number;
}): Promise<StartGameResponse> {
  return request<StartGameResponse>(CONFIG_API_URL, "/start", {
    method: "POST",
    body: payload,
  });
}

export function startCustomGame(
  settings: CustomSettings
): Promise<StartGameResponse> {
  return request<StartGameResponse>(CONFIG_API_URL, "/start-custom", {
    method: "POST",
    body: settings,
  });
}

export interface QuestionResponse {
  success: boolean;
  gameOver?: boolean;
  score: number;
  remainingTime?: number;
  question?: string;
}

export interface AnswerResponse {
  success: boolean;
  gameOver?: boolean;
  correct?: boolean;
  score: number;
  nextQuestion?: boolean;
}

export function getQuestion(sessionId: string): Promise<QuestionResponse> {
  return request<QuestionResponse>(GAME_API_URL, `/question/${sessionId}`);
}

export function submitAnswer(
  sessionId: string,
  answer: number
): Promise<AnswerResponse> {
  return request<AnswerResponse>(GAME_API_URL, "/answer", {
    method: "POST",
    body: { sessionId, answer },
  });
}

// Leaderboard

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  avatar: string | null;
  xp: number;
  level: number;
  top_score: number;
  top_score_at: string | null;
  difficulty_level: number | null;
  is_online: boolean;
}

export interface LeaderboardResponse {
  success: boolean;
  count: number;
  leaderboard: LeaderboardEntry[];
}

export function getLeaderboard(): Promise<LeaderboardResponse> {
  return request<LeaderboardResponse>(DASHBOARD_API_URL, "/leaderboard");
}

// Duels

export function joinDuel(
  configurationId: string
): Promise<JoinDuelResponse> {
  return request<JoinDuelResponse>(DUEL_API_URL, "/join", {
    method: "POST",
    body: { configurationId },
  });
}

export function getDuelStatus(): Promise<DuelStatusResponse> {
  return request<DuelStatusResponse>(DUEL_API_URL, "/status");
}

export function leaveDuelQueue(): Promise<{
  success: boolean;
  message: string;
}> {
  return request(DUEL_API_URL, "/queue", {
    method: "DELETE",
  });
}

export function challengeFriend(
  friendId: string,
  configurationId: string
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(DUEL_API_URL, "/challenge", {
    method: "POST",
    body: { friendId, configurationId },
  });
}

export function getIncomingChallenges(): Promise<IncomingChallengesResponse> {
  return request<IncomingChallengesResponse>(DUEL_API_URL, "/challenges");
}

export function respondToChallenge(
  challengeId: string,
  accept: boolean
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(
    DUEL_API_URL,
    `/challenges/${challengeId}/respond`,
    {
      method: "POST",
      body: { accept },
    }
  );
}

export function cancelChallenge(
  challengeId: string
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(DUEL_API_URL, `/challenges/${challengeId}`, {
    method: "DELETE",
  });
}

export function getDuelQuestion(
  duelId: string
): Promise<DuelQuestionResponse> {
  return request<DuelQuestionResponse>(DUEL_API_URL, `/question/${duelId}`);
}

export function submitDuelAnswer(
  duelId: string,
  answer: number
): Promise<DuelAnswerResponse> {
  return request<DuelAnswerResponse>(DUEL_API_URL, "/answer", {
    method: "POST",
    body: { duelId, answer },
  });
}