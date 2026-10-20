"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Space_Grotesk } from "next/font/google";
import { getLeaderboard, resolveAvatarUrl, type LeaderboardEntry } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import DuelScene from "../../components/DuelScene";

// Used for the numerals only (scores, ranks and the 3D medals).
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

type Phase = "loading" | "loaded" | "error";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const glass =
  "rounded-2xl bg-slate-900/60 ring-1 ring-white/10 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]";

// Index = place (0 = first). x position and block height in scene units.
const SLOTS = [
  { label: "1st", n: "1", x: 0, height: 2.0, color: 0xe2b93b, hex: "#E2B93B", text: "text-amber-300", dot: "bg-[#E2B93B]" },
  { label: "2nd", n: "2", x: -2.1, height: 1.4, color: 0xc4cad6, hex: "#C4CAD6", text: "text-slate-300", dot: "bg-[#C4CAD6]" },
  { label: "3rd", n: "3", x: 2.1, height: 0.9, color: 0xcd8b5a, hex: "#CD8B5A", text: "text-orange-300", dot: "bg-[#CD8B5A]" },
];

const formatScore = (n: number | null | undefined) =>
  n && n > 0 ? n.toLocaleString("en-US") : "—";

const mix = (hex: string, to: number, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * amt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/* ------------------------------------------------------------------ */
/* 3D helpers (unchanged logic)                                        */
/* ------------------------------------------------------------------ */

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

/** Fine grain used as a roughness map so the ceramic reflects unevenly, like a real surface. */
function grainTexture(anisotropy: number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 175 + Math.random() * 80;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 3);
  tex.anisotropy = anisotropy;
  return tex;
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

/** Height map for the medal face: the rings and numeral read as raised metal. */
const paintMedalBump = (n: string, font: string) => (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = s * 0.016;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = s * 0.008;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.405, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `700 ${s * 0.54}px ${font}, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
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

/** Soft ground shadow. A wide faint one plus a tight dark one gives believable contact shading. */
const paintBlob = (alpha: number) => (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, `rgba(0,0,10,${alpha})`);
  g.addColorStop(0.65, `rgba(0,0,10,${alpha * 0.5})`);
  g.addColorStop(1, "rgba(0,0,10,0)");
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

/** Soft indigo glow painted on the floor under the podium. */
const paintGlow = (ctx: CanvasRenderingContext2D, s: number) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(129,140,248,0.55)");
  g.addColorStop(0.5, "rgba(99,102,241,0.18)");
  g.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
};

const PED_R = 0.95;
const MEDAL_R = 0.47;

function pedestalGeometry(h: number) {
  const R = PED_R;
  const lip = 0.12;
  const pts: THREE.Vector2[] = [];
  const P = (x: number, y: number) => pts.push(new THREE.Vector2(x, y));
  P(0, 0);
  P(R + 0.1, 0);
  P(R + 0.1, 0.05);
  P(R + 0.085, 0.09);
  P(R + 0.04, 0.11);
  P(R, 0.15);
  P(R, h - lip);
  const steps = 10;
  for (let k = 1; k <= steps; k++) {
    const a = (k / steps) * (Math.PI / 2);
    P(R - lip + Math.cos(a) * lip, h - lip + Math.sin(a) * lip);
  }
  P(0, h);
  return new THREE.LatheGeometry(pts, 128);
}

function coinGeometry() {
  const R = MEDAL_R;
  const t = 0.06; // rim half-thickness
  const tf = 0.038; // field half-thickness
  const rf = 0.4; // field radius
  const bevel = 0.016;
  const pts: THREE.Vector2[] = [];
  const P = (x: number, y: number) => pts.push(new THREE.Vector2(x, y));
  P(0, -tf);
  P(rf, -tf);
  P(rf + 0.03, -t);
  P(R - bevel, -t);
  P(R, -t + bevel);
  P(R, t - bevel);
  P(R - bevel, t);
  P(rf + 0.03, t);
  P(rf, tf);
  P(0, tf);

  const geo = new THREE.LatheGeometry(pts, 192);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const RIDGES = 48;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (Math.hypot(x, z) > R - 1e-4) {
      const k = 1 + 0.02 * Math.cos(Math.atan2(z, x) * RIDGES);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
  }
  geo.computeVertexNormals();
  geo.rotateX(Math.PI / 2); // coin faces the camera
  return geo;
}

/* ------------------------------------------------------------------ */
/* UI pieces                                                           */
/* ------------------------------------------------------------------ */

function Avatar({ entry, size }: { entry: LeaderboardEntry; size: string }) {
  const url = resolveAvatarUrl(entry.avatar);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white/10`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white ring-2 ring-white/10`}
    >
      {entry.username?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

function YouBadge() {
  return (
    <span className="shrink-0 rounded-full bg-indigo-400/15 px-1.5 py-px text-[10px] font-medium text-indigo-200 ring-1 ring-inset ring-indigo-300/30">
      You
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#070815] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_30%,rgba(99,102,241,0.22),transparent),radial-gradient(40%_35%_at_90%_95%,rgba(34,211,238,0.12),transparent)]"
      />
      <DuelScene focus="center" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

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
    renderer.setClearColor(0x000000, 0);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
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

    const pmrem = track(new THREE.PMREMGenerator(renderer));
    const envRT = track(pmrem.fromScene(new RoomEnvironment(), 0.04));
    scene.environment = envRT.texture;

    scene.add(new THREE.HemisphereLight(0xdde3ff, 0x1a1c3a, 0.4));
    const key = new THREE.DirectionalLight(0xfff3e0, 2.1);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 2, far: 22 });
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa5b4fc, 1.1);
    rim.position.set(-5, 4, -4);
    scene.add(rim);

    const stage = new THREE.Group();
    scene.add(stage);

    // Indigo glow on the floor, then shadows on top of it.
    const glowGeo = track(new THREE.PlaneGeometry(10, 5));
    const glowMat = track(
      new THREE.MeshBasicMaterial({
        map: makeTex(256, paintGlow),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.001, 0);
    stage.add(glow);

    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(20, 20)),
      track(new THREE.ShadowMaterial({ opacity: 0.45 }))
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    stage.add(ground);

    const blobWideGeo = track(new THREE.PlaneGeometry(3.8, 3.8));
    const blobWideMat = track(
      new THREE.MeshBasicMaterial({
        map: makeTex(256, paintBlob(0.35)),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const blobTightGeo = track(new THREE.PlaneGeometry(2.9, 2.9));
    const blobTightMat = track(
      new THREE.MeshBasicMaterial({
        map: makeTex(256, paintBlob(0.6)),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      })
    );

    // Shared geometry and textures.
    const bandGeo = track(new THREE.TorusGeometry(PED_R + 0.004, 0.02, 16, 128));
    const inlayGeo = track(new THREE.TorusGeometry(0.62, 0.014, 12, 128));
    const coinGeo = track(coinGeometry());
    const faceGeo = track(new THREE.CircleGeometry(0.395, 64));
    const grain = track(grainTexture(aniso));
    const dotTex = makeTex(64, paintDot);

    type Medal = { float: THREE.Group; spin: THREE.Group; baseY: number };
    const medals: Medal[] = [];

    podium.forEach((entry, i) => {
      const slot = SLOTS[i];
      const h = slot.height;
      const mine = meId !== null && String(entry.id) === meId;

      const ceramic = track(
        new THREE.MeshPhysicalMaterial({
          color: mine ? 0xcdd1ff : 0xe4e6f2,
          roughness: 0.5,
          roughnessMap: grain,
          metalness: 0,
          clearcoat: 0.5,
          clearcoatRoughness: 0.28,
          envMapIntensity: 0.55,
        })
      );
      const metal = track(
        new THREE.MeshPhysicalMaterial({
          color: slot.color,
          metalness: 1,
          roughness: 0.22,
          clearcoat: 0.25,
          clearcoatRoughness: 0.2,
          envMapIntensity: 1.25,
        })
      );

      const ped = new THREE.Group();
      ped.position.x = slot.x;
      const body = new THREE.Mesh(track(pedestalGeometry(h)), ceramic);
      const band = new THREE.Mesh(bandGeo, metal);
      band.rotation.x = Math.PI / 2;
      band.position.y = h - 0.26;
      const inlay = new THREE.Mesh(inlayGeo, metal);
      inlay.rotation.x = Math.PI / 2;
      inlay.position.y = h + 0.004;
      [body, band, inlay].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
      });
      ped.add(body, band, inlay);

      const plateH = Math.min(0.85, h * 0.5);
      const plateLen = plateH / PED_R;
      const plate = new THREE.Mesh(
        track(
          new THREE.CylinderGeometry(PED_R + 0.004, PED_R + 0.004, plateH, 48, 1, true, -plateLen / 2, plateLen)
        ),
        track(
          new THREE.MeshStandardMaterial({
            map: makeTex(512, paintPlate(slot.n, fontFamily, slot.hex)),
            transparent: true,
            depthWrite: false,
            metalness: 0.85,
            roughness: 0.32,
            envMapIntensity: 1.1,
          })
        )
      );
      plate.position.y = (h - 0.12) / 2;
      plate.receiveShadow = true;
      ped.add(plate);
      stage.add(ped);

      const blobWide = new THREE.Mesh(blobWideGeo, blobWideMat);
      blobWide.rotation.x = -Math.PI / 2;
      blobWide.position.set(slot.x, 0.002, 0.05);
      const blobTight = new THREE.Mesh(blobTightGeo, blobTightMat);
      blobTight.rotation.x = -Math.PI / 2;
      blobTight.position.set(slot.x, 0.003, 0.02);
      stage.add(blobWide, blobTight);

      const faceTex = makeTex(1024, paintMedalFace(slot.n, fontFamily));
      const bumpTex = makeTex(1024, paintMedalBump(slot.n, fontFamily));
      bumpTex.colorSpace = THREE.NoColorSpace;
      const faceMat = track(
        new THREE.MeshPhysicalMaterial({
          color: slot.color,
          map: faceTex,
          bumpMap: bumpTex,
          bumpScale: 0.6,
          metalness: 1,
          roughness: 0.3,
          envMapIntensity: 1.25,
        })
      );
      const spin = new THREE.Group();
      const coin = new THREE.Mesh(coinGeo, metal);
      coin.castShadow = true;
      const faceF = new THREE.Mesh(faceGeo, faceMat);
      faceF.position.z = 0.039;
      const faceB = new THREE.Mesh(faceGeo, faceMat);
      faceB.position.z = -0.039;
      faceB.rotation.y = Math.PI;
      spin.add(coin, faceF, faceB);
      spin.rotation.y = reduceMotion ? (i - 1) * 0.3 : i * 1.1;

      const float = new THREE.Group();
      const baseY = h + 0.98;
      float.position.set(slot.x, baseY, 0);
      float.add(spin);
      stage.add(float);
      medals.push({ float, spin, baseY });
    });

    // Faint motes drifting up through the light.
    const SPARKS = 28;
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
      sparkSpeed[i] = 0.06 + Math.random() * 0.1;
      sparkPhase[i] = Math.random() * Math.PI * 2;
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(
      sparkGeo,
      track(
        new THREE.PointsMaterial({
          map: dotTex,
          color: 0xf0d27a,
          size: 0.055,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          toneMapped: false,
        })
      )
    );
    stage.add(sparks);

    document.fonts
      .load(`700 64px ${fontFamily}`)
      .then(() => {
        if (!cancelled) repaints.forEach((r) => r());
      })
      .catch(() => {});

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

      // Keep the HTML name tags pinned above each medal.
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
      className="relative h-[380px] w-full sm:h-[440px]"
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
              className={`absolute left-0 top-0 flex items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 backdrop-blur-xl transition-opacity duration-500 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] ${
                mine
                  ? "bg-indigo-950/80 ring-indigo-300/40"
                  : "bg-slate-900/80 ring-white/15"
              }`}
            >
              <Avatar entry={entry} size="h-8 w-8 sm:h-9 sm:w-9" />
              <div className="max-w-[88px] sm:max-w-[140px]">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <span className="truncate">{entry.username}</span>
                  {mine && <YouBadge />}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span className={`${display.className} text-sm font-bold leading-none text-white`}>
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


function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  rank: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  score: "M12 3v3m0 12v3M3 12h3m12 0h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  chase: "M7 17 17 7M9 7h8v8",
  level: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8",
  search: "m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4",
};

type Stat = { label: string; value: string; hint?: string; icon: string; accent?: boolean };

function StatCards({ items }: { items: Stat[] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={`${glass} p-4 sm:p-5`}>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs font-medium text-slate-400">{item.label}</dt>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                item.accent
                  ? "bg-indigo-400/15 text-indigo-200 ring-indigo-300/30"
                  : "bg-white/[0.05] text-slate-400 ring-white/10"
              }`}
            >
              <Icon d={item.icon} />
            </span>
          </div>
          <dd
            className={`${display.className} mt-3 truncate text-2xl font-bold tabular-nums ${
              item.accent
                ? "bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent"
                : "text-white"
            }`}
          >
            {item.value}
          </dd>
          {item.hint && <p className="mt-1 truncate text-xs text-slate-500">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

function Skeleton() {
  return (
    <Shell>
      <div
        className="mx-auto max-w-5xl animate-pulse px-4 py-10 sm:px-6 sm:py-14"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="h-9 w-48 rounded-lg bg-white/10" />
        <div className="mt-3 h-4 w-64 rounded bg-white/10" />
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] rounded-2xl bg-white/5 ring-1 ring-white/10" />
          ))}
        </div>
        <div className="mt-6 h-[420px] rounded-2xl bg-white/[0.03] ring-1 ring-white/10 sm:h-[480px]" />
        <div className="mt-6 space-y-px overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-4 w-6 rounded bg-white/10" />
              <div className="h-9 w-9 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-white/10" />
                <div className="h-2.5 w-24 rounded bg-white/10" />
              </div>
              <div className="h-4 w-10 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const cols =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:grid-cols-[3.5rem_minmax(0,1fr)_4.5rem_6rem_9rem] items-center gap-3 sm:gap-4";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "online">("all");

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

  /** Quiet refresh: keeps the page on screen instead of flashing the skeleton. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getLeaderboard();
      setEntries(res.leaderboard);
    } catch {
      /* keep what we have */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const meId = user?.id != null ? String(user.id) : null;
  const podium = useMemo(() => entries.slice(0, 3), [entries]);
  const rest = useMemo(() => entries.slice(3), [entries]);

  const onlineCount = useMemo(() => rest.filter((e) => e.is_online).length, [rest]);
  const visibleRest = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rest.filter(
      (e) =>
        (filter === "all" || e.is_online) &&
        (!q || (e.username || "").toLowerCase().includes(q))
    );
  }, [rest, query, filter]);

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
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-300 ring-1 ring-red-400/30">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <p className="mt-4 text-sm font-semibold text-white">Couldn&apos;t load the leaderboard</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{errorMsg}</p>
          <button
            onClick={load}
            className={`mt-5 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.7)] transition hover:brightness-110 ${focusRing}`}
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const stats: Stat[] = [
    me
      ? {
          label: "Your rank",
          value: `${tiedRanks.has(me.rank) ? "T" : ""}#${me.rank}`,
          hint: `of ${entries.length} players`,
          icon: ICONS.rank,
          accent: true,
        }
      : {
          label: "Players",
          value: entries.length.toLocaleString("en-US"),
          hint: "ranked",
          icon: ICONS.users,
          accent: true,
        },
    me
      ? { label: "Your best score", value: formatScore(me.top_score), hint: "all time", icon: ICONS.score }
      : { label: "Top score", value: formatScore(maxScore), icon: ICONS.score },
    me
      ? myIndex === 0
        ? { label: "Lead", value: "You’re 1st", hint: "Keep it up", icon: ICONS.chase }
        : {
            label: "To pass next",
            value: gap > 0 ? `${gap.toLocaleString("en-US")} pts` : "Tied",
            hint: "behind the player above",
            icon: ICONS.chase,
          }
      : { label: "Leader", value: entries[0]?.username ?? "—", icon: ICONS.chase },
    me
      ? { label: "Level", value: String(me.level), hint: `${me.xp.toLocaleString("en-US")} XP`, icon: ICONS.level }
      : { label: "Podium", value: `${podium.length} of 3`, hint: "spots filled", icon: ICONS.level },
  ];

  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Leaderboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {entries.length > 0
                ? `${entries.length.toLocaleString("en-US")} ${entries.length === 1 ? "player" : "players"} ranked by best score`
                : "Rankings update as players finish games"}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={`inline-flex h-9 items-center gap-2 self-start rounded-lg bg-white/[0.05] px-3.5 text-sm font-medium text-slate-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-60 sm:self-auto ${focusRing}`}
          >
            <Icon d={ICONS.refresh} className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </header>

        {entries.length === 0 ? (
          <div className={`${glass} border border-dashed border-white/15 px-6 py-16 text-center`}>
            <p className="text-sm font-semibold text-white">No scores yet</p>
            <p className="mt-1 text-sm text-slate-400">Finish a game to claim the first spot.</p>
          </div>
        ) : (
          <>
            <StatCards items={stats} />

            <section className={`${glass} relative mb-6 overflow-hidden`}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(99,102,241,0.18),transparent_70%)]"
              />
              <div className="relative flex items-center justify-between px-4 pt-4 sm:px-5">
                <h2 className="text-sm font-semibold text-white">Top players</h2>
                <span className="text-xs text-slate-500">Hover to tilt the podium</span>
              </div>
              <PodiumScene podium={podium} meId={meId} />
            </section>

            {rest.length > 0 && (
              <section className={`overflow-hidden ${glass}`}>
                {/* Toolbar */}
                <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h2 className="text-sm font-semibold text-white">All players</h2>
                    <p className="text-xs text-slate-500">
                      Ranked 4th and below · {rest.length.toLocaleString("en-US")}{" "}
                      {rest.length === 1 ? "player" : "players"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      role="group"
                      aria-label="Filter players"
                      className="inline-flex rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-inset ring-white/10"
                    >
                      {(
                        [
                          { id: "all", label: "All", count: rest.length },
                          { id: "online", label: "Online", count: onlineCount },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={filter === t.id}
                          onClick={() => setFilter(t.id)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
                            filter === t.id
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          } ${focusRing}`}
                        >
                          {t.id === "online" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          )}
                          {t.label}
                          <span className="tabular-nums text-slate-500">{t.count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                        <Icon d={ICONS.search} />
                      </span>
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search players"
                        aria-label="Search players"
                        className="h-9 w-full rounded-lg bg-white/[0.05] pl-8 pr-3 text-sm text-white outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-slate-500 focus:bg-white/[0.07] focus:ring-cyan-300/60"
                      />
                    </div>
                  </div>
                </div>

                {/* Column headings */}
                <div
                  className={`${cols} border-b border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-slate-400 sm:px-5`}
                >
                  <span className="text-center">Rank</span>
                  <span>Player</span>
                  <span className="hidden sm:block">Level</span>
                  <span className="hidden sm:block">XP</span>
                  <span className="text-right">Best score</span>
                </div>

                {visibleRest.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <p className="text-sm font-semibold text-white">No players found</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Try a different name or switch the filter back to All.
                    </p>
                  </div>
                ) : (
                  <ol className="divide-y divide-white/5">
                    {visibleRest.map((entry) => {
                      const mine = meId !== null && String(entry.id) === meId;
                      const tied = tiedRanks.has(entry.rank);
                      const pct =
                        maxScore > 0 ? Math.max(2, ((entry.top_score || 0) / maxScore) * 100) : 0;
                      return (
                        <li
                          key={entry.id}
                          aria-current={mine ? "true" : undefined}
                          className={`relative px-4 py-3 transition-colors sm:px-5 ${cols} ${
                            mine ? "bg-indigo-400/10" : "hover:bg-white/[0.04]"
                          }`}
                        >
                          {mine && (
                            <span className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-indigo-400 to-cyan-300" />
                          )}

                          <span
                            className={`${display.className} flex items-center justify-center text-sm font-bold tabular-nums text-slate-400`}
                            title={tied ? "Tied rank" : undefined}
                          >
                            {tied ? (
                              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs text-slate-200">
                                T{entry.rank}
                              </span>
                            ) : (
                              entry.rank
                            )}
                          </span>

                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative shrink-0">
                              <Avatar entry={entry} size="h-9 w-9" />
                              {entry.is_online && (
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                                  title="Online"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                                <span className="truncate">{entry.username}</span>
                                {mine && <YouBadge />}
                              </p>
                              <p className="mt-0.5 text-xs tabular-nums text-slate-500 sm:hidden">
                                Level {entry.level} · {entry.xp.toLocaleString("en-US")} XP
                              </p>
                            </div>
                          </div>

                          <span className="hidden sm:block">
                            <span className="inline-flex rounded-md bg-white/[0.06] px-2 py-0.5 text-xs font-medium tabular-nums text-slate-200 ring-1 ring-inset ring-white/10">
                              Lv {entry.level}
                            </span>
                          </span>

                          <span className="hidden text-sm tabular-nums text-slate-300 sm:block">
                            {entry.xp.toLocaleString("en-US")}
                          </span>

                          <div className="text-right">
                            <span
                              className={`${display.className} text-base font-bold tabular-nums ${
                                entry.top_score > 0 ? "text-white" : "text-slate-600"
                              }`}
                            >
                              {formatScore(entry.top_score)}
                            </span>
                            {entry.top_score > 0 && (
                              <div className="ml-auto mt-1.5 hidden h-1 w-full overflow-hidden rounded-full bg-white/10 sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    mine
                                      ? "bg-gradient-to-r from-indigo-400 to-cyan-300"
                                      : "bg-slate-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="border-t border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-slate-500 sm:px-5">
                  Showing {visibleRest.length.toLocaleString("en-US")} of{" "}
                  {rest.length.toLocaleString("en-US")}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}