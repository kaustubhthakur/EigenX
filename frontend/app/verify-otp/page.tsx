"use client";

import {
  useRef,
  useState,
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { verifyOtp } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

/* Same focus ring as the Navbar */
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

const OTP_LENGTH = 6;

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pendingUserId, setUser, setPendingUserId } = useAuth();

  // fall back to the query param in case of a page refresh (context resets)
  const userId = pendingUserId || searchParams.get("userId");

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (i: number) =>
    boxes.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus();

  /* Fill boxes from a given index (used for typing, paste and autofill) */
  const fillFrom = (start: number, value: string) => {
    const next = [...digits];
    value
      .split("")
      .slice(0, OTP_LENGTH - start)
      .forEach((ch, k) => {
        next[start + k] = ch;
      });
    setDigits(next);
    focusBox(start + value.length);
  };

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (!value) {
      const next = [...digits];
      next[i] = "";
      setDigits(next);
      return;
    }
    fillFrom(i, value);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      focusBox(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    fillFrom(text.length >= OTP_LENGTH ? 0 : i, text);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!userId) {
      setError("Your session expired. Please log in again.");
      return;
    }

    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }

    setLoading(true);
    try {
      const data = await verifyOtp({ userId, otp });
      setUser(data.user);
      setPendingUserId(null);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
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
            Check your email.
          </h2>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-slate-400">
            We sent a one-time code to confirm it&apos;s really you. It only
            takes a moment.
          </p>
        </div>
      </aside>

      {/* ---------- Form panel ---------- */}
      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Verify your identity
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Enter the {OTP_LENGTH}-digit code we sent to your email. It expires
            in 5 minutes.
          </p>

          <div className="mt-8">
            <Alert message={error} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div
              role="group"
              aria-label={`${OTP_LENGTH}-digit verification code`}
              className="grid grid-cols-6 gap-2 sm:gap-3"
            >
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${i + 1}`}
                  value={digit}
                  autoFocus={i === 0}
                  onChange={(e) => handleChange(i, e)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={(e) => handlePaste(i, e)}
                  onFocus={(e) => e.target.select()}
                  className="h-14 w-full rounded-lg border border-slate-200 bg-white text-center text-xl font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
              ))}
            </div>

            <Button type="submit" loading={loading}>
              Verify &amp; Log In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Wrong account?{" "}
            <Link
              href="/login"
              className={`rounded font-medium text-indigo-600 hover:text-indigo-500 hover:underline ${focusRing}`}
            >
              Back to log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}