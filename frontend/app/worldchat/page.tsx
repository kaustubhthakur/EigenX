"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DuelScene from "../../components/DuelScene";
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

const gutter =
  "px-4 sm:px-8 lg:px-[max(2rem,calc(50%_-_28rem))]";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Keep older history we already loaded, replace the newest window with the server's copy. */
const mergeWindow = (prev: WorldMessage[], latest: WorldMessage[]) => {
  if (latest.length === 0) return [];
  const minId = Number(latest[0].id);
  return [...prev.filter((m) => Number(m.id) < minId), ...latest];
};

export default function WorldChatPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const myId = user ? String(user.id) : "";

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

  if (loading || !user) {
    return <div className="min-h-[calc(100vh-4rem)]" />;
  }

  return (
    <main className="relative h-[calc(100vh-4rem)] bg-[#070815]">
      <DuelScene calm />

      <section className="relative z-10 flex h-full min-h-0 flex-col bg-[#0b0c1f]/60 backdrop-blur-xl">
          <header className={`border-b border-white/10 py-3 ${gutter}`}>
            <h1 className="text-base font-semibold text-white">World chat</h1>
            <p className="text-xs text-slate-500">
              Tap a name to see their profile and challenge them
            </p>
          </header>

          <div className="lg:px-[max(1.25rem,calc(50%_-_28.75rem))]">
            <DuelRequests
              incoming={incoming}
              outgoing={outgoing}
              busyId={busyId}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onCancel={handleCancel}
            />
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={listRef}
              onScroll={onScroll}
              className={`h-full overflow-y-auto py-4 ${gutter}`}
              aria-live="polite"
            >
              {loadingMessages ? (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : loadError && messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-rose-300">{loadError}</p>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  No messages yet. Say hello and start a duel.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const grouped =
                      !!prev &&
                      String(prev.user_id) === String(m.user_id) &&
                      new Date(m.created_at).getTime() -
                        new Date(prev.created_at).getTime() <
                        GROUP_WINDOW_MS;
                    const mine = String(m.user_id) === myId;

                    return (
                      <li
                        key={m.id}
                        className={`group flex gap-3 rounded-lg px-2 py-0.5 hover:bg-white/[0.03] ${
                          grouped ? "" : "mt-3"
                        }`}
                      >
                        <div className="w-9 shrink-0">
                          {!grouped && (
                            <button
                              type="button"
                              onClick={() => setProfileId(m.user_id)}
                              className={`rounded-full ${focusRing}`}
                              aria-label={`View ${m.username}'s profile`}
                            >
                              <UserAvatar name={m.username} avatar={m.avatar} size={36} />
                            </button>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {!grouped && (
                            <div className="flex items-baseline gap-2">
                              <button
                                type="button"
                                onClick={() => setProfileId(m.user_id)}
                                className={`truncate rounded text-sm font-semibold text-white hover:underline ${focusRing}`}
                              >
                                {mine ? `${m.username} (you)` : m.username}
                              </button>
                              <span className="rounded bg-white/[0.06] px-1.5 py-px text-[11px] text-slate-400">
                                Lv {m.level}
                              </span>
                              <time className="text-xs text-slate-500" dateTime={m.created_at}>
                                {formatTime(m.created_at)}
                              </time>
                            </div>
                          )}
                          <p className="break-words text-sm leading-relaxed text-slate-200">
                            {m.content}
                          </p>
                        </div>
                        {mine && (
                          <button
                            type="button"
                            onClick={() => handleDelete(m.id)}
                            aria-label="Delete message"
                            className={`h-7 shrink-0 self-start rounded px-2 text-xs text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-rose-300 focus-visible:opacity-100 group-hover:opacity-100 ${focusRing}`}
                          >
                            Delete
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {showJump && (
              <button
                type="button"
                onClick={jumpToLatest}
                className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-inset ring-white/10 hover:bg-indigo-400 ${focusRing}`}
              >
                Jump to latest
              </button>
            )}
          </div>

          {notice && (
            <p
              role="status"
              className={`border-t border-white/10 bg-white/[0.04] py-2 text-sm text-slate-200 ${gutter}`}
            >
              {notice}
            </p>
          )}

          <form
            onSubmit={handleSend}
            className={`border-t border-white/10 py-3 ${gutter}`}
          >
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
                placeholder="Message the world"
                aria-label="Message"
                maxLength={MAX_LENGTH}
                className={`h-10 min-w-0 flex-1 rounded-lg bg-white/[0.05] px-3.5 text-sm text-white placeholder:text-slate-500 ring-1 ring-inset ring-white/10 ${focusRing}`}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className={`inline-flex h-10 items-center rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 ${focusRing}`}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            <div className="mt-1.5 flex justify-between px-1 text-xs">
              <span className="text-rose-300">{sendError}</span>
              {nearLimit && (
                <span className="text-slate-500">
                  {draft.length}/{MAX_LENGTH}
                </span>
              )}
            </div>
          </form>
        </section>


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