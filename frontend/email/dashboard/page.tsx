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
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
      <h1 className="text-xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">You are logged in.</p>

      <Alert message={error} />

      {user ? (
        <div className="mb-6 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
          <p><span className="font-medium">Username:</span> {user.username}</p>
          <p><span className="font-medium">Email:</span> {user.email}</p>
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
  );
}