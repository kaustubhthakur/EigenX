"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Space_Grotesk } from "next/font/google";
import { getLeaderboard, resolveAvatarUrl, type LeaderboardEntry } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

type Phase = "loading" | "loaded" | "error";

// Index = place (0 = first). x position and block height in scene units.
const SLOTS = [
  { label: "1st", x: 0, height: 2.0, color: 0xd4af37, text: "text-[#8A6A00]" },
  { label: "2nd", x: -2.1, height: 1.4, color: 0xaeb4c0, text: "text-[#555C6B]" },
  { label: "3rd", x: 2.1, height: 0.9, color: 0xc08552, text: "text-[#8F532B]" },
];

const formatScore = (n: number | null | undefined) =>
  n && n > 0 ? n.toLocaleString("en-US") : "—";

function Avatar({ entry, size }: { entry: LeaderboardEntry; size: string }) {
  const url = resolveAvatarUrl(entry.avatar);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600`}
    >
      {entry.username?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

/**
 * Three stepped blocks with a spinning, floating coin above each one.
 * Names and scores are HTML labels pinned to the coins, so avatars load
 * as normal images (no CORS needed) and text stays crisp.
 */
function PodiumScene({
  podium,
  meId,
}: {
  podium: LeaderboardEntry[];
  meId: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(d: T) => {
      disposables.push(d);
      return d;
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    wrap.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ee, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(3, 7, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    scene.add(sun);

    const stage = new THREE.Group();
    scene.add(stage);

    // Ground that only receives the shadows.
    const groundMat = track(new THREE.ShadowMaterial({ opacity: 0.12 }));
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(20, 20)), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    stage.add(ground);

    const blockGeo = (h: number) => track(new RoundedBoxGeometry(1.8, h, 1.8, 4, 0.08));
    const coinGeo = track(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 56));
    coinGeo.rotateX(Math.PI / 2); // face the camera
    const ringGeo = track(new THREE.TorusGeometry(0.34, 0.025, 12, 56));

    const coins: { group: THREE.Group; baseY: number }[] = [];

    podium.forEach((entry, i) => {
      const slot = SLOTS[i];
      const mine = meId !== null && String(entry.id) === meId;

      const blockMat = track(
        new THREE.MeshStandardMaterial({
          color: mine ? 0xd9dbfb : 0xf1f2f6,
          roughness: 0.55,
          metalness: 0.05,
        })
      );
      const block = new THREE.Mesh(blockGeo(slot.height), blockMat);
      block.position.set(slot.x, slot.height / 2, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      stage.add(block);

      const metal = track(
        new THREE.MeshStandardMaterial({ color: slot.color, metalness: 0.85, roughness: 0.28 })
      );
      const group = new THREE.Group();
      const coin = new THREE.Mesh(coinGeo, metal);
      coin.castShadow = true;
      const ring = new THREE.Mesh(ringGeo, metal);
      ring.position.z = 0.06;
      const ringBack = ring.clone();
      ringBack.position.z = -0.06;
      group.add(coin, ring, ringBack);

      const baseY = slot.height + 0.95;
      group.position.set(slot.x, baseY, 0);
      group.rotation.y = i * 1.1;
      stage.add(group);
      coins.push({ group, baseY });
    });

    // Subtle pointer parallax.
    let targetRot = 0;
    const onPointer = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      targetRot = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    };
    wrap.addEventListener("pointermove", onPointer);

    const v = new THREE.Vector3();
    let w = 1;
    let h = 1;

    const resize = () => {
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.position.set(0, 3.4, Math.max(8.5, 11.5 / camera.aspect));
      camera.lookAt(0, 1.7, 0);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;

    const frame = () => {
      const t = clock.getElapsedTime();

      if (!reduceMotion) {
        stage.rotation.y += (targetRot - stage.rotation.y) * 0.05;
        coins.forEach(({ group, baseY }, i) => {
          group.rotation.y = t * 1.1 + i * 1.1;
          group.position.y = baseY + Math.sin(t * 1.5 + i) * 0.08;
        });
      }

      renderer.render(scene, camera);

      // Pin the HTML labels above each coin.
      coins.forEach(({ group }, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        v.set(group.position.x, group.position.y + 0.75, 0);
        stage.localToWorld(v);
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        el.style.opacity = "1";
      });

      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointermove", onPointer);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [podium, meId]);

  return (
    <div
      ref={wrapRef}
      className="relative h-[340px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-100 sm:h-[400px]"
      role="img"
      aria-label={`Top three: ${podium.map((p, i) => `${SLOTS[i].label} ${p.username}`).join(", ")}`}
    >
      <div className="pointer-events-none absolute inset-0">
        {podium.map((entry, i) => {
          const mine = meId !== null && String(entry.id) === meId;
          return (
            <div
              key={entry.id}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              style={{ opacity: 0 }}
              className={`absolute left-0 top-0 flex items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5 shadow-md ${
                mine ? "border-[#4F46E5]" : "border-gray-200"
              }`}
            >
              <Avatar entry={entry} size="h-8 w-8" />
              <div className="max-w-[96px] sm:max-w-[140px]">
                <p className="truncate text-xs font-semibold text-gray-900">
                  {entry.username}
                  {mine && <span className="ml-1 text-[10px] font-medium text-[#4F46E5]">You</span>}
                </p>
                <p className="text-[11px] tabular-nums text-gray-500">
                  <span className={`${display.className} text-sm font-bold text-gray-900`}>
                    {formatScore(entry.top_score)}
                  </span>{" "}
                  <span className={SLOTS[i].text}>{SLOTS[i].label}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await getLeaderboard();
      setEntries(res.leaderboard);
      setPhase("loaded");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load leaderboard");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const meId = user?.id != null ? String(user.id) : null;
  const podium = useMemo(() => entries.slice(0, 3), [entries]);
  const rest = useMemo(() => entries.slice(3), [entries]);

  const tiedRanks = useMemo(() => {
    const counts = new Map<number, number>();
    entries.forEach((e) => counts.set(e.rank, (counts.get(e.rank) ?? 0) + 1));
    return new Set([...counts].filter(([, c]) => c > 1).map(([r]) => r));
  }, [entries]);

  const myIndex = meId ? entries.findIndex((e) => String(e.id) === meId) : -1;
  const me = myIndex >= 0 ? entries[myIndex] : null;
  const gap =
    me && myIndex > 0 ? Math.max(0, (entries[myIndex - 1].top_score || 0) - (me.top_score || 0)) : 0;

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gray-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <p className="text-sm font-semibold text-gray-900">Couldn&apos;t load the leaderboard</p>
        <p className="mt-1 text-sm text-gray-500">{errorMsg}</p>
        <button
          onClick={load}
          className="mt-5 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <header className="mb-8 text-center">
          <h1 className={`${display.className} text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl`}>
            Leaderboard
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {me
              ? `You're ${tiedRanks.has(me.rank) ? "tied for " : ""}#${me.rank}${
                  gap > 0 ? `, ${gap.toLocaleString("en-US")} pts behind the player above` : ""
                }`
              : `${entries.length} ${entries.length === 1 ? "player" : "players"} ranked by best score`}
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-900">No scores yet</p>
            <p className="mt-1 text-sm text-gray-500">Play a game to take the first spot.</p>
          </div>
        ) : (
          <>
            <PodiumScene podium={podium} meId={meId} />

            {rest.length > 0 && (
              <ol className="mt-8 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {rest.map((entry) => {
                  const mine = meId !== null && String(entry.id) === meId;
                  const tied = tiedRanks.has(entry.rank);
                  return (
                    <li
                      key={entry.id}
                      className={`flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 ${
                        mine ? "bg-[#4F46E5]/[0.06]" : ""
                      }`}
                    >
                      <span
                        className={`${display.className} w-8 shrink-0 text-center text-sm font-bold tabular-nums text-gray-500`}
                        title={tied ? "Tied rank" : undefined}
                      >
                        {tied && <span className="text-[10px] font-medium text-gray-400">T</span>}
                        {entry.rank}
                      </span>

                      <div className="relative shrink-0">
                        <Avatar entry={entry} size="h-9 w-9" />
                        {entry.is_online && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"
                            title="Online"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {entry.username}
                          {mine && (
                            <span className="ml-2 rounded-full bg-[#4F46E5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#4F46E5]">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs tabular-nums text-gray-400">
                          Level {entry.level} · {entry.xp.toLocaleString("en-US")} XP
                        </p>
                      </div>

                      <span
                        className={`${display.className} text-base font-bold tabular-nums ${
                          entry.top_score > 0 ? "text-gray-900" : "text-gray-300"
                        }`}
                      >
                        {formatScore(entry.top_score)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}