"use client";

import { useEffect, useRef } from "react";

/**
 * Shared Three.js background: a glowing Möbius strip.
 * Needs: npm i three && npm i -D @types/three
 *
 * focus="side"   -> strip sits on the right (lobby)
 * focus="center" -> strip sits behind the content (duel arena)
 * calm           -> fainter, for data-heavy pages (profile, leaderboard)
 */

const PALETTE = {
  surface: 0x8b5cf6, // violet wireframe
  dots: 0x34d399, // mint points on the strip
  edge: 0xfbbf24, // amber boundary line
  dust: 0xddd6fe,
};

export default function DuelScene({
  focus = "side",
  calm = false,
}: {
  focus?: "side" | "center";
  calm?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup: () => void = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed || !mount) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const k = calm ? 0.55 : 1;
      const center = focus === "center";

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.z = 14;

      const disposables: Array<{ dispose: () => void }> = [];

      /* Möbius strip geometry */
      const U = 180; // steps around the loop
      const V = 10; // steps across the width
      const R = 3.4; // loop radius
      const W = 1.3; // half width

      const positions = new Float32Array(U * (V + 1) * 3);
      for (let i = 0; i < U; i++) {
        const u = (i / U) * Math.PI * 2;
        for (let j = 0; j <= V; j++) {
          const v = (j / V - 0.5) * 2 * W;
          const r = R + v * Math.cos(u / 2);
          const idx = (i * (V + 1) + j) * 3;
          positions[idx] = r * Math.cos(u);
          positions[idx + 1] = r * Math.sin(u);
          positions[idx + 2] = v * Math.sin(u / 2);
        }
      }

      // The strip closes with a half twist, so the last column joins
      // the first with the width direction flipped.
      const indices: number[] = [];
      for (let i = 0; i < U; i++) {
        const next = (i + 1) % U;
        const flip = next === 0;
        for (let j = 0; j < V; j++) {
          const a = i * (V + 1) + j;
          const b = i * (V + 1) + j + 1;
          const c = next * (V + 1) + (flip ? V - j : j);
          const d = next * (V + 1) + (flip ? V - (j + 1) : j + 1);
          indices.push(a, b, c, b, d, c);
        }
      }

      const stripGeo = new THREE.BufferGeometry();
      stripGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      stripGeo.setIndex(indices);

      const strip = new THREE.Group();
      scene.add(strip);

      const wireMat = new THREE.MeshBasicMaterial({
        color: PALETTE.surface,
        wireframe: true,
        transparent: true,
        opacity: (center ? 0.22 : 0.38) * (calm ? 0.7 : 1),
        depthWrite: false,
      });
      strip.add(new THREE.Mesh(stripGeo, wireMat));

      const dotMat = new THREE.PointsMaterial({
        color: PALETTE.dots,
        size: 0.05,
        transparent: true,
        opacity: (center ? 0.5 : 0.8) * k,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      strip.add(new THREE.Points(stripGeo, dotMat));

      // The single continuous edge (a Möbius strip has only one)
      const edgePts: number[] = [];
      for (let pass = 0; pass < 2; pass++) {
        const j = pass === 0 ? 0 : V;
        for (let i = 0; i < U; i++) {
          const idx = (i * (V + 1) + j) * 3;
          edgePts.push(positions[idx], positions[idx + 1], positions[idx + 2]);
        }
      }
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(edgePts), 3)
      );
      const edgeMat = new THREE.PointsMaterial({
        color: PALETTE.edge,
        size: 0.07,
        transparent: true,
        opacity: (center ? 0.55 : 0.9) * k,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      strip.add(new THREE.Points(edgeGeo, edgeMat));

      disposables.push(stripGeo, wireMat, dotMat, edgeGeo, edgeMat);

      /* Quiet star dust */
      const COUNT = calm ? 160 : 300;
      const dustPos = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 40;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 24;
        dustPos[i * 3 + 2] = -12 + Math.random() * 18;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
      const dustMat = new THREE.PointsMaterial({
        color: PALETTE.dust,
        size: 0.05,
        transparent: true,
        opacity: calm ? 0.3 : 0.5,
        depthWrite: false,
      });
      const dust = new THREE.Points(dustGeo, dustMat);
      scene.add(dust);
      disposables.push(dustGeo, dustMat);

      /* Sizing + placement */
      const resize = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;

        if (center) {
          strip.position.set(0, 0, -6);
        } else if (w < 900) {
          strip.position.set(0, 4, -3);
        } else {
          strip.position.set(5.5, 0.5, -3);
        }

        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      /* Mouse parallax */
      const pointer = { x: 0, y: 0 };
      const onMove = (event: PointerEvent) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      /* Loop */
      const clock = new THREE.Clock();
      let frame = 0;

      const render = () => {
        const t = clock.getElapsedTime();

        strip.rotation.x = -1.1 + Math.sin(t * 0.2) * 0.15;
        strip.rotation.z = t * 0.12;
        dust.rotation.y = t * 0.008;

        camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04;
        camera.position.y += (-pointer.y * 0.6 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };

      const loop = () => {
        render();
        frame = requestAnimationFrame(loop);
      };

      if (reduceMotion) {
        render();
      } else {
        loop();
      }

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [focus, calm]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}