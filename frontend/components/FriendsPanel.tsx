"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  getAllUsers,
  getFriends,
  getPendingRequests,
  getSentRequests,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  getProfile,
  resolveAvatarUrl,
} from "@/lib/api";

import type { UserProfile } from "@/types/user";

type Friend = {
  id: string | number;
  username: string;
  avatar?: string | null;
  is_online?: boolean;
  top_score?: number;
  level?: number;
};

type IncomingRequest = {
  id: string | number;
  sender_id: string | number;
  username: string;
  avatar?: string | null;
  created_at?: string;
};

type Tab = "friends" | "requests" | "add";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const scrollArea =
  "max-h-80 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.2)_transparent] [scrollbar-width:thin]";

function Avatar({
  name,
  src,
  online,
}: {
  name: string;
  src?: string | null;
  online?: boolean;
}) {
  const url = src ? resolveAvatarUrl(src) : null;

  return (
    <div className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white ring-2 ring-white/10">
          {(name || "?").charAt(0).toUpperCase()}
        </div>
      )}

      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${
            online
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              : "bg-slate-600"
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function Row({
  avatar,
  title,
  subtitle,
  action,
}: {
  avatar: ReactNode;
  title: string;
  subtitle?: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.07]">
      <div className="flex min-w-0 items-center gap-3">
        {avatar}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-slate-500">{children}</p>;
}

export default function FriendsPanel(_props: {
  currentUserId?: string | number;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requestedTo, setRequestedTo] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [profileRes, friendsRes, requestsRes, sentRes, usersRes] =
        await Promise.all([
          getProfile(),
          getFriends(),
          getPendingRequests(),
          getSentRequests(),
          getAllUsers(),
        ]);

      const profile = profileRes as {
        user?: { id?: string | number };
        id?: string | number;
      };

      const id = profile.user?.id ?? profile.id;

      if (id == null) {
        throw new Error("Could not determine the logged-in user's ID.");
      }

      const myId = String(id);
      setCurrentUserId(myId);

      setFriends(friendsRes.friends ?? []);
      setRequests(requestsRes.requests ?? []);

      setUsers((usersRes.users ?? []).filter((user) => String(user.id) !== myId));

      setRequestedTo(
        new Set((sentRes.requests ?? []).map((request) => String(request.receiver_id)))
      );
    } catch (err) {
      console.error("Failed to load friends:", err);
      setError(err instanceof Error ? err.message : "Failed to load friends data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSend = async (receiverId: string | number) => {
    const id = String(receiverId);

    if (id === currentUserId || requestedTo.has(id)) return;

    setBusyId(id);
    setError("");

    try {
      await sendFriendRequest(id);

      setRequestedTo((previous) => {
        const next = new Set(previous);
        next.add(id);
        return next;
      });
    } catch (err) {
      console.error("Send friend request failed:", err);
      setError(err instanceof Error ? err.message : "Failed to send friend request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (requestId: string | number) => {
    setBusyId(String(requestId));
    setError("");

    try {
      await acceptFriendRequest(String(requestId));
      await loadAll();
    } catch (err) {
      console.error("Accept friend request failed:", err);
      setError("Failed to accept friend request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (friendId: string | number) => {
    setBusyId(String(friendId));
    setError("");

    try {
      await removeFriend(String(friendId));
      await loadAll();
    } catch (err) {
      console.error("Remove friend failed:", err);
      setError("Failed to remove friend.");
    } finally {
      setBusyId(null);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "friends", label: "Friends" },
    { id: "requests", label: "Requests", count: requests.length },
    { id: "add", label: "Add friend" },
  ];

  return (
    <section
      aria-label="Friends"
      className="w-full overflow-hidden rounded-2xl bg-slate-900/70 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl"
    >
      <div role="tablist" className="grid grid-cols-3 border-b border-white/10">
        {tabs.map(({ id, label, count }) => {
          const active = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveTab(id);
                setError("");
              }}
              className={`relative flex items-center justify-center gap-2 px-3 py-4 text-sm font-medium transition-colors ${focusRing} ${
                active ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
              {count ? (
                <span className="rounded-full bg-indigo-500 px-1.5 py-px text-[10px] font-semibold text-white">
                  {count}
                </span>
              ) : null}
              {active && (
                <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300" />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4" role="tabpanel">
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/30"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="animate-pulse space-y-3 py-1" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
                <div className="h-10 w-10 rounded-full bg-white/10" />
                <div className="h-3.5 w-28 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {activeTab === "friends" && (
              <>
                {friends.length === 0 ? (
                  <Empty>You haven&apos;t added any friends yet.</Empty>
                ) : (
                  <ul className={`space-y-2 ${scrollArea}`}>
                    {friends.map((friend) => (
                      <Row
                        key={friend.id}
                        avatar={
                          <Avatar
                            name={friend.username}
                            src={friend.avatar}
                            online={friend.is_online}
                          />
                        }
                        title={friend.username}
                        subtitle={
                          friend.is_online !== undefined ? (
                            <span className={friend.is_online ? "text-emerald-400" : ""}>
                              {friend.is_online ? "Online" : "Offline"}
                            </span>
                          ) : undefined
                        }
                        action={
                          <button
                            type="button"
                            disabled={busyId === String(friend.id)}
                            onClick={() => void handleRemove(friend.id)}
                            className={`shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 ring-1 ring-inset ring-white/15 transition hover:bg-red-500/10 hover:text-red-300 hover:ring-red-400/40 disabled:opacity-50 ${focusRing}`}
                          >
                            Remove
                          </button>
                        }
                      />
                    ))}
                  </ul>
                )}
              </>
            )}

            {activeTab === "requests" && (
              <>
                {requests.length === 0 ? (
                  <Empty>No pending friend requests.</Empty>
                ) : (
                  <ul className={`space-y-2 ${scrollArea}`}>
                    {requests.map((request) => (
                      <Row
                        key={request.id}
                        avatar={<Avatar name={request.username} src={request.avatar} />}
                        title={request.username}
                        subtitle="Wants to be your friend"
                        action={
                          <button
                            type="button"
                            disabled={busyId === String(request.id)}
                            onClick={() => void handleAccept(request.id)}
                            className={`shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50 ${focusRing}`}
                          >
                            {busyId === String(request.id) ? "Accepting..." : "Accept"}
                          </button>
                        }
                      />
                    ))}
                  </ul>
                )}
              </>
            )}

            {activeTab === "add" && (
              <div>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by username..."
                  aria-label="Search by username"
                  className="mb-3 w-full rounded-lg border-0 bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-inset ring-white/15 placeholder:text-slate-500 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />

                {filteredUsers.length === 0 ? (
                  <Empty>No users found.</Empty>
                ) : (
                  <ul className={`space-y-2 ${scrollArea}`}>
                    {filteredUsers.map((user) => {
                      const isRequested = requestedTo.has(String(user.id));

                      return (
                        <Row
                          key={user.id}
                          avatar={<Avatar name={user.username} src={user.avatar} />}
                          title={user.username}
                          action={
                            <button
                              type="button"
                              disabled={isRequested || busyId === String(user.id)}
                              onClick={() => void handleSend(user.id)}
                              className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${focusRing} ${
                                isRequested
                                  ? "bg-white/5 text-slate-500"
                                  : "bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-300/30 hover:bg-indigo-500/25"
                              }`}
                            >
                              {isRequested ? "Requested" : "Add"}
                            </button>
                          }
                        />
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}