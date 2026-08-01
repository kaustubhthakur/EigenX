"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { logoutUser } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logoutLocal } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setError("");
    setLoading(true);
    try {
      await logoutUser();
      logoutLocal();
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-gradient-to-b from-indigo-50/40 via-white to-white px-4 py-10">
    <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM13 10a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">You are logged in.</p>

      <Alert message={error} />

      {user ? (
        <div className="mb-6 space-y-1 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm">
          <p className="flex justify-between"><span className="text-gray-500">Username</span><span className="font-medium text-gray-900">{user.username}</span></p>
          <p className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium text-gray-900">{user.email}</span></p>
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-400">
          (No user in memory — likely refreshed. Cookie session may still be valid.)
        </p>
      )}

      <Button onClick={handleLogout} loading={loading}>
        Log out
      </Button>
    </div>
    </div>
  );
}