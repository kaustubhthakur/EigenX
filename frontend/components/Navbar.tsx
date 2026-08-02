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
    <header className="sticky top-0 z-10 border-b border-[#22242E] bg-[#0B0C10]/85 backdrop-blur-xl">
    
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)",
        }}
        aria-hidden="true"
      />
     
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#5B5FEF]/60 to-transparent" />

      <nav className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
       
  <span className="flex items-center -ml-32">
  <img
  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQlh7i8SenqRDQg0JUIWBqeLTMJyn5EXZChG3wv8nqHbg&s=10"
  alt="Lambda"
  className="h-12 w-16 rounded-2xl object-contain"
/>
 
</span>
        </Link>

        <div className={`${mono.className} flex items-center gap-1 text-xs sm:gap-1.5`}>
          <Link
            href="/"
            className={`rounded-md px-3 py-1.5 font-medium uppercase tracking-widest transition ${
              pathname === "/"
                ? "text-[#F4F4F6]"
                : "text-[#8B8D9A] hover:text-[#F4F4F6]"
            }`}
          >
            Home
          </Link>

          {loading ? (
            <div className="ml-1 flex items-center gap-2">
              <div className="h-8 w-20 animate-pulse rounded-md bg-[#181920]" />
              <div className="h-8 w-16 animate-pulse rounded-md bg-[#181920]" />
            </div>
          ) : user ? (
            <>
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative rounded-md px-3 py-1.5 font-medium uppercase tracking-widest transition ${
                      active ? "text-[#F4F4F6]" : "text-[#8B8D9A] hover:text-[#F4F4F6]"
                    }`}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-[#5B5FEF] shadow-[0_0_8px_rgba(91,95,239,0.8)]" />
                    )}
                  </Link>
                );
              })}

              <Link
                href="/dashboard"
                className="ml-1.5 flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition hover:border-[#22242E] hover:bg-[#14151B]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#5B5FEF]/50 bg-[#14151B] text-xs font-bold text-[#8A8EE0]">
                  {user.username?.[0]?.toUpperCase() || "?"}
                </span>
                <span className="hidden font-medium normal-case tracking-normal text-[#F4F4F6] sm:inline">
                  {user.username}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="ml-1 rounded-md border border-[#5B5FEF] bg-[#5B5FEF]/10 px-3.5 py-1.5 font-bold uppercase tracking-widest text-[#8A8EE0] shadow-[0_0_0_rgba(91,95,239,0)] transition hover:bg-[#5B5FEF] hover:text-white hover:shadow-[0_0_16px_rgba(91,95,239,0.5)] disabled:opacity-60"
              >
                {loggingOut ? "..." : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 font-medium uppercase tracking-widest text-[#8B8D9A] transition hover:text-[#F4F4F6]"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="ml-1 rounded-md border border-[#5B5FEF] bg-[#5B5FEF] px-3.5 py-1.5 font-bold uppercase tracking-widest text-white shadow-[0_0_14px_rgba(91,95,239,0.4)] transition hover:bg-[#4B4FD9] hover:shadow-[0_0_20px_rgba(91,95,239,0.6)]"
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