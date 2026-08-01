"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getProfile, updateProfile, UserProfile } from "../../lib/api";
import Button from "../../components/Button";
import Input from "../../components/Input";
import Alert from "../../components/Alert";

export default function DashboardPage() {
  const { user, setUser } = useAuth(); // adjust if AuthContext doesn't expose setUser
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getProfile();
        setProfile(res.user);
        setUsername(res.user.username);
        setAvatar(res.user.avatar || "");
      } catch (err) {
        // Not authenticated / token expired -> bounce to login
        setError(err instanceof Error ? err.message : "Failed to load profile");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateProfile({ username, avatar });
      setProfile(res.user);
      setUser?.(res.user); // keep navbar/context in sync, if supported
      setSuccess("Profile updated successfully");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-gray-500">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert type="error" message={error || "Unable to load profile"} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Your Profile</h1>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-xl font-semibold text-indigo-700">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt={profile.username}
                className="h-full w-full object-cover"
              />
            ) : (
              profile.username?.[0]?.toUpperCase() || "?"
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{profile.username}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-gray-50 py-3">
            <p className="text-lg font-bold text-indigo-600">{profile.level}</p>
            <p className="text-xs text-gray-500">Level</p>
          </div>
          <div className="rounded-lg bg-gray-50 py-3">
            <p className="text-lg font-bold text-indigo-600">{profile.xp}</p>
            <p className="text-xs text-gray-500">XP</p>
          </div>
          <div className="rounded-lg bg-gray-50 py-3">
            <p className="text-lg font-bold text-indigo-600">{profile.score ?? 0}</p>
            <p className="text-xs text-gray-500">Score</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <Input
              label="Username"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUsername(e.target.value)
              }
            />
            <Input
              label="Avatar URL"
              value={avatar}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAvatar(e.target.value)
              }
            />
            <div className="flex gap-3">
              <Button onClick={handleSave} loading={saving}>
                Save changes
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setUsername(profile.username);
                  setAvatar(profile.avatar || "");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setEditing(true)}>Edit profile</Button>
        )}
      </div>
    </div>
  );
}