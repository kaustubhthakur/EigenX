"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { User } from "../types/auth";

interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  pendingUserId: string | number | null;
  setPendingUserId: (id: string | number | null) => void;
  logoutLocal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // userId returned by /login, needed by the verify-otp step
  const [pendingUserId, setPendingUserId] = useState<string | number | null>(null);

  const value: AuthContextValue = {
    user,
    setUser,
    pendingUserId,
    setPendingUserId,
    logoutLocal: () => {
      setUser(null);
      setPendingUserId(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}