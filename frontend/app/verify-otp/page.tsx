"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "../../components/Input";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { verifyOtp } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pendingUserId, setUser, setPendingUserId } = useAuth();

  // fall back to the query param in case of a page refresh (context resets)
  const userId = pendingUserId || searchParams.get("userId");

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!userId) {
      setError("Your session expired. Please log in again.");
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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[#070815] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.28),transparent_70%)] px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/40">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M2.5 4A1.5 1.5 0 001 5.5v9A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0017.5 4h-15zm12.5 3.5l-5 3.5-5-3.5" stroke="currentColor" strokeWidth="0" />
            <path d="M3 6l7 5 7-5" />
          </svg>
        </div>
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-[#070815]">
          Verify your identity
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Enter the 6-digit code we sent to your email. It expires in 5 minutes.
        </p>

        <Alert message={error} />

        <form onSubmit={handleSubmit}>
          <Input
            label="OTP Code"
            name="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <Button type="submit" loading={loading}>
            Verify & Log In
          </Button>
        </form>
      </div>
    </div>
  );
}