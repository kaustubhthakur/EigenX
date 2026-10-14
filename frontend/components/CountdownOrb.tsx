"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  remaining: number | null;
  total: number | null;
};

const SEGMENTS = 60;
const RADIUS = 2.4;
const INDIGO = new THREE.Color("#4f46e5");
const RED = new THREE.Color("#ef4444");
const IDLE = new THREE.Color("#e5e7eb");

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function CountdownOrb({ remaining, total }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Shared mutable state read by the render loop (no re-renders, no scene rebuilds)
  const state = useRef({
    remaining: null as number | null,
    total: null as number | null,
    changedAt: 0,
    urgent: false,
    urgentMix: 0,
    pulse: 0,
  });

  const urgent = remaining != null && remaining <= 5;

  useEffect(() => {
    const s = state.current;
    if (s.remaining !== null && remaining !== s.remaining) s.pulse = 1;
    s.remaining = remaining;
    s.total = total;
    s.urgent = urgent;
    s.changedAt = performance.now();
  }, [remaining, total, urgent]);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // WebGL unavailable: the numeric readout still works
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 4, 6);
    scene.add(key);

    const root = new THREE.Group();
    scene.add(root);

    // --- Segmented ring: one tick per 1/60th of the remaining time ---
    const ring = new THREE.Group();
    root.add(ring);

    const segGeo = new THREE.BoxGeometry(0.09, 0.4, 0.16);
    const segments: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const mat = new THREE.MeshStandardMaterial({
        color: IDLE,
        roughness: 0.35,
        metalness: 0.15,
        emissive: INDIGO,
        emissiveIntensity: 0,
      });
      const mesh = new THREE.Mesh(segGeo, mat);
      mesh.position.set(Math.sin(angle) * RADIUS, Math.cos(angle) * RADIUS, 0);
      mesh.rotation.z = -angle;
      ring.add(mesh);
      segments.push(mesh);
    }

    // --- Core: wireframe shell around a faceted gem ---
    const core = new THREE.Group();
    root.add(core);

    const shellGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const shellMat = new THREE.MeshBasicMaterial({
      color: INDIGO.clone(),
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });
    core.add(new THREE.Mesh(shellGeo, shellMat));

    const gemGeo = new THREE.IcosahedronGeometry(0.6, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: INDIGO.clone(),
      flatShading: true,
      roughness: 0.25,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9,
    });
    core.add(new THREE.Mesh(gemGeo, gemMat));

    // --- Ambient particles ---
    const COUNT = 70;
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const r = 3.1 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: INDIGO.clone(),
      size: 0.05,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    root.add(dust);

    // --- Sizing ---
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // --- Subtle pointer parallax ---
    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!reducedMotion) window.addEventListener("pointermove", onMove);

    // --- Loop ---
    const accent = new THREE.Color();
    const clock = new THREE.Clock();
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const s = state.current;

      // Continuous progress: interpolate within the current second
      let progress = 1;
      if (s.remaining != null && s.total) {
        const frac = clamp01((performance.now() - s.changedAt) / 1000);
        progress = clamp01((s.remaining - frac) / s.total);
      }

      // Ease toward the urgent palette
      s.urgentMix += ((s.urgent ? 1 : 0) - s.urgentMix) * (1 - Math.exp(-dt * 6));
      accent.copy(INDIGO).lerp(RED, s.urgentMix);

      // Ring: segments switch off from the end, the leading one glows
      const lit = progress * SEGMENTS;
      const head = Math.floor(lit);
      for (let i = 0; i < SEGMENTS; i++) {
        const seg = segments[i];
        const amount = clamp01(lit - i);
        seg.material.color.copy(IDLE).lerp(accent, amount);
        seg.material.emissive.copy(accent);
        seg.material.emissiveIntensity = 0.45 * amount + (i === head ? 0.35 : 0);
        const lift = i === head ? 0.3 : 0;
        seg.scale.set(1, 1 + 0.3 * amount + lift, 1 + 0.6 * amount);
      }

      // Tick pulse
      s.pulse *= Math.exp(-dt * 6);
      ring.scale.setScalar(1 + 0.035 * s.pulse);

      // Core + palette
      shellMat.color.copy(accent);
      gemMat.color.copy(accent);
      dustMat.color.copy(accent);

      if (!reducedMotion) {
        const speed = 0.35 + s.urgentMix * 0.9;
        core.rotation.y += dt * speed;
        core.rotation.x += dt * speed * 0.6;
        dust.rotation.y += dt * 0.06;

        const targetY = pointer.x * 0.35 + Math.sin(t * 0.5) * 0.05;
        const targetX = 0.35 + pointer.y * 0.2;
        root.rotation.y += (targetY - root.rotation.y) * (1 - Math.exp(-dt * 4));
        root.rotation.x += (targetX - root.rotation.x) * (1 - Math.exp(-dt * 4));
      } else {
        root.rotation.x = 0.35;
      }

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      segments.forEach((m) => m.material.dispose());
      segGeo.dispose();
      shellGeo.dispose();
      shellMat.dispose();
      gemGeo.dispose();
      gemMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Time remaining"
      aria-valuemin={0}
      aria-valuemax={total ?? 0}
      aria-valuenow={remaining ?? 0}
      className="relative mx-auto h-60 w-60"
    >
      <div ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-5xl font-bold tabular-nums tracking-tight transition-colors duration-300 ${
            urgent ? "text-red-600" : "text-gray-900"
          }`}
        >
          {remaining ?? "--"}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-400">
          seconds
        </span>
      </div>
    </div>
  );
}