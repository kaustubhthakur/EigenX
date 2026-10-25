"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getProfile, updateProfile } from "../../lib/api";
import type { UserProfile } from "../../types/user";
import AvatarUpload from "../../components/AvatarUpload";
import FriendsPanel from "../../components/FriendsPanel";

const XP_PER_LEVEL = 500;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";

const card =
  "rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none";

const primaryButton = `bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

const secondaryButton = `border border-slate-300 bg-transparent text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 ${focusRing}`;

const divider = "border-slate-200 dark:border-slate-800";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-12">
        {children}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Shell>
      <div className="animate-pulse motion-reduce:animate-none" aria-busy="true">
        <div className="h-7 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-4 w-64 rounded bg-slate-200/70 dark:bg-slate-800/70" />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className={`${card} h-64`} />
            <div className={`${card} h-48`} />
          </div>
          <div className="space-y-6">
            <div className={`${card} h-40`} />
            <div className={`${card} h-32`} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="px-4 py-4">
      <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{label}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 py-4 sm:grid-cols-3 sm:items-center sm:gap-4">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-600 dark:text-slate-400"
      >
        {label}
      </label>
      <div className="min-w-0 text-sm text-slate-900 dark:text-slate-100 sm:col-span-2">
        {children}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleCancel = () => {
    if (!profile) return;
    setEditing(false);
    setUsername(profile.username);
    setFormError(null);
  };

  if (loading) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <Shell>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
          <p className="mb-4 text-sm font-medium text-red-700 dark:text-red-300">
            {loadError || "Unable to load your profile."}
          </p>
          <button
            onClick={loadProfile}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${primaryButton}`}
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const xpIntoLevel = profile.xp % XP_PER_LEVEL;
  const xpRemaining = XP_PER_LEVEL - xpIntoLevel;
  const xpProgressPct = Math.min(100, Math.round((xpIntoLevel / XP_PER_LEVEL) * 100));

  return (
    <Shell>
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your account details and track your progress.
        </p>
      </header>

      {(success || formError) && (
        <div className="mt-6">
          {success && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
            >
              {success}
            </div>
          )}
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            >
              {formError}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* ----------------------------- Main column ----------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          <section className={card} aria-labelledby="account-heading">
            <div
              className={`flex items-center justify-between border-b px-6 py-4 ${divider}`}
            >
              <div>
                <h2
                  id="account-heading"
                  className="text-base font-semibold text-slate-900 dark:text-white"
                >
                  Account
                </h2>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                  Your public profile information.
                </p>
              </div>

              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${secondaryButton}`}
                >
                  Edit
                </button>
              )}
            </div>

            <div className="px-6">
              <div className={`flex items-center gap-5 border-b py-5 ${divider}`}>
                <AvatarUpload
                  currentAvatar={profile.avatar}
                  username={profile.username}
                  onUploaded={applyUserUpdate}
                />
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                <Field label="Username" htmlFor="username">
                  {editing ? (
                    <input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      autoComplete="username"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/30"
                    />
                  ) : (
                    <span className="truncate font-medium">{profile.username}</span>
                  )}
                </Field>

                <Field label="Email">
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {profile.email}
                  </span>
                </Field>

                <Field label="Level">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                    Level {profile.level}
                  </span>
                </Field>
              </div>
            </div>

            {editing && (
              <div
                className={`flex justify-end gap-2 border-t bg-slate-50 px-6 py-4 dark:bg-slate-900/60 ${divider}`}
              >
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${secondaryButton}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${primaryButton}`}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            )}
          </section>

          <FriendsPanel currentUserId={profile.id} />
        </div>

        {/* ------------------------------ Sidebar ------------------------------ */}
        <aside className="space-y-6 self-start">
          <section className={card} aria-label="Statistics">
            <div className={`border-b px-6 py-4 ${divider}`}>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Statistics
              </h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-200 px-2 dark:divide-slate-800 lg:grid-cols-1 lg:divide-x-0 lg:divide-y lg:px-0">
              <Stat value={profile.level} label="Level" />
              <Stat value={profile.xp} label="Total XP" />
              <Stat value={profile.top_score ?? 0} label="Highest score" />
            </div>
          </section>

          <section className={`${card} p-6`} aria-label="Level progress">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Level progress
              </h2>
              <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                {xpProgressPct}%
              </span>
            </div>

            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
              role="progressbar"
              aria-valuenow={xpProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="XP progress to next level"
            >
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${xpProgressPct}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="tabular-nums">
                {xpIntoLevel} / {XP_PER_LEVEL} XP
              </span>
              <span>
                {xpRemaining} XP to level {profile.level + 1}
              </span>
            </div>
          </section>
        </aside>
      </div>
    </Shell>
  );
}