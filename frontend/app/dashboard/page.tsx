"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getProfile, updateProfile } from "../../lib/api";
import type { UserProfile } from "../../types/user";
import AvatarUpload from "../../components/AvatarUpload";
import FriendsPanel from "../../components/FriendsPanel";
import DuelScene from "../../components/DuelScene";

const XP_PER_LEVEL = 500;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const card =
  "rounded-2xl bg-slate-900/70 ring-1 ring-white/10 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]";

const primaryButton = `bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 disabled:opacity-60 ${focusRing}`;

const ghostButton = `bg-white/5 text-slate-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 disabled:opacity-60 ${focusRing}`;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#070815] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_20%,rgba(99,102,241,0.18),transparent)]"
      />
      <DuelScene focus="center" calm />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Shell>
      <div className="mx-auto max-w-2xl animate-pulse px-4 py-10 sm:px-6" aria-busy="true">
        <div className="mb-6 h-8 w-40 rounded bg-white/10" />
        <div className={`${card} p-6`}>
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-white/10" />
              <div className="h-3 w-44 rounded bg-white/10" />
            </div>
          </div>
          <div className="mt-6 h-16 rounded-xl bg-white/5" />
        </div>
      </div>
    </Shell>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{label}</p>
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
      <Shell>
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="mb-4 text-sm font-medium text-red-300">
            {loadError || "Unable to load your profile."}
          </p>
          <button
            onClick={loadProfile}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${primaryButton}`}
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const xpIntoLevel = profile.xp % XP_PER_LEVEL;
  const xpProgressPct = Math.min(100, Math.round((xpIntoLevel / XP_PER_LEVEL) * 100));

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Profile</h1>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${ghostButton}`}
            >
              Edit profile
            </button>
          )}
        </div>

        {success && (
          <div
            role="status"
            className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-200 ring-1 ring-emerald-400/30"
          >
            {success}
          </div>
        )}
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 ring-1 ring-red-400/30"
          >
            {formError}
          </div>
        )}

        <section className={card} aria-label="Your profile">
          {/* Identity */}
          <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <AvatarUpload
                currentAvatar={profile.avatar}
                username={profile.username}
                onUploaded={applyUserUpdate}
              />
            </div>

            <div className="min-w-0 flex-1 text-center sm:pt-2 sm:text-left">
              {editing ? (
                <>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    aria-label="Username"
                    placeholder="Username"
                    className="w-full rounded-lg border-0 bg-white/5 px-3 py-2 text-base font-semibold text-white ring-1 ring-inset ring-white/15 placeholder:text-slate-500 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${primaryButton}`}
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
                      className={`rounded-lg px-4 py-2 text-sm font-medium ${ghostButton}`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <p className="truncate text-xl font-semibold text-white">{profile.username}</p>
                  <span className="rounded-full bg-indigo-400/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-300/30">
                    Level {profile.level}
                  </span>
                </div>
              )}
              {!editing && (
                <p className="mt-1 truncate text-sm text-slate-400">{profile.email}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
            <Stat value={profile.level} label="Level" />
            <Stat value={profile.xp} label="Total XP" />
            <Stat value={profile.top_score ?? 0} label="Highest score" />
          </div>

          {/* Progress */}
          <div className="border-t border-white/10 p-6">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">
                Progress to level {profile.level + 1}
              </span>
              <span className="tabular-nums text-slate-400">
                {xpIntoLevel} / {XP_PER_LEVEL} XP
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={xpProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="XP progress to next level"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300 transition-all duration-500"
                style={{ width: `${xpProgressPct}%` }}
              />
            </div>
          </div>
        </section>

        <div className="mt-6">
          <FriendsPanel currentUserId={profile.id} />
        </div>
      </div>
    </Shell>
  );
}