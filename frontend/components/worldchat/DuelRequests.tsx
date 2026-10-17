"use client";

import { useEffect, useState } from "react";
import type { WorldDuelRequest } from "../../types/worldchat";
import UserAvatar from "./UserAvatar";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

const secondsLeft = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));

function useSecondsLeft(expiresAt: string) {
  const [s, setS] = useState(() => secondsLeft(expiresAt));
  useEffect(() => {
    setS(secondsLeft(expiresAt));
    const id = setInterval(() => setS(secondsLeft(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return s;
}

function Incoming({
  request,
  busy,
  onAccept,
  onDecline,
}: {
  request: WorldDuelRequest;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const left = useSecondsLeft(request.expires_at);
  if (left === 0) return null;

  return (
    <li className="flex items-center gap-3 rounded-xl bg-indigo-500/10 px-3 py-2.5 ring-1 ring-inset ring-indigo-400/30">
      <UserAvatar name={request.sender_username} avatar={request.sender_avatar} size={32} />
      <p className="min-w-0 flex-1 text-sm text-slate-200">
        <span className="font-semibold text-white">{request.sender_username}</span>{" "}
        challenged you to a duel
        <span className="ml-2 text-xs text-slate-400">{left}s</span>
      </p>
      <button
        type="button"
        onClick={onDecline}
        disabled={busy}
        className={`h-8 rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60 ${focusRing}`}
      >
        Decline
      </button>
      <button
        type="button"
        onClick={onAccept}
        disabled={busy}
        className={`h-8 rounded-lg bg-indigo-500 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-60 ${focusRing}`}
      >
        {busy ? "Starting…" : "Accept"}
      </button>
    </li>
  );
}

function Outgoing({
  request,
  busy,
  onCancel,
}: {
  request: WorldDuelRequest;
  busy: boolean;
  onCancel: () => void;
}) {
  const left = useSecondsLeft(request.expires_at);
  if (left === 0) return null;

  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10">
      <UserAvatar name={request.receiver_username} avatar={request.receiver_avatar} size={32} />
      <p className="min-w-0 flex-1 text-sm text-slate-300">
        Waiting for{" "}
        <span className="font-semibold text-white">{request.receiver_username}</span>
        <span className="ml-2 text-xs text-slate-500">{left}s</span>
      </p>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className={`h-8 rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60 ${focusRing}`}
      >
        Cancel
      </button>
    </li>
  );
}

export default function DuelRequests({
  incoming,
  outgoing,
  busyId,
  onAccept,
  onDecline,
  onCancel,
}: {
  incoming: WorldDuelRequest[];
  outgoing: WorldDuelRequest[];
  busyId: string | null;
  onAccept: (id: string | number) => void;
  onDecline: (id: string | number) => void;
  onCancel: (id: string | number) => void;
}) {
  if (incoming.length === 0 && outgoing.length === 0) return null;

  return (
    <ul className="space-y-2 border-b border-white/10 p-3" aria-live="polite">
      {incoming.map((r) => (
        <Incoming
          key={`in-${r.id}`}
          request={r}
          busy={busyId === String(r.id)}
          onAccept={() => onAccept(r.id)}
          onDecline={() => onDecline(r.id)}
        />
      ))}
      {outgoing.map((r) => (
        <Outgoing
          key={`out-${r.id}`}
          request={r}
          busy={busyId === String(r.id)}
          onCancel={() => onCancel(r.id)}
        />
      ))}
    </ul>
  );
}