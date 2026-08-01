"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "../types/auth";
import { getProfile } from "../lib/api";

interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  pendingUserId: string | number | null;
  setPendingUserId: (id: string | number | null) => void;
  logoutLocal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // userId returned by /login, needed by the verify-otp step
  const [pendingUserId, setPendingUserId] = useState<string | number | null>(null);

  useEffect(() => {
    // The access token is an httpOnly cookie — JS can't read it directly,
    // so on every fresh load we ask the backend "is this cookie still valid?"
    // This runs once, on mount, before Navbar (or anything else) trusts `user`.
    let cancelled = false;

    const hydrate = async () => {
      try {
        const res = await getProfile();
        if (!cancelled) setUser(res.user as unknown as User);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    user,
    setUser,
    loading,
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