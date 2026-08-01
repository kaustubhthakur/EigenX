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
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
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
  );
}