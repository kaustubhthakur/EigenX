"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getProfile, updateProfile } from "../../lib/api";
import type { UserProfile } from "../../types/user";
import AvatarUpload from "../../components/AvatarUpload";
import FriendsPanel from "../../components/FriendsPanel";

const XP_PER_LEVEL = 500;

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-10 sm:px-6">
      <div className="mb-6 h-7 w-40 rounded bg-gray-200" />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="h-24 w-24 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-3 w-40 rounded bg-gray-200" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatIcon({ type }: { type: "level" | "xp" | "score" }) {
  const common = "h-4 w-4";
  if (type === "level") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common}>
        <path d="M12 3 2 8l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M2 13l10 5 10-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "xp") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common}>
        <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={common}>
      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 13.5 5 22l7-3 7 3-2-8.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { setUser: setAuthUser } = useAuth() as {
    setUser?: (u: UserProfile) => void;
  };

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getProfile();
      setProfile(res.user);
      setUsername(res.user.username);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load profile";
      setLoadError(message);
      if (message.toLowerCase().includes("unauthor") || message.toLowerCase().includes("token")) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const applyUserUpdate = (u: UserProfile) => {
    setProfile(u);
    setAuthUser?.(u);
  };

  const handleSave = async () => {
    if (!username.trim()) {
      setFormError("Username can't be empty");
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccess(null);
    try {
      const res = await updateProfile({ username: username.trim() });
      applyUserUpdate(res.user);
      setSuccess("Profile updated");
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  if (loading) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="mb-4 text-sm font-medium text-red-600">
          {loadError || "Unable to load your profile."}
        </p>
        <button
          onClick={loadProfile}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const xpIntoLevel = profile.xp % XP_PER_LEVEL;
  const xpProgressPct = Math.min(100, Math.round((xpIntoLevel / XP_PER_LEVEL) * 100));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
         
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="m16.5 3.5 4 4L9 19l-5 1 1-5L16.5 3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              Edit profile
            </button>
          )}
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0">
              <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {success}
          </div>
        )}
        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {formError}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(79,70,229,0.15)]">
          <div className="relative h-24 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500">
            <div
              className="absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "16px 16px",
              }}
              aria-hidden="true"
            />
          </div>

          <div className="-mt-14 px-6 pb-6">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-white p-1 shadow-md">
                <AvatarUpload
                  currentAvatar={profile.avatar}
                  username={profile.username}
                  onUploaded={applyUserUpdate}
                />
              </div>
            </div>

            <div className="mt-4 text-center">
              {editing ? (
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-base font-semibold text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Username"
                />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <p className="text-lg font-bold text-gray-900">{profile.username}</p>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                    LVL {profile.level}
                  </span>
                </div>
              )}
              <p className="mt-0.5 text-sm text-gray-500">{profile.email}</p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 py-4 text-center transition hover:border-indigo-100 hover:bg-indigo-50/50">
                <div className="mb-1 flex items-center justify-center text-indigo-500">
                  <StatIcon type="level" />
                </div>
                <p className="text-lg font-bold text-gray-900">{profile.level}</p>
                <p className="text-xs text-gray-500">Level</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 py-4 text-center transition hover:border-indigo-100 hover:bg-indigo-50/50">
                <div className="mb-1 flex items-center justify-center text-indigo-500">
                  <StatIcon type="xp" />
                </div>
                <p className="text-lg font-bold text-gray-900">{profile.xp}</p>
                <p className="text-xs text-gray-500">XP</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 py-4 text-center transition hover:border-indigo-100 hover:bg-indigo-50/50">
                <div className="mb-1 flex items-center justify-center text-indigo-500">
                  <StatIcon type="score" />
                </div>
                <p className="text-lg font-bold text-gray-900">{profile.top_score ?? 0}</p>
                <p className="text-xs text-gray-500">Highest Score</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">Level {profile.level} progress</span>
                <span className="font-medium text-gray-500">
                  {xpIntoLevel} / {XP_PER_LEVEL} XP
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 shadow-[0_0_8px_rgba(79,70,229,0.5)] transition-all duration-500"
                  style={{ width: `${xpProgressPct}%` }}
                />
              </div>
            </div>

            {editing && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setUsername(profile.username);
                    setFormError(null);
                  }}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <FriendsPanel currentUserId={profile.id} />
        </div>
      </div>
    </div>
  );
}