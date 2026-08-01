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
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Edit profile
          </button>
        )}
      </div>

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
          {success}
        </div>
      )}
      {formError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {formError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-br from-indigo-600 to-indigo-400" />

        <div className="-mt-12 px-6 pb-6">
          <AvatarUpload
            currentAvatar={profile.avatar}
            username={profile.username}
            onUploaded={applyUserUpdate}
          />

          <div className="mt-4 text-center">
            {editing ? (
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-base font-semibold text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Username"
              />
            ) : (
              <p className="text-lg font-semibold text-gray-900">{profile.username}</p>
            )}
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 py-3 text-center">
              <p className="text-lg font-bold text-indigo-600">{profile.level}</p>
              <p className="text-xs text-gray-500">Level</p>
            </div>
            <div className="rounded-xl bg-gray-50 py-3 text-center">
              <p className="text-lg font-bold text-indigo-600">{profile.xp}</p>
              <p className="text-xs text-gray-500">XP</p>
            </div>
            <div className="rounded-xl bg-gray-50 py-3 text-center">
              <p className="text-lg font-bold text-indigo-600">{profile.score ?? 0}</p>
              <p className="text-xs text-gray-500">Score</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Level {profile.level}</span>
              <span>
                {xpIntoLevel} / {XP_PER_LEVEL} XP
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all"
                style={{ width: `${xpProgressPct}%` }}
              />
            </div>
          </div>

          {editing && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
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
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
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
  );
}