"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl bg-gradient-to-b from-indigo-50/40 via-white to-white px-4 py-20">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Secure auth, done right.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
          Email + password login backed by one-time-passcode verification,
          so every session is confirmed by the account owner.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

    
    </div>
  );
}