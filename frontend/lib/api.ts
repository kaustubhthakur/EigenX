import type {
  ApiErrorBody,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from "../types/auth";
import type { UserProfile, ProfileResponse, UpdateScorePayload } from "../types/user";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/auth";
const USERS_API_URL = process.env.NEXT_PUBLIC_USERS_API_URL || "http://localhost:8081/users";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

// generalized to accept a base, so it works for both /auth and /users routers
async function request<T>(base: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    const body = data as (ApiErrorBody & { message?: string }) | null;
    const message = body?.error || body?.message || "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return data as T;
}

// ----- auth (unchanged behavior, now routed through the generalized request) -----

export function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  return request<RegisterResponse>(API_URL, "/register", { method: "POST", body: payload });
}

export function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  return request<LoginResponse>(API_URL, "/login", { method: "POST", body: payload });
}

export function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  return request<VerifyOtpResponse>(API_URL, "/verifyOtp", { method: "POST", body: payload });
}

export function logoutUser(): Promise<{ message: string }> {
  return request<{ message: string }>(API_URL, "/logout", { method: "POST" });
}

// ----- users -----

// GET /users/Profile -> current authenticated user (via cookie)
export function getProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/Profile");
}

// GET /users/:id -> public profile lookup
export function getUserById(id: string): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, `/${id}`);
}

// GET /users -> leaderboard / all users
export function getAllUsers(): Promise<{ success: boolean; count: number; users: UserProfile[] }> {
  return request(USERS_API_URL, "/");
}

// PUT /users/profile -> update username/avatar
export function updateProfile(payload: { username?: string; avatar?: string }): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/profile", { method: "PUT", body: payload });
}

// PUT /users/score -> update score/xp
export function updateScore(payload: UpdateScorePayload): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/score", { method: "PUT", body: payload });
}