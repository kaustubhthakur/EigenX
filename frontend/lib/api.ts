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
import type { FriendsResponse, PendingRequestsResponse } from "../types/friend";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/auth";
const USERS_API_URL = process.env.NEXT_PUBLIC_USERS_API_URL || "http://localhost:8081/users";
const FRIENDS_API_URL = process.env.NEXT_PUBLIC_FRIENDS_API_URL || "http://localhost:8081/friends";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

// generalized to accept a base, so it works for /auth, /users, and /friends routers
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

// ----- auth -----

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

// POST /users/avatar -> upload avatar image (multipart, bypasses the JSON `request` helper
// on purpose: setting Content-Type manually here would break the multipart boundary)
export function uploadAvatar(file: File): Promise<ProfileResponse> {
  const formData = new FormData();
  formData.append("avatar", file);

  return fetch(`${USERS_API_URL}/avatar`, {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then(async (res) => {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // no JSON body
    }
    if (!res.ok) {
      const body = data as (ApiErrorBody & { message?: string }) | null;
      throw new Error(body?.error || body?.message || "Failed to upload avatar");
    }
    return data as ProfileResponse;
  });
}

// ----- friends -----

// POST /friends/request -> send a friend request
export function sendFriendRequest(receiverId: string): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, "/request", { method: "POST", body: { receiverId } });
}

// PUT /friends/accept/:requestId -> accept a pending request
export function acceptFriendRequest(requestId: string): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, `/accept/${requestId}`, { method: "PUT" });
}

// GET /friends -> current user's friends list
export function getFriends(): Promise<FriendsResponse> {
  return request(FRIENDS_API_URL, "/");
}

// GET /friends/requests -> pending incoming requests
export function getPendingRequests(): Promise<PendingRequestsResponse> {
  return request(FRIENDS_API_URL, "/requests");
}

// DELETE /friends/:friendId -> remove a friend (or cancel by unfriending)
export function removeFriend(friendId: string): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, `/${friendId}`, { method: "DELETE" });
}