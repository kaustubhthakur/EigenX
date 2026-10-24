"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Input from "../../components/Input";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { registerUser } from "../../lib/api";
import type { RegisterPayload } from "../../types/auth";

/* Same focus ring as the Navbar */
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[#070815] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.28),transparent_70%)] px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/40">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 15a4 4 0 018 0v1H6v-1z" />
          </svg>
        </div>
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-[#070815]">
          Create an account
        </h1>
        <p className="mb-6 text-sm text-slate-500">Sign up to get started</p>

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

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className={`rounded font-medium text-indigo-600 hover:text-indigo-500 hover:underline ${focusRing}`}
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}