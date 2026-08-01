import type {
  ApiErrorBody,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from "../types/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/auth";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include", // required so the httpOnly access_token cookie is sent/stored
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    const message = (data as ApiErrorBody | null)?.error || "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return data as T;
}

// POST /register -> { username, email, password }
export function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  return request<RegisterResponse>("/register", { method: "POST", body: payload });
}

// POST /login -> { email, password } => triggers OTP email, returns { userId }
export function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  return request<LoginResponse>("/login", { method: "POST", body: payload });
}

// POST /verifyOtp -> { userId, otp } => sets access_token cookie, returns user + token
export function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  return request<VerifyOtpResponse>("/verifyOtp", { method: "POST", body: payload });
}

// POST /logout -> clears access_token cookie
export function logoutUser(): Promise<{ message: string }> {
  return request<{ message: string }>("/logout", { method: "POST" });
}