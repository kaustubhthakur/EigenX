"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  remaining: number | null;
  total: number | null;
};

const SEGMENTS = 60;
const RADIUS = 2.4;
const ACTIVE = new THREE.Color("#4f46e5");
const URGENT = new THREE.Color("#ef4444");
const IDLE = new THREE.Color("#e5e7eb");

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function CountdownOrb({ remaining, total }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const state = useRef({ remaining: null as number | null, total: null as number | null, changedAt: 0 });

  const urgent = remaining != null && remaining <= 5;

  useEffect(() => {
    state.current = { remaining, total, changedAt: performance.now() };
  }, [remaining, total]);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL: the number still shows
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    // Flat ring of ticks, starting at the top and going clockwise
    const geo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const ticks: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ACTIVE.clone() }));
      mesh.position.set(Math.sin(angle) * RADIUS, Math.cos(angle) * RADIUS, 0);
      mesh.rotation.z = -angle;
      scene.add(mesh);
      ticks.push(mesh);
    }

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

    const color = new THREE.Color();
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const s = state.current;

      // Smooth progress within the current second
      let progress = 1;
      if (s.remaining != null && s.total) {
        const frac = clamp01((performance.now() - s.changedAt) / 1000);
        progress = clamp01((s.remaining - frac) / s.total);
      }

      const isUrgent = s.remaining != null && s.remaining <= 5;
      const lit = progress * SEGMENTS;
      for (let i = 0; i < SEGMENTS; i++) {
        color.copy(IDLE).lerp(isUrgent ? URGENT : ACTIVE, clamp01(lit - i));
        ticks[i].material.color.copy(color);
      }

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ticks.forEach((t) => t.material.dispose());
      geo.dispose();
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
      className="relative mx-auto h-48 w-48"
    >
      <div ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className={`text-5xl font-bold tabular-nums tracking-tight transition-colors duration-300 ${
            urgent ? "text-red-600" : "text-gray-900"
          }`}
        >
          {remaining ?? "--"}
        </span>
      </div>
    </div>
  );
}