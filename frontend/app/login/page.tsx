"use client";

import {
  useId,
  useState,
  ChangeEvent,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { loginUser } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import type { LoginPayload } from "../../types/auth";

/* Same focus ring as the Navbar */
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

const eyeOn =
  "M2.04 12.32a1 1 0 010-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3.01 9.96 7.18a1 1 0 010 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3.01-9.96-7.18zM15 12a3 3 0 11-6 0 3 3 0 016 0z";
const eyeOff =
  "M3.98 8.22A10.48 10.48 0 001.93 12C3.23 16.34 7.24 19.5 12 19.5c.99 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0112 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 01-4.3 5.77M6.23 6.23L3 3m3.23 3.23l3.65 3.65m7.89 7.89L21 21m-3.23-3.23l-3.65-3.65m0 0a3 3 0 10-4.24-4.24m4.24 4.24L9.88 9.88";

/* ---------- Field (same as the register page) ---------- */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  trailing?: ReactNode;
};

function Field({ label, trailing, ...props }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          className={`block h-11 w-full rounded-lg border border-slate-200 bg-white pl-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 ${
            trailing ? "pr-11" : "pr-3.5"
          }`}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>
        )}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const { setPendingUserId } = useAuth();

  const [form, setForm] = useState<LoginPayload>({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginUser(form);
      setPendingUserId(data.userId);
      router.push(`/verify-otp?userId=${data.userId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-8rem)] bg-white lg:grid-cols-2">
      {/* ---------- Brand panel (desktop) ---------- */}
      <aside className="relative hidden overflow-hidden bg-[#070815] lg:flex lg:flex-col lg:justify-end lg:p-16 xl:p-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_30%,rgba(99,102,241,0.35),transparent_70%)]"
        />

        <svg
          aria-hidden="true"
          viewBox="0 0 400 200"
          fill="none"
          className="pointer-events-none absolute inset-x-0 top-[12%] mx-auto w-[min(30rem,78%)]"
        >
          <defs>
            <linearGradient id="inf" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a5b4fc" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <filter id="blur" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <g transform="translate(200 100) scale(0.78) translate(-200 -100)">
            <path
              d="M200 100C240 40 340 40 340 100C340 160 240 160 200 100C160 40 60 40 60 100C60 160 160 160 200 100Z"
              stroke="url(#inf)"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.55"
              filter="url(#blur)"
            />
            <path
              d="M200 100C240 40 340 40 340 100C340 160 240 160 200 100C160 40 60 40 60 100C60 160 160 160 200 100Z"
              stroke="url(#inf)"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>
        </svg>

        <div className="relative">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Welcome back.
          </h2>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-slate-400">
            Log in to EigenX and pick up where you left off. We&apos;ll send a
            one-time code to confirm it&apos;s you.
          </p>
        </div>
      </aside>

      {/* ---------- Form panel ---------- */}
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Log in to your account
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className={`rounded font-medium text-indigo-600 hover:text-indigo-500 hover:underline ${focusRing}`}
            >
              Register
            </Link>
          </p>

          <div className="mt-8">
            {justRegistered && (
              <Alert type="success" message="Account created. Please log in." />
            )}
            <Alert message={error} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              required
            />
            <Field
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className={`rounded-md p-2 text-slate-400 transition hover:text-slate-600 ${focusRing}`}
                >
                  <svg
                    className="h-[18px] w-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={showPassword ? eyeOff : eyeOn} />
                  </svg>
                </button>
              }
            />

            <Button type="submit" loading={loading}>
              Send OTP
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}