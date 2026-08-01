"use client";

import { useEffect, useState } from "react";
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  getAllUsers,
} from "../lib/api";
import type { Friend, PendingRequest } from "../types/friend";
import type { UserProfile } from "../types/user";

type Tab = "friends" | "requests" | "add";

export default function FriendsPanel({ currentUserId }: { currentUserId: string }) {
  const [tab, setTab] = useState<Tab>("friends");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsRes, requestsRes] = await Promise.all([getFriends(), getPendingRequests()]);
      setFriends(friendsRes.friends);
      setRequests(requestsRes.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab !== "add" || allUsers.length) return;
    getAllUsers()
      .then((res) => setAllUsers(res.users))
      .catch(() => setAllUsers([]));
  }, [tab, allUsers.length]);

  const handleAccept = async (requestId: string) => {
    setActioningId(requestId);
    try {
      await acceptFriendRequest(requestId);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept request");
    } finally {
      setActioningId(null);
    }
  };

  const handleRemove = async (friendId: string) => {
    setActioningId(friendId);
    try {
      await removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove friend");
    } finally {
      setActioningId(null);
    }
  };

  const handleSend = async (receiverId: string) => {
    setActioningId(receiverId);
    try {
      await sendFriendRequest(receiverId);
      setSentTo((prev) => new Set(prev).add(receiverId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setActioningId(null);
    }
  };

  const existingFriendIds = new Set(friends.map((f) => f.id));
  const filteredUsers = allUsers.filter(
    (u) =>
      u.id !== currentUserId &&
      !existingFriendIds.has(u.id) &&
      u.username.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex border-b border-gray-100">
        {[
          { key: "friends" as Tab, label: `Friends${friends.length ? ` (${friends.length})` : ""}` },
          { key: "requests" as Tab, label: `Requests${requests.length ? ` (${requests.length})` : ""}` },
          { key: "add" as Tab, label: "Add friend" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              tab === t.key
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : tab === "friends" ? (
          friends.length === 0 ? (
            <EmptyState text="No friends yet — add someone to get started." />
          ) : (
            <ul className="space-y-2">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                        {f.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.avatar} alt={f.username} className="h-full w-full object-cover" />
                        ) : (
                          f.username[0]?.toUpperCase()
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                          f.is_online ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.username}</p>
                      <p className="text-xs text-gray-500">
                        Level {f.level} · {f.top_score} pts
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(f.id)}
                    disabled={actioningId === f.id}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {actioningId === f.id ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : tab === "requests" ? (
          requests.length === 0 ? (
            <EmptyState text="No pending friend requests." />
          ) : (
            <ul className="space-y-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                      {r.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatar} alt={r.username} className="h-full w-full object-cover" />
                      ) : (
                        r.username[0]?.toUpperCase()
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{r.username}</p>
                  </div>
                  <button
                    onClick={() => handleAccept(r.id)}
                    disabled={actioningId === r.id}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {actioningId === r.id ? "Accepting..." : "Accept"}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username..."
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {query && filteredUsers.length === 0 ? (
              <EmptyState text="No matching users found." />
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {filteredUsers.slice(0, 20).map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                        {u.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar} alt={u.username} className="h-full w-full object-cover" />
                        ) : (
                          u.username[0]?.toUpperCase()
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{u.username}</p>
                    </div>
                    <button
                      onClick={() => handleSend(u.id)}
                      disabled={actioningId === u.id || sentTo.has(u.id)}
                      className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {sentTo.has(u.id) ? "Sent" : actioningId === u.id ? "Sending..." : "Add"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-gray-400">{text}</p>;
}