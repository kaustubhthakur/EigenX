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

const mix = (hex: string, to: number, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * amt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Square canvas texture that can be repainted (used once the web font has loaded). */
function canvasTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, s: number) => void,
  anisotropy: number
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  const repaint = () => {
    ctx.clearRect(0, 0, size, size);
    paint(ctx, size);
    tex.needsUpdate = true;
  };
  repaint();
  return { tex, repaint };
}

const paintMedalFace = (n: string, font: string) => (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#d6d6d6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#b0b0b0";
  ctx.lineWidth = s * 0.012;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = s * 0.006;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.405, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `700 ${s * 0.54}px ${font}, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText(n, s / 2, s / 2 + s * 0.03);
};

const paintPlate = (n: string, font: string, hex: string) => (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.font = `700 ${s * 0.8}px ${font}, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const g = ctx.createLinearGradient(0, s * 0.12, 0, s * 0.88);
  g.addColorStop(0, mix(hex, 255, 0.4));
  g.addColorStop(1, mix(hex, 0, 0.1));
  ctx.fillStyle = g;
  ctx.fillText(n, s / 2, s / 2 + s * 0.04);
};

const paintGlow = (hex: string) => (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, rgba(hex, 0.5));
  g.addColorStop(0.5, rgba(hex, 0.14));
  g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
};

