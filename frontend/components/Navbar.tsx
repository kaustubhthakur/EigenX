"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../lib/api";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["700"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });

const NAV_LINKS = [
  { href: "/dashboard", label: "Profile" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/duel", label: "Duel" },
];

export default function Navbar() {
  const { user, loading, logoutLocal } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
    <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <nav className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo + wordmark */}
        <Link href="/" className="group flex items-center gap-2.5">
           <img
  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQlh7i8SenqRDQg0JUIWBqeLTMJyn5EXZChG3wv8nqHbg&s=10"
  alt="Lambda"
  className="h-16 w-16 rounded-2xl object-contain"
/>
          <span className={`${display.className} hidden text-[15px] tracking-tight text-gray-900 sm:inline`}>
            EigenX
          </span>
        </Link>

        {/* Nav links */}
        <div className={`${mono.className} flex items-center gap-0.5 text-[11px] sm:gap-1`}>
          <Link
            href="/"
            className={`rounded-lg px-3 py-2 font-semibold uppercase tracking-wider transition ${
              pathname === "/"
                ? "text-gray-900"
                : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            Home
          </Link>

          {loading ? (
            <div className="ml-2 flex items-center gap-2">
              <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-8 w-16 animate-pulse rounded-lg bg-gray-100" />
            </div>
          ) : user ? (
            <>
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative rounded-lg px-3 py-2 font-semibold uppercase tracking-wider transition ${
                      active
                        ? "text-gray-900"
                        : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-[11px] h-[2.5px] rounded-full bg-[#4F46E5]" />
                    )}
                  </Link>
                );
              })}

              <div className="mx-2 h-6 w-px bg-gray-200" />

              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4F46E5] text-[11px] font-bold text-white shadow-sm">
                  {user.username?.[0]?.toUpperCase() || "?"}
                </span>
                <span className="hidden font-medium normal-case tracking-normal text-gray-700 sm:inline">
                  {user.username}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="ml-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 font-semibold uppercase tracking-wider text-gray-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
              >
                {loggingOut ? "..." : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 font-semibold uppercase tracking-wider text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="ml-1 rounded-lg bg-[#4F46E5] px-4 py-2 font-semibold uppercase tracking-wider text-white shadow-[0_1px_2px_rgba(79,70,229,0.3)] transition hover:bg-[#4338CA] hover:shadow-[0_2px_8px_rgba(79,70,229,0.35)]"
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