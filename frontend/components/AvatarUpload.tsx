"use client";

import { useRef, useState } from "react";
import { uploadAvatar } from "../lib/api";
import type { UserProfile } from "../types/user";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 2;

interface AvatarUploadProps {
  currentAvatar?: string;
  username: string;
  onUploaded: (user: UserProfile) => void;
}

export default function AvatarUpload({ currentAvatar, username, onUploaded }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const validate = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only JPEG, PNG, WEBP or GIF images are allowed.";
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Image must be smaller than ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = async (file: File) => {
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const res = await uploadAvatar(file);
      onUploaded(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const displaySrc = preview || currentAvatar;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition ${
          dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-400"
        }`}
      >
        {displaySrc ? (
    
          <img src={displaySrc} alt={username} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-indigo-600">
            {username?.[0]?.toUpperCase() || "?"}
          </span>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-[11px] font-medium text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          {uploading ? "Uploading..." : "Change"}
        </div>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-xs font-medium text-indigo-600 transition hover:text-indigo-700"
      >
        {displaySrc ? "Change photo" : "Upload photo"}
      </button>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <p className="text-[11px] text-gray-400">JPG, PNG, WEBP or GIF · max {MAX_SIZE_MB}MB</p>
    </div>
  );
}