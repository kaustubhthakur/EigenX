"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../lib/api";

const NAV_LINKS = [
  { href: "/", label: "Home", auth: false },
  { href: "/dashboard", label: "Profile", auth: true },
  { href: "/leaderboard", label: "Leaderboard", auth: true },
  { href: "/duel", label: "Duel", auth: true },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

export default function Navbar() {
  const { user, loading, logoutLocal } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const links = NAV_LINKS.filter((l) => !l.auth || user);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  /* Border and background firm up once the page scrolls */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close menus on navigation */
  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  /* Close the account menu on outside click or Escape */
  useEffect(() => {
    if (!userMenuOpen && !menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen, menuOpen]);

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
      setUserMenuOpen(false);
      router.push("/login");
    }
  };

  const initial = user?.username?.[0]?.toUpperCase() || "?";

  const avatar = (size: string) => (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/40 ${size}`}
    >
      {initial}
    </span>
  );

  const secondaryButton = `inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white ${focusRing}`;

  const primaryButton = `inline-flex h-9 items-center justify-center rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10 transition-colors hover:bg-indigo-400 ${focusRing}`;

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur-xl transition-colors duration-200 ${
        scrolled
          ? "border-white/10 bg-[#070815]/85"
          : "border-white/[0.06] bg-[#070815]/55"
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6"
      >
        {/* Brand + desktop links */}
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}
          >
            

  <Image
    src="/logo.png"
    alt="EigenX logo"
    width={32}
    height={32}
    priority
    className="h-8 w-8 rounded-lg object-contain"
  />
 

            <span className="text-[15px] font-semibold tracking-tight text-white">
              EigenX
            </span>
          </Link>

          <div className="hidden items-center md:flex">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-16 items-center px-3.5 text-sm font-medium transition-colors ${focusRing} ${
                    active ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3.5 bottom-0 h-0.5 rounded-full bg-indigo-400"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Desktop account area */}
        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
          ) : user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-white/5 ${focusRing}`}
              >
                {avatar("h-8 w-8 text-sm")}
                <span className="max-w-[120px] truncate text-sm font-medium text-slate-200">
                  {user.username}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`text-slate-500 transition-transform ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0d0e24]/95 p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                >
                  <div className="px-3 py-2">
                    <p className="text-xs text-slate-500">Signed in as</p>
                    <p className="truncate text-sm font-medium text-white">
                      {user.username}
                    </p>
                  </div>
                  <div className="my-1 h-px bg-white/10" />
                  <Link
                    href="/dashboard"
                    role="menuitem"
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white ${focusRing}`}
                  >
                    Your profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60 ${focusRing}`}
                  >
                    {loggingOut ? "Logging out…" : "Log out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className={secondaryButton}>
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
          aria-controls="mobile-menu"
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/5 hover:text-white md:hidden ${focusRing}`}
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
        <div
          id="mobile-menu"
          className="border-t border-white/10 bg-[#0a0b1e]/95 px-4 pb-5 pt-3 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-3 text-[15px] font-medium transition-colors ${focusRing} ${
                    active
                      ? "bg-white/[0.06] text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-indigo-400"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-3 border-t border-white/10 pt-4">
            {loading ? null : user ? (
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex min-w-0 items-center gap-2.5">
                  {avatar("h-9 w-9 text-sm")}
                  <span className="truncate text-sm font-medium text-slate-200">
                    {user.username}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={`inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-slate-200 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/5 disabled:opacity-60 ${focusRing}`}
                >
                  {loggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  className={`${secondaryButton} h-10 ring-1 ring-inset ring-white/15`}
                >
                  Log in
                </Link>
                <Link href="/register" className={`${primaryButton} h-10`}>
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