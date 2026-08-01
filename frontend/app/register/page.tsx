"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Input from "../../components/Input";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { registerUser } from "../../lib/api";
import type { RegisterPayload } from "../../types/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterPayload>({
    username: "",
    email: "",
    password: "",
  });
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
      await registerUser(form);
      router.push("/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-gradient-to-b from-indigo-50/40 via-white to-white px-4 py-10">
    <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 15a4 4 0 018 0v1H6v-1z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold mb-1">Create an account</h1>
      <p className="text-sm text-gray-500 mb-6">Sign up to get started</p>

      <Alert message={error} />

      <form onSubmit={handleSubmit}>
        <Input
          label="Username"
          name="username"
          type="text"
          value={form.username}
          onChange={handleChange}
          required
        />
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
          minLength={6}
        />
        <Button type="submit" loading={loading}>
          Register
        </Button>
      </form>

      <p className="mt-4 text-sm text-gray-500 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
    </div>
  );
}