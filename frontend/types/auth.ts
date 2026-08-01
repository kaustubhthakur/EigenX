export interface User {
  id: number | string;
  username: string;
  email: string;
  isadmin?: boolean;
  [key: string]: unknown;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  userId: number | string;
}

export interface VerifyOtpPayload {
  userId: number | string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface ApiErrorBody {
  error: string;
}