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

const API_HOST =
  process.env.NEXT_PUBLIC_API_HOST || "http://localhost:8081";

const API_URL = `${API_HOST}/auth`;
const USERS_API_URL = `${API_HOST}/users`;
const FRIENDS_API_URL = `${API_HOST}/friends`;
const CONFIG_API_URL = `${API_HOST}/configuration`;
const GAME_API_URL = `${API_HOST}/game`;
const DASHBOARD_API_URL = `${API_HOST}/dashboard`;
const DUEL_API_URL = `${API_HOST}/duel`;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiMessage {
  success?: boolean;
  message?: string;
  error?: string;
}

async function request<T>(
  base: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {}),
      },
      credentials: "include",
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new Error(
      "Cannot connect to the server. Check your backend URL and connection."
    );
  }

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const body = data as (ApiErrorBody & ApiMessage) | null;

    const message =
      body?.message ||
      body?.error ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

function encodeId(id: string | number): string {
  return encodeURIComponent(String(id));
}

export const ASSET_BASE_URL = USERS_API_URL.replace(/\/users\/?$/, "");

export function resolveAvatarUrl(
  avatar?: string | null
): string | undefined {
  if (!avatar) return undefined;

  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }

  return `${ASSET_BASE_URL}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
}

export function getDuelById(duelId: string) {
  return request<{ success: boolean; duel: unknown }>(
    DUEL_API_URL,
    `/${encodeId(duelId)}`
  );
}

export function registerUser(
  payload: RegisterPayload
): Promise<RegisterResponse> {
  return request<RegisterResponse>(API_URL, "/register", {
    method: "POST",
    body: payload,
  });
}

export function loginUser(
  payload: LoginPayload
): Promise<LoginResponse> {
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
  return request<ProfileResponse>(USERS_API_URL, `/${encodeId(id)}`);
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

export async function uploadAvatar(
  file: File
): Promise<ProfileResponse> {
  const base64Image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read image."));
    };

    reader.readAsDataURL(file);
  });

  return request<ProfileResponse>(USERS_API_URL, "/avatar", {
    method: "POST",
    body: { image: base64Image },
  });
}

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
  return request<SendFriendRequestResponse>(
    FRIENDS_API_URL,
    "/request",
    {
      method: "POST",
      body: { receiverId },
    }
  );
}

export function acceptFriendRequest(
  requestId: string
): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, `/accept/${encodeId(requestId)}`, {
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
  return request(FRIENDS_API_URL, `/${encodeId(friendId)}`, {
    method: "DELETE",
  });
}

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
  const response = await request<{
    success: boolean;
    configurations: GameConfiguration[];
  }>(CONFIG_API_URL, "/");

  if (!response.success || !Array.isArray(response.configurations)) {
    throw new Error("Failed to load game configurations.");
  }

  return response.configurations;
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
  return request<StartGameResponse>(
    CONFIG_API_URL,
    "/start-custom",
    {
      method: "POST",
      body: settings,
    }
  );
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

export function getQuestion(
  sessionId: string
): Promise<QuestionResponse> {
  return request<QuestionResponse>(
    GAME_API_URL,
    `/question/${encodeId(sessionId)}`
  );
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
  return request<LeaderboardResponse>(
    DASHBOARD_API_URL,
    "/leaderboard"
  );
}

/* ------------------------------------------------------------------ */
/* Duels                                                               */
/* ------------------------------------------------------------------ */

export function joinDuel(
  configurationId: string | number,
  customSettings?: CustomSettings | null
): Promise<JoinDuelResponse> {
  const normalizedConfigurationId = String(
    configurationId ?? ""
  ).trim();

  if (!normalizedConfigurationId) {
    return Promise.reject(
      new Error("Please select a game configuration.")
    );
  }

  return request<JoinDuelResponse>(DUEL_API_URL, "/join", {
    method: "POST",
    body: {
      configurationId: normalizedConfigurationId,
      customSettings: customSettings ?? undefined,
    },
  });
}

export function getDuelStatus(): Promise<DuelStatusResponse> {
  return request<DuelStatusResponse>(DUEL_API_URL, "/status");
}

export function getActiveDuel(): Promise<{
  success: boolean;
  duelId: string | number | null;
}> {
  return request(DUEL_API_URL, "/active");
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
  friendId: string | number,
  configurationId: string | number,
  customSettings?: CustomSettings | null
): Promise<ChallengeResponse> {
  const normalizedFriendId = String(friendId ?? "").trim();
  const normalizedConfigurationId = String(
    configurationId ?? ""
  ).trim();

  if (!normalizedFriendId) {
    return Promise.reject(new Error("Please select a friend."));
  }

  if (!normalizedConfigurationId) {
    return Promise.reject(
      new Error("Please select a valid game configuration.")
    );
  }

  return request<ChallengeResponse>(DUEL_API_URL, "/challenge", {
    method: "POST",
    body: {
      friendId: normalizedFriendId,
      configurationId: normalizedConfigurationId,
      customSettings: customSettings ?? undefined,
    },
  });
}

export function getIncomingChallenges(): Promise<IncomingChallengesResponse> {
  return request<IncomingChallengesResponse>(
    DUEL_API_URL,
    "/challenges"
  );
}

export function respondToChallenge(
  challengeId: string,
  accept: boolean
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(
    DUEL_API_URL,
    `/challenges/${encodeId(challengeId)}/respond`,
    {
      method: "POST",
      body: { accept },
    }
  );
}

export function cancelChallenge(
  challengeId: string
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(
    DUEL_API_URL,
    `/${encodeId(challengeId)}`,
    {
      method: "DELETE",
    }
  );
}

export function getDuelQuestion(
  duelId: string
): Promise<DuelQuestionResponse> {
  return request<DuelQuestionResponse>(
    DUEL_API_URL,
    `/question/${encodeId(duelId)}`
  );
}

export function submitDuelAnswer(
  duelId: string,
  answer: number | string,
  question?: string
): Promise<DuelAnswerResponse> {
  const normalizedDuelId = String(duelId ?? "").trim();
  const answerText = String(answer ?? "").trim();
  const numericAnswer = Number(answerText);

  if (!normalizedDuelId) {
    return Promise.reject(new Error("Invalid duel ID."));
  }

  if (answerText === "" || !Number.isFinite(numericAnswer)) {
    return Promise.reject(
      new Error("Enter a valid numeric answer.")
    );
  }

  return request<DuelAnswerResponse>(DUEL_API_URL, "/answer", {
    method: "POST",
    body: {
      duelId: normalizedDuelId,
      answer: numericAnswer,
      question,
    },
  });
}