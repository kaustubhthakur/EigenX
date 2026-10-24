"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DuelRequests from "../../components/worldchat/DuelRequests";
import ProfileCard from "../../components/worldchat/ProfileCard";
import UserAvatar from "../../components/worldchat/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import {
  acceptWorldDuel,
  cancelWorldDuel,
  declineWorldDuel,
  deleteWorldMessage,
  getActiveDuel,
  getWorldIncoming,
  getWorldMessages,
  getWorldOutgoing,
  postWorldMessage,
  sendWorldDuelRequest,
} from "../../lib/api";
import type {
  WorldDuelRequest,
  WorldMessage,
} from "../../types/worldchat";

/** ADAPT: where your duel screen lives. */
const duelRoute = (duelId: string | number) => `/duel/${duelId}`;

const MAX_LENGTH = 500;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

/* Shared content column so header, messages and composer line up */
const column = "mx-auto w-full max-w-3xl px-4 sm:px-6";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

/** Keep older history we already loaded, replace the newest window with the server's copy. */
const mergeWindow = (prev: WorldMessage[], latest: WorldMessage[]) => {
  if (latest.length === 0) return [];
  const minId = Number(latest[0].id);
  return [...prev.filter((m) => Number(m.id) < minId), ...latest];
};

/* Small inline icons so no extra dependency is needed */
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 14-7-5 14-2.5-5.5L5 12Z" />
  </svg>
);
const ArrowDownIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14m0 0-6-6m6 6 6-6" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
const SwordsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m14.5 17.5 5 5M3 3l8 8m10-8-8 8M13 13l-8.5 8.5M9.5 17.5l-5 5" />
  </svg>
);

