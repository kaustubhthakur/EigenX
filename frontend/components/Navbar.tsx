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

export default function Navbar() {
  const { user, loading, logoutLocal } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = NAV_LINKS.filter((l) => !l.auth || user);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

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
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-slate-100 text-slate-900"
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    }`;

  const ghostButton =
    "rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-lg font-semibold leading-none text-white shadow-sm">
            Λ
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">EigenX</span>
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
            <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-100" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {user.username?.[0]?.toUpperCase() || "?"}
                </span>
                <span className="max-w-[140px] truncate text-sm font-medium text-slate-700">
                  {user.username}
                </span>
              </Link>
              <button onClick={handleLogout} disabled={loggingOut} className={ghostButton}>
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-3 md:hidden">
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

          <div className="mt-3 border-t border-slate-100 pt-3">
            {loading ? null : user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    {user.username?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-700">{user.username}</span>
                </div>
                <button onClick={handleLogout} disabled={loggingOut} className={ghostButton}>
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
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-1.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
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