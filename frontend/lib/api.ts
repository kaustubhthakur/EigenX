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
   
  }

  if (!res.ok) {
    const body = data as (ApiErrorBody & { message?: string }) | null;
    const message = body?.error || body?.message || "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return data as T;
}


export const ASSET_BASE_URL = USERS_API_URL.replace(/\/users$/, "");

export function resolveAvatarUrl(avatar?: string | null): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar;
  return `${ASSET_BASE_URL}${avatar}`;
}
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


export function getProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/Profile");
}


export function getUserById(id: string): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, `/${id}`);
}


export function getAllUsers(): Promise<{ success: boolean; count: number; users: UserProfile[] }> {
  return request(USERS_API_URL, "/");
}


export function updateProfile(payload: { username?: string; avatar?: string }): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/profile", { method: "PUT", body: payload });
}


export function updateScore(payload: UpdateScorePayload): Promise<ProfileResponse> {
  return request<ProfileResponse>(USERS_API_URL, "/score", { method: "PUT", body: payload });
}


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


export function sendFriendRequest(receiverId: string): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, "/request", { method: "POST", body: { receiverId } });
}


export function acceptFriendRequest(requestId: string): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, `/accept/${requestId}`, { method: "PUT" });
}


export function getFriends(): Promise<FriendsResponse> {
  return request(FRIENDS_API_URL, "/");
}


export function getPendingRequests(): Promise<PendingRequestsResponse> {
  return request(FRIENDS_API_URL, "/requests");
}


export function removeFriend(friendId: string): Promise<{ success: boolean; message: string }> {
  return request(FRIENDS_API_URL, `/${friendId}`, { method: "DELETE" });
}