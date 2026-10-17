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

const glass =
  "rounded-2xl bg-slate-900/60 ring-1 ring-white/10 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]";

const primaryButton = `bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 disabled:opacity-60 ${focusRing}`;

const ghostButton = `bg-white/5 text-slate-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 disabled:opacity-60 ${focusRing}`;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#070815] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_25%,rgba(99,102,241,0.22),transparent),radial-gradient(40%_35%_at_90%_95%,rgba(34,211,238,0.12),transparent)]"
      />
      <DuelScene focus="center" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Shell>
      <div
        className="mx-auto max-w-2xl animate-pulse px-4 py-10 sm:px-6"
        aria-busy="true"
      >
        <div className="mb-6 h-8 w-40 rounded bg-white/10" />
        <div className={`${glass} p-6`}>
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="h-24 w-24 rounded-full bg-white/10" />
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="h-3 w-40 rounded bg-white/10" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function StatIcon({ type }: { type: "level" | "xp" | "score" }) {
  const common = "h-4 w-4";
  if (type === "level") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path d="M12 3 2 8l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M2 13l10 5 10-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "xp") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
        <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 13.5 5 22l7-3 7 3-2-8.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({
  type,
  value,
  label,
}: {
  type: "level" | "xp" | "score";
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] py-4 text-center ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.07] hover:ring-indigo-300/30">
      <div className="mb-1 flex items-center justify-center text-cyan-300">
        <StatIcon type={type} />
      </div>
      <p className="text-xl font-semibold tabular-nums text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
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
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold ${ghostButton}`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
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
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-200 ring-1 ring-emerald-400/30 backdrop-blur"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {success}
          </div>
        )}
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 ring-1 ring-red-400/30 backdrop-blur"
          >
            {formError}
          </div>
        )}

        <div className={`${glass} overflow-hidden`}>
          <div className="relative h-24 bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "16px 16px",
              }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-900/70 to-transparent"
              aria-hidden="true"
            />
          </div>

          <div className="-mt-14 px-6 pb-6">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-[#0b0c1f] p-1 shadow-[0_0_30px_rgba(99,102,241,0.45)] ring-2 ring-white/15">
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
                  aria-label="Username"
                  className="w-full rounded-lg border-0 bg-white/5 px-3 py-2 text-center text-base font-semibold text-white ring-1 ring-inset ring-white/15 placeholder:text-slate-500 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  placeholder="Username"
                />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xl font-semibold text-white">{profile.username}</p>
                  <span className="rounded-full bg-indigo-400/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-300/30">
                    Level {profile.level}
                  </span>
                </div>
              )}
              <p className="mt-0.5 text-sm text-slate-400">{profile.email}</p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat type="level" value={profile.level} label="Level" />
              <Stat type="xp" value={profile.xp} label="XP" />
              <Stat type="score" value={profile.top_score ?? 0} label="Highest score" />
            </div>

            <div className="mt-6 rounded-xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Level {profile.level} progress
                </span>
                <span className="font-medium tabular-nums text-slate-400">
                  {xpIntoLevel} / {XP_PER_LEVEL} XP
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={xpProgressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="XP progress to next level"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 shadow-[0_0_12px_rgba(129,140,248,0.7)] transition-all duration-500"
                  style={{ width: `${xpProgressPct}%` }}
                />
              </div>
            </div>

            {editing && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${primaryButton}`}
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
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium ${ghostButton}`}
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
    </Shell>
  );
}