export default function WorldChatPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const myId = user ? String(user.id) : "";
  /** Your live level from the auth user, so your own messages never show a stale or wrong value. */
  const myLevel = (user as { level?: number | string } | null)?.level;

  const [messages, setMessages] = useState<WorldMessage[]>([]);
  const [incoming, setIncoming] = useState<WorldDuelRequest[]>([]);
  const [outgoing, setOutgoing] = useState<WorldDuelRequest[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [profileId, setProfileId] = useState<string | number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [notice, setNotice] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const hadOutgoingRef = useRef(false);

  /* Redirect guests */
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  /* Auto-clearing notice */
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  /* Polling: messages and duel requests */
  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const tickMessages = async () => {
      if (document.hidden) return;
      try {
        const res = await getWorldMessages(50);
        if (stopped) return;
        setMessages((prev) => mergeWindow(prev, res.messages));
        setLoadError("");
      } catch (e) {
        if (!stopped) setLoadError((e as Error).message);
      } finally {
        if (!stopped) setLoadingMessages(false);
      }
    };

    const tickRequests = async () => {
      if (document.hidden) return;
      try {
        // If we had an open request and it's gone, it may have been accepted.
        if (hadOutgoingRef.current) {
          const active = await getActiveDuel();
          if (!stopped && active.duelId) {
            hadOutgoingRef.current = false;
            router.push(duelRoute(active.duelId));
            return;
          }
        }
        const [inc, out] = await Promise.all([getWorldIncoming(), getWorldOutgoing()]);
        if (stopped) return;
        setIncoming(inc.requests);
        setOutgoing(out.requests);
        hadOutgoingRef.current = out.requests.length > 0;
      } catch {
        /* keep the last state */
      }
    };

    tickMessages();
    tickRequests();
    const a = setInterval(tickMessages, 3000);
    const c = setInterval(tickRequests, 3000);

    return () => {
      stopped = true;
      clearInterval(a);
      clearInterval(c);
    };
  }, [user, router]);

  /* Keep the view pinned to the newest message unless the user scrolled up */
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = nearBottom;
    setShowJump(!nearBottom);
  };

  const jumpToLatest = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  /* Actions */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError("");
    try {
      const res = await postWorldMessage(text);
      setDraft("");
      stickRef.current = true;
      setMessages((prev) =>
        prev.some((m) => String(m.id) === String(res.message.id))
          ? prev
          : [...prev, res.message]
      );
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteWorldMessage(id);
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(id)));
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const handleChallenge = async (receiverId: string | number) => {
    setChallenging(true);
    try {
      const res = await sendWorldDuelRequest(receiverId);
      setOutgoing((prev) => [...prev, res.request]);
      hadOutgoingRef.current = true;
      setNotice(`Challenge sent to ${res.request.receiver_username}`);
      setProfileId(null);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setChallenging(false);
    }
  };

  const handleAccept = async (id: string | number) => {
    setBusyId(String(id));
    try {
      const res = await acceptWorldDuel(id);
      router.push(duelRoute(res.duelId));
    } catch (err) {
      setNotice((err as Error).message);
      setIncoming((prev) => prev.filter((r) => String(r.id) !== String(id)));
      setBusyId(null);
    }
  };

  const handleDecline = async (id: string | number) => {
    setBusyId(String(id));
    try {
      await declineWorldDuel(id);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setIncoming((prev) => prev.filter((r) => String(r.id) !== String(id)));
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string | number) => {
    setBusyId(String(id));
    try {
      await cancelWorldDuel(id);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setOutgoing((prev) => {
        const next = prev.filter((r) => String(r.id) !== String(id));
        hadOutgoingRef.current = next.length > 0;
        return next;
      });
      setBusyId(null);
    }
  };

  const pendingTo = (id: string | number) =>
    outgoing.some((r) => String(r.receiver_id) === String(id));

  const nearLimit = draft.length > MAX_LENGTH - 60;
  const canSend = !!draft.trim() && !sending;

  if (loading || !user) {
    return <div className="min-h-[calc(100vh-4rem)]" />;
  }

  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col bg-[#0b0d17]">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className={`${column} flex items-center gap-3 py-3.5`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-indigo-300 ring-1 ring-inset ring-white/10">
            <ChatIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold leading-tight text-white">World chat</h1>
            <p className="truncate text-xs text-slate-400">
              Open to everyone. Select a name to view a profile or send a challenge.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
      </header>

      {/* Duel requests */}
      <div className={`${column} pt-3 empty:hidden`}>
        <DuelRequests
          incoming={incoming}
          outgoing={outgoing}
          busyId={busyId}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
        />
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin]"
          aria-live="polite"
        >
          <div className={`${column} py-4`}>
            {loadingMessages ? (
              <div className="space-y-5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/10" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError && messages.length === 0 ? (
              <div className="mx-auto mt-16 max-w-xs rounded-lg border border-rose-400/20 bg-rose-400/5 p-4 text-center">
                <p className="text-sm font-medium text-rose-200">Couldn’t load messages</p>
                <p className="mt-1 text-xs text-rose-300/80">{loadError}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto mt-20 flex max-w-xs flex-col items-center text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] text-indigo-300 ring-1 ring-inset ring-white/10">
                  <ChatIcon />
                </div>
                <p className="mt-4 text-sm font-semibold text-white">No messages yet</p>
                <p className="mt-1 text-sm text-slate-400">Say hello, then challenge someone to a duel.</p>
              </div>
            ) : (
              <ul>
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const newDay =
                    !prev ||
                    new Date(prev.created_at).toDateString() !==
                      new Date(m.created_at).toDateString();
                  const grouped =
                    !newDay &&
                    String(prev.user_id) === String(m.user_id) &&
                    new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                      GROUP_WINDOW_MS;
                  const mine = String(m.user_id) === myId;
                  const level = mine ? myLevel ?? m.level : m.level;

                  return (
                    <Fragment key={m.id}>
                      {newDay && (
                        <li role="separator" className="my-5 flex items-center gap-3 first:mt-0">
                          <span className="h-px flex-1 bg-white/10" />
                          <span className="text-xs font-medium text-slate-400">
                            {formatDay(m.created_at)}
                          </span>
                          <span className="h-px flex-1 bg-white/10" />
                        </li>
                      )}

                      <li
                        className={`group relative -mx-3 flex gap-3 rounded-lg px-3 py-1 transition-colors hover:bg-white/[0.035] focus-within:bg-white/[0.035] ${
                          grouped ? "" : "mt-3 first:mt-0"
                        } ${mine ? "flex-row-reverse" : ""}`}
                      >
                        {/* Gutter: avatar, or the time on hover for grouped messages */}
                        <div className="w-9 shrink-0">
                          {grouped ? (
                            <time
                              dateTime={m.created_at}
                              className={`block pt-0.5 text-[11px] leading-6 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 ${
                                mine ? "text-left" : "text-right"
                              }`}
                            >
                              {formatTime(m.created_at)}
                            </time>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setProfileId(m.user_id)}
                              aria-label={`View ${m.username}'s profile`}
                              className={`block rounded-full transition hover:opacity-80 ${focusRing}`}
                            >
                              <UserAvatar name={m.username} avatar={m.avatar} size={36} />
                            </button>
                          )}
                        </div>

                        {/* Content */}
                        <div className={`min-w-0 flex-1 ${mine ? "flex flex-col items-end" : ""}`}>
                          {!grouped && (
                            <div
                              className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${
                                mine ? "flex-row-reverse" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setProfileId(m.user_id)}
                                className={`truncate rounded text-sm font-semibold hover:underline ${focusRing} ${
                                  mine ? "text-indigo-300" : "text-white"
                                }`}
                              >
                                {m.username}
                              </button>
                              {mine && (
                                <span className="rounded bg-indigo-400/15 px-1.5 py-px text-[11px] font-medium text-indigo-200">
                                  You
                                </span>
                              )}
                              <span className="rounded bg-amber-400/10 px-1.5 py-px text-[11px] font-semibold text-amber-300">
                                Lv {level}
                              </span>
                              <time className="text-xs text-slate-500" dateTime={m.created_at}>
                                {formatTime(m.created_at)}
                              </time>
                            </div>
                          )}
                          <p
                            className={`break-words text-[15px] leading-6 ${
                              mine
                                ? `${grouped ? "" : "mt-1"} max-w-[85%] rounded-2xl bg-indigo-500 px-3.5 py-2 text-left text-white ${
                                    grouped ? "" : "rounded-tr-md"
                                  }`
                                : "text-slate-200"
                            }`}
                          >
                            {m.content}
                          </p>
                        </div>

                        {/* Hover toolbar */}
                        <div className={`absolute -top-3 ${mine ? "left-3" : "right-3"} flex items-center rounded-lg border border-white/10 bg-[#141729] p-0.5 opacity-0 shadow-lg shadow-black/30 transition-opacity focus-within:opacity-100 group-hover:opacity-100`}>
                          {mine ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(m.id)}
                              aria-label="Delete message"
                              title="Delete message"
                              className={`flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-300 ${focusRing}`}
                            >
                              <TrashIcon />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setProfileId(m.user_id)}
                              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-300 transition hover:bg-indigo-400/15 hover:text-indigo-200 ${focusRing}`}
                            >
                              <SwordsIcon />
                              Challenge
                            </button>
                          )}
                        </div>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {showJump && (
          <button
            type="button"
            onClick={jumpToLatest}
            className={`absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/30 transition-colors hover:bg-indigo-400 ${focusRing}`}
          >
            <ArrowDownIcon />
            Jump to latest
          </button>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t border-white/10 py-3">
        <div className={column}>
          {notice && (
            <p
              role="status"
              className="mb-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-200"
            >
              {notice}
            </p>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#11142a] p-1.5 pl-4 transition focus-within:border-indigo-400/60 focus-within:ring-4 focus-within:ring-indigo-400/10">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
              placeholder="Message the world"
              aria-label="Message"
              maxLength={MAX_LENGTH}
              autoComplete="off"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!canSend}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500 ${focusRing}`}
            >
              {sending ? (
                "Sending…"
              ) : (
                <>
                  Send
                  <SendIcon />
                </>
              )}
            </button>
          </div>

          <div className="mt-1.5 flex items-center justify-between px-1 text-xs">
            {sendError ? (
              <p role="alert" className="text-rose-300">
                {sendError}
              </p>
            ) : (
              <p className="hidden text-slate-500 sm:block">Press Enter to send</p>
            )}
            {nearLimit && (
              <span
                className={`ml-auto tabular-nums ${
                  draft.length >= MAX_LENGTH ? "text-rose-300" : "text-slate-500"
                }`}
              >
                {draft.length}/{MAX_LENGTH}
              </span>
            )}
          </div>
        </div>
      </form>

      {profileId !== null && (
        <ProfileCard
          userId={profileId}
          isSelf={String(profileId) === myId}
          requestPending={pendingTo(profileId)}
          busy={challenging}
          onChallenge={handleChallenge}
          onClose={() => setProfileId(null)}
        />
      )}
    </main>
  );
}