"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../lib/api";

export default function Navbar() {
  const { user, loading, logoutLocal } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch {
    } finally {
      logoutLocal();
      setLoggingOut(false);
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-400 text-sm font-bold text-white shadow-sm">
            X
          </span>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            EigenX
          </span>
        </Link>

        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            Home
          </Link>

          {loading ? (

            <div className="ml-1 flex items-center gap-2">
              <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-8 w-16 animate-pulse rounded-lg bg-gray-100" />
            </div>
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-1.5 font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                Profile
              </Link>

              <Link
                href="/dashboard"
                className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-100"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {user.username?.[0]?.toUpperCase() || "?"}
                </span>
                <span className="hidden font-medium text-gray-900 sm:inline">
                  {user.username}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="ml-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="ml-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}