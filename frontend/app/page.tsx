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

      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Password hashing</h3>
          <p className="mt-2 text-sm text-gray-600">
            Passwords are hashed with bcrypt before they ever touch the database.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Email OTP</h3>
          <p className="mt-2 text-sm text-gray-600">
            A 6-digit code, valid for 5 minutes, confirms every login attempt.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">HttpOnly sessions</h3>
          <p className="mt-2 text-sm text-gray-600">
            Sessions are stored in an httpOnly, sameSite cookie — never exposed to JS.
          </p>
        </div>
      </section>
    </div>
  );
}