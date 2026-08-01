"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "../../components/Input";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { loginUser } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import type { LoginPayload } from "../../types/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const { setPendingUserId } = useAuth();

  const [form, setForm] = useState<LoginPayload>({ email: "", password: "" });
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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-gradient-to-b from-indigo-50/40 via-white to-white px-4 py-10">
    <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
      <p className="text-sm text-gray-500 mb-6">Log in to your account</p>

      {justRegistered && (
        <Alert type="success" message="Account created. Please log in." />
      )}
      <Alert message={error} />

      <form onSubmit={handleSubmit}>
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <Button type="submit" loading={loading}>
          Send OTP
        </Button>
      </form>

      <p className="mt-4 text-sm text-gray-500 text-center">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-indigo-600 font-medium hover:underline">
          Register
        </Link>
      </p>
    </div>
    </div>
  );
}