const paintBlob = (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(30,27,75,0.30)");
  g.addColorStop(0.6, "rgba(30,27,75,0.08)");
  g.addColorStop(1, "rgba(30,27,75,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
};

const paintDot = (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
};

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

    let cancelled = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fontFamily = display.style.fontFamily;
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(d: T) => {
      disposables.push(d);
      return d;
    };
    const repaints: (() => void)[] = [];

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
    const aniso = renderer.capabilities.getMaxAnisotropy();

    const makeTex = (size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void) => {
      const r = canvasTexture(size, paint, aniso);
      track(r.tex);
      repaints.push(r.repaint);
      return r.tex;
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

    // Studio-style reflections so the metal reads as real gold, silver and bronze.
    const pmrem = track(new THREE.PMREMGenerator(renderer));
    const envRT = track(pmrem.fromScene(new RoomEnvironment(), 0.04));
    scene.environment = envRT.texture;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe4e7f2, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 7, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 5;
    sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    scene.add(sun);

    const stage = new THREE.Group();
    scene.add(stage);

    // Ground that only receives the shadows, plus a soft contact shadow under each pedestal.
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(20, 20)),
      track(new THREE.ShadowMaterial({ opacity: 0.07 }))
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    stage.add(ground);

    const blobGeo = track(new THREE.PlaneGeometry(3.4, 3.4));
    const blobMat = track(
      new THREE.MeshBasicMaterial({ map: makeTex(256, paintBlob), transparent: true, depthWrite: false })
    );

    // Shared geometry.
    const R = 0.95;
    const bodyGeo = (h: number) => track(new THREE.CylinderGeometry(R, R, h, 96));
    const plinthGeo = track(new THREE.CylinderGeometry(R + 0.06, R + 0.1, 0.08, 96));
    const rimGeo = track(new THREE.TorusGeometry(R - 0.035, 0.05, 20, 96));
    const bandGeo = track(new THREE.TorusGeometry(R + 0.004, 0.022, 16, 96));
    const inlayGeo = track(new THREE.TorusGeometry(0.62, 0.014, 12, 96));
    const medalBodyGeo = track(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 64));
    medalBodyGeo.rotateX(Math.PI / 2); // face the camera
    const medalRimGeo = track(new THREE.TorusGeometry(0.47, 0.05, 20, 64));
    const faceGeo = track(new THREE.CircleGeometry(0.425, 64));
    const orbitGeo = track(new THREE.TorusGeometry(0.86, 0.006, 8, 160));
    const beadGeo = track(new THREE.SphereGeometry(0.035, 20, 20));
    const glowGeo = track(new THREE.PlaneGeometry(2.6, 2.6));
    const dotTex = makeTex(64, paintDot);

    type Medal = {
      float: THREE.Group;
      spin: THREE.Group;
      precess: THREE.Group;
      bead: THREE.Group;
      baseY: number;
    };
    const medals: Medal[] = [];

    podium.forEach((entry, i) => {
      const slot = SLOTS[i];
      const h = slot.height;
      const mine = meId !== null && String(entry.id) === meId;

      const ceramic = track(
        new THREE.MeshPhysicalMaterial({
          color: mine ? 0xe4e6ff : 0xffffff,
          roughness: 0.5,
          metalness: 0,
          clearcoat: 0.6,
          clearcoatRoughness: 0.35,
          envMapIntensity: 0.5,
        })
      );
      const plinthMat = track(
        new THREE.MeshStandardMaterial({ color: 0xe6e8f1, roughness: 0.6, envMapIntensity: 0.4 })
      );
      const metal = track(
        new THREE.MeshStandardMaterial({
          color: slot.color,
          metalness: 0.92,
          roughness: 0.24,
          emissive: slot.color,
          emissiveIntensity: 0.1,
        })
      );

      // Pedestal: ceramic cylinder, rounded top lip, medal-colored band and inlay.
      const ped = new THREE.Group();
      ped.position.x = slot.x;
      const body = new THREE.Mesh(bodyGeo(h), ceramic);
      body.position.y = h / 2;
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.y = 0.04;
      const rim = new THREE.Mesh(rimGeo, ceramic);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = h;
      const band = new THREE.Mesh(bandGeo, metal);
      band.rotation.x = Math.PI / 2;
      band.position.y = h - 0.22;
      const inlay = new THREE.Mesh(inlayGeo, metal);
      inlay.rotation.x = Math.PI / 2;
      inlay.position.y = h + 0.006;
      [body, plinth, rim, band, inlay].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
      });
      ped.add(body, plinth, rim, band, inlay);

      // Place number wrapped onto the front of the pedestal.
      const plateH = Math.min(0.85, h * 0.5);
      const plateLen = plateH / R;
      const plate = new THREE.Mesh(
        track(new THREE.CylinderGeometry(R + 0.004, R + 0.004, plateH, 48, 1, true, -plateLen / 2, plateLen)),
        track(
          new THREE.MeshBasicMaterial({
            map: makeTex(512, paintPlate(slot.n, fontFamily, slot.hex)),
            transparent: true,
            depthWrite: false,
          })
        )
      );
      plate.position.y = (h - 0.3) / 2;
      ped.add(plate);
      stage.add(ped);

      const blob = new THREE.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(slot.x, 0.003, 0.05);
      stage.add(blob);

      // Medal: beveled disc with engraved number, soft glow, and an orbiting ring.
      const faceMat = track(
        new THREE.MeshStandardMaterial({
          color: slot.color,
          map: makeTex(1024, paintMedalFace(slot.n, fontFamily)),
          metalness: 0.9,
          roughness: 0.28,
        })
      );
      const spin = new THREE.Group();
      const medalBody = new THREE.Mesh(medalBodyGeo, metal);
      const medalRim = new THREE.Mesh(medalRimGeo, metal);
      const faceF = new THREE.Mesh(faceGeo, faceMat);
      faceF.position.z = 0.0505;
      const faceB = new THREE.Mesh(faceGeo, faceMat);
      faceB.position.z = -0.0505;
      faceB.rotation.y = Math.PI;
      [medalBody, medalRim].forEach((m) => (m.castShadow = true));
      spin.add(medalBody, medalRim, faceF, faceB);
      spin.rotation.y = reduceMotion ? (i - 1) * 0.3 : i * 1.1;

      const glow = new THREE.Mesh(
        glowGeo,
        track(
          new THREE.MeshBasicMaterial({
            map: makeTex(256, paintGlow(slot.hex)),
            transparent: true,
            depthWrite: false,
          })
        )
      );
      glow.position.z = -0.35;

      const precess = new THREE.Group();
      const tilt = new THREE.Group();
      tilt.rotation.x = 1.2 + i * 0.08;
      const orbit = new THREE.Mesh(orbitGeo, metal);
      const bead = new THREE.Group();
      const beadMesh = new THREE.Mesh(beadGeo, metal);
      beadMesh.position.x = 0.86;
      bead.add(beadMesh);
      tilt.add(orbit, bead);
      precess.add(tilt);
      precess.rotation.y = i;

      const float = new THREE.Group();
      const baseY = h + 0.98;
      float.position.set(slot.x, baseY, 0);
      float.add(glow, spin, precess);
      stage.add(float);
      medals.push({ float, spin, precess, bead, baseY });
    });

    // Slow rising gold dust around the podium.
    const SPARKS = 40;
    const sparkGeo = track(new THREE.BufferGeometry());
    const sparkPos = new Float32Array(SPARKS * 3);
    const sparkBaseX = new Float32Array(SPARKS);
    const sparkSpeed = new Float32Array(SPARKS);
    const sparkPhase = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) {
      sparkBaseX[i] = (Math.random() - 0.5) * 6;
      sparkPos[i * 3] = sparkBaseX[i];
      sparkPos[i * 3 + 1] = 1 + Math.random() * 3.8;
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
      sparkSpeed[i] = 0.08 + Math.random() * 0.14;
      sparkPhase[i] = Math.random() * Math.PI * 2;
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(
      sparkGeo,
      track(
        new THREE.PointsMaterial({
          map: dotTex,
          color: 0xe2b93b,
          size: 0.07,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        })
      )
    );
    stage.add(sparks);

    // Redraw the numerals once the web font is ready so they are crisp.
    document.fonts
      .load(`700 64px ${fontFamily}`)
      .then(() => {
        if (!cancelled) repaints.forEach((r) => r());
      })
      .catch(() => {});

    // Subtle pointer parallax, with a slow idle sway when nobody is hovering.
    let targetRot = 0;
    let pointerActive = false;
    const onPointer = (e: PointerEvent) => {
      pointerActive = true;
      const r = wrap.getBoundingClientRect();
      targetRot = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    };
    const onLeave = () => {
      pointerActive = false;
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
      camera.position.set(0, 3.6, Math.max(9.6, 13 / camera.aspect));
      camera.lookAt(0, 2.0, 0);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;
    let last = 0;

    const frame = () => {
      const t = clock.getElapsedTime();
      const dt = Math.min(t - last, 0.05);
      last = t;

      if (!reduceMotion) {
        const sway = pointerActive ? 0 : Math.sin(t * 0.45) * 0.12;
        stage.rotation.y += (targetRot + sway - stage.rotation.y) * 0.05;
        medals.forEach((m, i) => {
          m.float.position.y = m.baseY + Math.sin(t * 1.5 + i) * 0.08;
          m.spin.rotation.y = t * 0.9 + i * 1.1;
          m.precess.rotation.y = t * 0.25 + i;
          m.bead.rotation.z = t * 1.4 + i * 2;
        });
        const pos = sparkGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < SPARKS; i++) {
          let y = pos.getY(i) + sparkSpeed[i] * dt;
          if (y > 4.8) y = 1;
          pos.setY(i, y);
          pos.setX(i, sparkBaseX[i] + Math.sin(t * 0.6 + sparkPhase[i]) * 0.12);
        }
        pos.needsUpdate = true;
      }

      renderer.render(scene, camera);

      // Pin the HTML labels above each medal, kept inside the frame.
      medals.forEach(({ float }, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        v.set(float.position.x, float.position.y + 0.98, 0);
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
      cancelled = true;
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
      className="relative h-[380px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-[radial-gradient(ellipse_at_50%_0%,#EEF0FF_0%,#FFFFFF_55%,#F3F4F8_100%)] shadow-sm sm:h-[440px]"
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
        <div className="mt-6 h-[360px] rounded-2xl border border-gray-200 bg-white sm:h-[440px]" />
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