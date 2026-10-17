"use client";

import { useEffect, useState } from "react";
import { getWorldProfile } from "../../lib/api";
import type { WorldProfile } from "../../types/worldchat";
import UserAvatar from "./UserAvatar";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

export default function ProfileCard({
  userId,
  isSelf,
  requestPending,
  busy,
  onChallenge,
  onClose,
}: {
  userId: string | number;
  isSelf: boolean;
  /** You already have an open request to this player. */
  requestPending: boolean;
  busy: boolean;
  onChallenge: (userId: string | number) => void;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<WorldProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getWorldProfile(userId)
      .then((res) => !cancelled && setProfile(res.profile))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canChallenge = !!profile && !isSelf && profile.is_online && !requestPending;

  let buttonLabel = "Challenge to duel";
  if (busy) buttonLabel = "Sending…";
  else if (requestPending) buttonLabel = "Request sent";
  else if (profile && !profile.is_online) buttonLabel = "Offline";

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Player profile"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0e24] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        {error ? (
          <p className="py-6 text-center text-sm text-rose-300">{error}</p>
        ) : !profile ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            </div>
            <div className="h-16 animate-pulse rounded-xl bg-white/5" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <UserAvatar
                name={profile.username}
                avatar={profile.avatar}
                size={56}
                online={profile.is_online}
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  {profile.username}
                </p>
                <p className="text-sm text-slate-400">
                  {profile.is_online
                    ? "Online now"
                    : profile.last_seen
                    ? `Last seen ${new Date(profile.last_seen).toLocaleString()}`
                    : "Offline"}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                ["Level", profile.level],
                ["XP", profile.xp],
                ["Top score", profile.top_score],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-xl bg-white/[0.04] px-2 py-3 ring-1 ring-inset ring-white/10"
                >
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-white">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {!isSelf && (
              <button
                type="button"
                disabled={!canChallenge || busy}
                onClick={() => onChallenge(profile.user_id)}
                className={`mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-500 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 ${focusRing}`}
              >
                {buttonLabel}
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white ${focusRing}`}
        >
          Close
        </button>
      </div>
    </div>
  );
}