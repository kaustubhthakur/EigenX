
"use client";

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

export default function FriendsPanel() {
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


      const profile = (
        profileRes as {
          user?: { id?: string | number };
          id?: string | number;
        }
      );

      const id = profile.user?.id ?? profile.id;

      if (id == null) {
        throw new Error("Could not determine the logged-in user's ID.");
      }

      const myId = String(id);
      setCurrentUserId(myId);

      setFriends(friendsRes.friends ?? []);
      setRequests(requestsRes.requests ?? []);

 
      setUsers(
        (usersRes.users ?? []).filter(
          (user) => String(user.id) !== myId
        )
      );

  
      setRequestedTo(
        new Set(
          (sentRes.requests ?? []).map((request) =>
            String(request.receiver_id)
          )
        )
      );
    } catch (err) {
      console.error("Failed to load friends:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load friends data."
      );
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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send friend request."
      );
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

  return (
    <section className="w-full overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="grid grid-cols-3 border-b">
        {(
          [
            ["friends", "Friends"],
            ["requests", "Requests"],
            ["add", "Add friend"],
          ] as [Tab, string][]
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setError("");
            }}
            className={`border-b-2 px-3 py-4 text-sm ${
              activeTab === tab
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {error && (
          <p className="mb-3 text-sm text-red-500">{error}</p>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Loading friends...
          </p>
        ) : (
          <>
            {activeTab === "friends" && (
              <div className="space-y-3">
                {friends.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    You haven't added any friends yet.
                  </p>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-3 rounded-xl border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {friend.avatar ? (
                          <img
                            src={resolveAvatarUrl(friend.avatar)}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                            {friend.username.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <span className="font-medium">
                          {friend.username}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === String(friend.id)}
                        onClick={() => void handleRemove(friend.id)}
                        className="rounded-lg border px-3 py-2 text-sm text-red-500 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "requests" && (
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No pending friend requests.
                  </p>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-xl border p-3"
                    >
                      <span className="font-medium">
                        {request.username}
                      </span>

                      <button
                        type="button"
                        disabled={busyId === String(request.id)}
                        onClick={() => void handleAccept(request.id)}
                        className="rounded-lg border border-violet-500 px-3 py-2 text-sm text-violet-600 disabled:opacity-50"
                      >
                        Accept
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "add" && (
              <div>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by username..."
                  className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-violet-500"
                />

                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">
                      No users found.
                    </p>
                  ) : (
                    filteredUsers.map((user) => {
                      const isRequested = requestedTo.has(
                        String(user.id)
                      );

                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-3 rounded-xl border p-3"
                        >
                          <div className="flex items-center gap-3">
                            {user.avatar ? (
                              <img
                                src={resolveAvatarUrl(user.avatar)}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <span className="font-medium">
                              {user.username}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={
                              isRequested ||
                              busyId === String(user.id)
                            }
                            onClick={() => void handleSend(user.id)}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              isRequested
                                ? "border-violet-200 text-violet-300"
                                : "border-violet-500 text-violet-600"
                            } disabled:cursor-not-allowed`}
                          >
                            {isRequested ? "Requested" : "Add"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}