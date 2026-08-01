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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
      <h1 className="text-xl font-semibold mb-1">Verify your identity</h1>
      <p className="text-sm text-gray-500 mb-6">
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