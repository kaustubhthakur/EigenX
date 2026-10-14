"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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
  { label: "1st", n: "1", x: 0, height: 2.0, color: 0xe2b93b, hex: "#E2B93B", text: "text-[#8A6A00]", dot: "bg-[#E2B93B]" },
  { label: "2nd", n: "2", x: -2.1, height: 1.4, color: 0xc4cad6, hex: "#C4CAD6", text: "text-[#555C6B]", dot: "bg-[#C4CAD6]" },
  { label: "3rd", n: "3", x: 2.1, height: 0.9, color: 0xcd8b5a, hex: "#CD8B5A", text: "text-[#8F532B]", dot: "bg-[#CD8B5A]" },
];

const formatScore = (n: number | null | undefined) =>
  n && n > 0 ? n.toLocaleString("en-US") : "—";

/** Numeral drawn on a canvas, used for coin faces and the podium fronts. */
function numeralTexture(
  text: string,
  fontFamily: string,
  opts: { background?: string; fill: string }
) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.fillStyle = opts.fill;
  ctx.font = `700 ${size * 0.62}px ${fontFamily}, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Avatar({ entry, size }: { entry: LeaderboardEntry; size: string }) {
  const url = resolveAvatarUrl(entry.avatar);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`${size} shrink-0 rounded-full object-cover ring-1 ring-black/5`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-xs font-semibold text-gray-600 ring-1 ring-black/5`}
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
    const fontFamily = display.style.fontFamily;
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(d: T) => {
      disposables.push(d);
      return d;
    };

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // WebGL unavailable: the page still shows the names via the labels below.
      labelRefs.current.forEach((el) => el && (el.style.opacity = "1"));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    wrap.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

    // Studio-style reflections so the metal coins read as gold, silver and bronze.
    const pmrem = track(new THREE.PMREMGenerator(renderer));
    const envRT = track(pmrem.fromScene(new RoomEnvironment(), 0.04));
    scene.environment = envRT.texture;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe4e7f2, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(3, 7, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    scene.add(sun);

    const stage = new THREE.Group();
    scene.add(stage);

    // Ground that only receives the shadows.
    const groundMat = track(new THREE.ShadowMaterial({ opacity: 0.1 }));
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(20, 20)), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    stage.add(ground);

    const blockGeo = (h: number) => track(new RoundedBoxGeometry(1.8, h, 1.8, 5, 0.1));
    const capGeo = track(new RoundedBoxGeometry(1.86, 0.07, 1.86, 3, 0.03));
    const coinGeo = track(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 64));
    coinGeo.rotateX(Math.PI / 2); // face the camera
    const ringGeo = track(new THREE.TorusGeometry(0.4, 0.022, 12, 64));
    const faceGeo = track(new THREE.CircleGeometry(0.4, 48));
    const frontGeo = track(new THREE.PlaneGeometry(1.1, 1.1));

    const coins: { group: THREE.Group; baseY: number }[] = [];

    podium.forEach((entry, i) => {
      const slot = SLOTS[i];
      const mine = meId !== null && String(entry.id) === meId;

      const blockMat = track(
        new THREE.MeshStandardMaterial({
          color: mine ? 0xe3e4fc : 0xf7f8fb,
          roughness: 0.6,
          metalness: 0,
          envMapIntensity: 0.35,
        })
      );
      const block = new THREE.Mesh(blockGeo(slot.height), blockMat);
      block.position.set(slot.x, slot.height / 2, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      stage.add(block);

      // Thin medal-colored cap on top of the block.
      const metal = track(
        new THREE.MeshStandardMaterial({ color: slot.color, metalness: 0.9, roughness: 0.25 })
      );
      const cap = new THREE.Mesh(capGeo, metal);
      cap.position.set(slot.x, slot.height + 0.02, 0);
      cap.castShadow = true;
      stage.add(cap);

      // Place numeral on the front of the block.
      const frontTex = track(
        numeralTexture(slot.n, fontFamily, { fill: `${slot.hex}` })
      );
      const front = new THREE.Mesh(
        frontGeo,
        track(
          new THREE.MeshBasicMaterial({
            map: frontTex,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          })
        )
      );
      front.position.set(slot.x, Math.max(0.45, slot.height / 2 - 0.05), 0.906);
      stage.add(front);

      // Coin: metal body, raised rim, engraved place numeral on both faces.
      const faceTex = track(
        numeralTexture(slot.n, fontFamily, { background: "#ffffff", fill: "rgba(70,50,10,0.55)" })
      );
      const faceMat = track(
        new THREE.MeshStandardMaterial({
          color: slot.color,
          map: faceTex,
          metalness: 0.85,
          roughness: 0.3,
        })
      );
      const group = new THREE.Group();
      const coin = new THREE.Mesh(coinGeo, metal);
      coin.castShadow = true;
      const ring = new THREE.Mesh(ringGeo, metal);
      ring.position.z = 0.052;
      const ringBack = ring.clone();
      ringBack.position.z = -0.052;
      const faceFront = new THREE.Mesh(faceGeo, faceMat);
      faceFront.position.z = 0.0515;
      const faceBack = new THREE.Mesh(faceGeo, faceMat);
      faceBack.position.z = -0.0515;
      faceBack.rotation.y = Math.PI;
      group.add(coin, ring, ringBack, faceFront, faceBack);

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
    const onLeave = () => {
      targetRot = 0;
    };
    wrap.addEventListener("pointermove", onPointer);
    wrap.addEventListener("pointerleave", onLeave);

    const v = new THREE.Vector3();
    let w = 1;
    let h = 1;

    const resize = () => {
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.position.set(0, 3.2, Math.max(9, 12 / camera.aspect));
      camera.lookAt(0, 2.0, 0);
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

      // Pin the HTML labels above each coin, kept inside the frame.
      coins.forEach(({ group }, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        v.set(group.position.x, group.position.y + 0.72, 0);
        stage.localToWorld(v);
        v.project(camera);
        const lw = el.offsetWidth;
        const lh = el.offsetHeight;
        const x = Math.min(Math.max((v.x * 0.5 + 0.5) * w, lw / 2 + 8), w - lw / 2 - 8);
        const y = Math.max((-v.y * 0.5 + 0.5) * h, lh + 10);
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
      wrap.removeEventListener("pointerleave", onLeave);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [podium, meId]);

  return (
    <div
      ref={wrapRef}
      className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-[radial-gradient(ellipse_at_50%_0%,#EEF0FF_0%,#FFFFFF_55%,#F3F4F8_100%)] shadow-sm sm:h-[420px]"
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
              className={`absolute left-0 top-0 flex items-center gap-2.5 rounded-xl border bg-white/95 px-2.5 py-2 shadow-[0_6px_20px_-6px_rgba(17,24,39,0.2)] backdrop-blur transition-opacity duration-500 ${
                mine ? "border-[#4F46E5] ring-2 ring-[#4F46E5]/15" : "border-gray-200"
              }`}
            >
              <Avatar entry={entry} size="h-8 w-8 sm:h-9 sm:w-9" />
              <div className="max-w-[88px] sm:max-w-[140px]">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                  <span className="truncate">{entry.username}</span>
                  {mine && (
                    <span className="shrink-0 rounded-full bg-[#4F46E5]/10 px-1.5 py-px text-[10px] font-medium text-[#4F46E5]">
                      You
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span className={`${display.className} text-sm font-bold leading-none text-gray-900`}>
                    {formatScore(entry.top_score)}
                  </span>
                  <span className={`flex items-center gap-1 text-[11px] font-medium ${SLOTS[i].text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${SLOTS[i].dot}`} />
                    {SLOTS[i].label}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryStrip({
  items,
}: {
  items: { label: string; value: string; hint?: string; accent?: boolean }[];
}) {
  return (
    <dl className="mb-6 grid grid-cols-2 divide-x divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-4 py-3.5 sm:px-5 ${i > 1 ? "border-t border-gray-100 sm:border-t-0" : ""}`}
        >
          <dt className="text-xs font-medium text-gray-500">{item.label}</dt>
          <dd
            className={`${display.className} mt-1 text-xl font-bold tabular-nums ${
              item.accent ? "text-[#4F46E5]" : "text-gray-900"
            }`}
          >
            {item.value}
          </dd>
          {item.hint && <p className="mt-0.5 text-xs text-gray-400">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-gray-50" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-3xl animate-pulse px-4 py-12 sm:py-16">
        <div className="mx-auto h-9 w-48 rounded-lg bg-gray-200" />
        <div className="mx-auto mt-3 h-4 w-64 rounded bg-gray-200" />
        <div className="mt-8 h-20 rounded-xl border border-gray-200 bg-white" />
        <div className="mt-6 h-[360px] rounded-2xl border border-gray-200 bg-white sm:h-[420px]" />
        <div className="mt-8 space-y-px overflow-hidden rounded-xl border border-gray-200 bg-white">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-4 w-6 rounded bg-gray-100" />
              <div className="h-9 w-9 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-gray-100" />
                <div className="h-2.5 w-24 rounded bg-gray-100" />
              </div>
              <div className="h-4 w-10 rounded bg-gray-100" />
            </div>
          ))}
        </div>
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
  const maxScore = entries[0]?.top_score || 0;

  if (phase === "loading") return <Skeleton />;

  if (phase === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </span>
        <p className="mt-4 text-sm font-semibold text-gray-900">Couldn&apos;t load the leaderboard</p>
        <p className="mt-1 max-w-sm text-sm text-gray-500">{errorMsg}</p>
        <button
          onClick={load}
          className="mt-5 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  const summary = [
    me
      ? {
          label: "Your rank",
          value: `${tiedRanks.has(me.rank) ? "T" : ""}#${me.rank}`,
          hint: `of ${entries.length} players`,
          accent: true,
        }
      : { label: "Players", value: entries.length.toLocaleString("en-US"), hint: "ranked" },
    me
      ? { label: "Your best score", value: formatScore(me.top_score) }
      : { label: "Top score", value: formatScore(maxScore) },
    me
      ? myIndex === 0
        ? { label: "Lead", value: "You're 1st", hint: "Keep it up" }
        : { label: "To pass next", value: gap > 0 ? `${gap.toLocaleString("en-US")} pts` : "Tied", hint: "behind the player above" }
      : { label: "Leader", value: entries[0]?.username ?? "—" },
    me
      ? { label: "Level", value: String(me.level), hint: `${me.xp.toLocaleString("en-US")} XP` }
      : { label: "Podium", value: `${podium.length} of 3`, hint: "spots filled" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <header className="mb-8 text-center">
          <h1 className={`${display.className} text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl`}>
            Leaderboard
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {entries.length > 0
              ? `${entries.length.toLocaleString("en-US")} ${entries.length === 1 ? "player" : "players"} ranked by best score`
              : "Rankings update as players finish games"}
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">No scores yet</p>
            <p className="mt-1 text-sm text-gray-500">Finish a game to claim the first spot.</p>
          </div>
        ) : (
          <>
            <SummaryStrip items={summary} />

            <PodiumScene podium={podium} meId={meId} />

            {rest.length > 0 && (
              <section className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 text-xs font-medium text-gray-500 sm:gap-4 sm:px-5">
                  <span className="w-10 shrink-0 text-center">Rank</span>
                  <span className="flex-1">Player</span>
                  <span>Best score</span>
                </div>
                <ol className="divide-y divide-gray-100">
                  {rest.map((entry) => {
                    const mine = meId !== null && String(entry.id) === meId;
                    const tied = tiedRanks.has(entry.rank);
                    const pct = maxScore > 0 ? Math.max(2, ((entry.top_score || 0) / maxScore) * 100) : 0;
                    return (
                      <li
                        key={entry.id}
                        aria-current={mine ? "true" : undefined}
                        className={`relative flex items-center gap-3 px-4 py-3 transition-colors sm:gap-4 sm:px-5 ${
                          mine ? "bg-[#4F46E5]/[0.05]" : "hover:bg-gray-50"
                        }`}
                      >
                        {mine && <span className="absolute inset-y-0 left-0 w-0.5 bg-[#4F46E5]" />}

                        <span
                          className={`${display.className} flex w-10 shrink-0 items-center justify-center text-sm font-bold tabular-nums text-gray-500`}
                          title={tied ? "Tied rank" : undefined}
                        >
                          {tied ? (
                            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                              T{entry.rank}
                            </span>
                          ) : (
                            entry.rank
                          )}
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
                          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <span className="truncate">{entry.username}</span>
                            {mine && (
                              <span className="shrink-0 rounded-full bg-[#4F46E5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#4F46E5]">
                                You
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs tabular-nums text-gray-400">
                            <span>Level {entry.level}</span>
                            <span className="h-0.5 w-0.5 rounded-full bg-gray-300" />
                            <span>{entry.xp.toLocaleString("en-US")} XP</span>
                          </p>
                          {entry.top_score > 0 && (
                            <div className="mt-2 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-full rounded-full ${mine ? "bg-[#4F46E5]" : "bg-gray-300"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
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
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}