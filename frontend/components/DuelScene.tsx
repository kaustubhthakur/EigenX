"use client";

import { useEffect, useRef } from "react";

/**
 * Shared Three.js background.
 * Needs: npm i three && npm i -D @types/three
 *
 * focus="side"   -> hero shape sits on the right (lobby)
 * focus="center" -> hero shape sits behind the content (duel arena)
 */
export default function DuelScene({
  focus = "side",
}: {
  focus?: "side" | "center";
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

      /* Central wireframe */
      const hero = new THREE.Group();
      scene.add(hero);

      const coreGeo = new THREE.IcosahedronGeometry(2.8, 1);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        wireframe: true,
        transparent: true,
        opacity: focus === "center" ? 0.18 : 0.28,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      hero.add(core);

      const innerGeo = new THREE.OctahedronGeometry(1.5, 0);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        wireframe: true,
        transparent: true,
        opacity: focus === "center" ? 0.35 : 0.55,
      });
      const inner = new THREE.Mesh(innerGeo, innerMat);
      hero.add(inner);

      const ringGeo = new THREE.TorusGeometry(4.2, 0.012, 8, 160);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: focus === "center" ? 0.3 : 0.45,
      });
      const ringA = new THREE.Mesh(ringGeo, ringMat);
      ringA.rotation.x = Math.PI / 2.4;
      const ringB = new THREE.Mesh(ringGeo, ringMat);
      ringB.rotation.y = Math.PI / 2.6;
      ringB.scale.setScalar(0.82);
      hero.add(ringA, ringB);

      disposables.push(coreGeo, coreMat, innerGeo, innerMat, ringGeo, ringMat);

      /* Floating math symbols */
      const symbols = ["+", "\u2212", "\u00d7", "\u00f7", "=", "%", "\u221a", "\u03c0"];
      const colors = ["#a5b4fc", "#67e8f9", "#c4b5fd", "#f0abfc"];
      const textures: Array<InstanceType<typeof THREE.CanvasTexture>> = [];

      symbols.forEach((symbol, i) => {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.font = "600 88px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors[i % colors.length];
        ctx.shadowColor = colors[i % colors.length];
        ctx.shadowBlur = 18;
        ctx.fillText(symbol, 64, 70);
        textures.push(new THREE.CanvasTexture(canvas));
      });

      type Floater = {
        sprite: InstanceType<typeof THREE.Sprite>;
        baseY: number;
        speed: number;
        phase: number;
        spin: number;
      };
      const floaters: Floater[] = [];
      const spriteMats: Array<InstanceType<typeof THREE.SpriteMaterial>> = [];

      for (let i = 0; i < 22; i++) {
        const texture = textures[i % textures.length];
        if (!texture) continue;
        const mat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.16 + Math.random() * 0.3,
          depthWrite: false,
        });
        spriteMats.push(mat);
        const sprite = new THREE.Sprite(mat);
        const size = 0.9 + Math.random() * 1.5;
        sprite.scale.set(size, size, 1);
        sprite.position.set(
          (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 16,
          -8 + Math.random() * 11
        );
        scene.add(sprite);
        floaters.push({
          sprite,
          baseY: sprite.position.y,
          speed: 0.15 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.4,
        });
      }

      /* Star dust */
      const COUNT = 320;
      const positions = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
        positions[i * 3 + 2] = -12 + Math.random() * 18;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const dustMat = new THREE.PointsMaterial({
        color: 0xc7d2fe,
        size: 0.05,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const dust = new THREE.Points(dustGeo, dustMat);
      scene.add(dust);
      disposables.push(dustGeo, dustMat);

      /* Sizing + hero placement */
      const resize = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;

        if (focus === "center") {
          hero.position.set(0, 0, -6);
        } else if (w < 900) {
          hero.position.set(0, 4, -3);
        } else {
          hero.position.set(5.5, 0.5, -3);
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

        core.rotation.y = t * 0.12;
        core.rotation.x = t * 0.05;
        inner.rotation.y = -t * 0.35;
        inner.rotation.z = t * 0.2;
        ringA.rotation.z = t * 0.1;
        ringB.rotation.x = t * 0.12;

        floaters.forEach((f) => {
          f.sprite.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.8;
          f.sprite.material.rotation += f.spin * 0.002;
        });

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
        spriteMats.forEach((m) => m.dispose());
        textures.forEach((tx) => tx.dispose());
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
  }, [focus]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}