"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../lib/api";

const NAV_LINKS = [
  { href: "/", label: "Home", auth: false },
  { href: "/dashboard", label: "Profile", auth: true },
  { href: "/leaderboard", label: "Leaderboard", auth: true },
  { href: "/duel", label: "Duel", auth: true },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export default function Navbar() {
  const { user, loading, logoutLocal } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = NAV_LINKS.filter((l) => !l.auth || user);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch {
      // ignore: we clear the local session either way
    } finally {
      logoutLocal();
      setLoggingOut(false);
      setMenuOpen(false);
      router.push("/login");
    }
  };

  const linkClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${focusRing} ${
      active
        ? "bg-white/10 text-white ring-1 ring-inset ring-white/10"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  const ghostButton = `rounded-lg bg-white/5 px-3.5 py-1.5 text-sm font-medium text-slate-200 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/10 disabled:opacity-60 ${focusRing}`;

  const primaryButton = `rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_6px_24px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 ${focusRing}`;

  const avatar = (size: string) => (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white ring-2 ring-white/10 ${size}`}
    >
      {user?.username?.[0]?.toUpperCase() || "?"}
    </span>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070815]/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-semibold leading-none text-white shadow-[0_0_18px_rgba(99,102,241,0.55)]">
            Λ
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            EigenX
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={linkClass(isActive(link.href))}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop account area */}
        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-8 w-32 animate-pulse rounded-lg bg-white/10" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 transition-colors hover:bg-white/5 ${focusRing}`}
              >
                {avatar("h-7 w-7 text-xs")}
                <span className="max-w-[140px] truncate text-sm font-medium text-slate-200">
                  {user.username}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className={ghostButton}
              >
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white ${focusRing}`}
              >
                Log in
              </Link>
              <Link href="/register" className={primaryButton}>
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/10 md:hidden ${focusRing}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-[#0b0c1f]/95 px-4 pb-4 pt-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`${linkClass(isActive(link.href))} py-2.5`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            {loading ? null : user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {avatar("h-7 w-7 text-xs")}
                  <span className="truncate text-sm font-medium text-slate-200">
                    {user.username}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={ghostButton}
                >
                  {loggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className={`${ghostButton} flex-1 text-center`}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className={`${primaryButton} flex-1 text-center`}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}