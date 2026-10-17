import { resolveAvatarUrl } from "../../lib/api";

export default function UserAvatar({
  name,
  avatar,
  size = 36,
  online,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
  /** Pass true/false to show a presence dot; omit to hide it. */
  online?: boolean;
}) {
  const url = resolveAvatarUrl(avatar);

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full rounded-full object-cover ring-1 ring-white/10"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-indigo-500/20 font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/40"
          style={{ fontSize: Math.max(11, size * 0.4) }}
        >
          {name?.[0]?.toUpperCase() || "?"}
        </span>
      )}
      {online !== undefined && (
        <span
          aria-hidden="true"
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0b0c1f] ${
            online ? "bg-emerald-400" : "bg-slate-600"
          }`}
        />
      )}
    </span>
  );
}