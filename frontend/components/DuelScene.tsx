"use client";

import { useEffect, useRef } from "react";

/**
 * Shared Three.js background — "Orbital Lattice".
 * Needs: npm i three && npm i -D @types/three
 *
 * A glowing torus-knot of light points sits at the centre of a drifting
 * constellation. Crystal shards orbit it on tilted paths, and a double
 * helix of particles slowly winds around the whole scene.
 *
 * focus="side"   -> hero sits on the right (lobby)
 * focus="center" -> hero sits behind the content (duel arena)
 */

// Edit these to re-theme the whole scene.
const PALETTE = {
  knot: 0x8b5cf6, // violet
  shell: 0x34d399, // mint
  shardA: 0xfbbf24, // amber
  shardB: 0xfb7185, // rose
  helixFrom: "#8b5cf6",
  helixTo: "#34d399",
  lines: 0xc4b5fd,
  dust: 0xddd6fe,
};

export default function DuelScene({
  focus = "side",
  calm = false,
}: {
  focus?: "side" | "center";
  /** Fewer, fainter elements. Use on data-heavy pages (profile, leaderboard). */
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

      const k = calm ? 0.5 : 1; // intensity multiplier
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

      const hero = new THREE.Group();
      scene.add(hero);

      /* 1. Torus-knot made of light points */
      const knotGeo = new THREE.TorusKnotGeometry(2.4, 0.7, 260, 14, 2, 3);
      const knotMat = new THREE.PointsMaterial({
        color: PALETTE.knot,
        size: 0.045,
        transparent: true,
        opacity: (center ? 0.55 : 0.85) * (calm ? 0.7 : 1),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const knot = new THREE.Points(knotGeo, knotMat);
      hero.add(knot);
      disposables.push(knotGeo, knotMat);

      /* 2. Counter-rotating faceted shell */
      const shellGeo = new THREE.IcosahedronGeometry(1.25, 2);
      const shellMat = new THREE.MeshBasicMaterial({
        color: PALETTE.shell,
        wireframe: true,
        transparent: true,
        opacity: (center ? 0.2 : 0.35) * (calm ? 0.7 : 1),
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      hero.add(shell);
      disposables.push(shellGeo, shellMat);

      /* 3. Orbiting crystal shards */
      const shardGeos = [
        new THREE.OctahedronGeometry(1, 0),
        new THREE.TetrahedronGeometry(1, 0),
        new THREE.IcosahedronGeometry(1, 0),
      ];
      const edgeGeos = shardGeos.map((g) => new THREE.EdgesGeometry(g));
      disposables.push(...shardGeos, ...edgeGeos);

      const shardMats = [PALETTE.shardA, PALETTE.shardB].map(
        (c) =>
          new THREE.LineBasicMaterial({
            color: c,
            transparent: true,
            opacity: (center ? 0.5 : 0.8) * k,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
      );
      disposables.push(...shardMats);

      type Shard = {
        pivot: InstanceType<typeof THREE.Group>;
        mesh: InstanceType<typeof THREE.LineSegments>;
        speed: number;
        tumble: number;
      };
      const shards: Shard[] = [];
      const shardCount = calm ? 7 : 16;

      for (let i = 0; i < shardCount; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        const mesh = new THREE.LineSegments(
          edgeGeos[i % edgeGeos.length],
          shardMats[i % shardMats.length]
        );
        const radius = 4.6 + Math.random() * 3.6;
        const size = 0.18 + Math.random() * 0.32;
        mesh.position.set(radius, 0, 0);
        mesh.scale.setScalar(size);
        pivot.rotation.z += Math.random() * Math.PI * 2;
        pivot.add(mesh);
        hero.add(pivot);
        shards.push({
          pivot,
          mesh,
          speed: (0.06 + Math.random() * 0.14) * (Math.random() < 0.5 ? -1 : 1),
          tumble: 0.4 + Math.random() * 0.9,
        });
      }

      /* 4. Double helix of particles */
      const HELIX_POINTS = calm ? 260 : 480;
      const helixPos = new Float32Array(HELIX_POINTS * 2 * 3);
      const helixCol = new Float32Array(HELIX_POINTS * 2 * 3);
      const cFrom = new THREE.Color(PALETTE.helixFrom);
      const cTo = new THREE.Color(PALETTE.helixTo);
      const tmp = new THREE.Color();
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i < HELIX_POINTS; i++) {
          const p = i / (HELIX_POINTS - 1);
          const angle = p * Math.PI * 7 + s * Math.PI;
          const idx = (s * HELIX_POINTS + i) * 3;
          helixPos[idx] = Math.cos(angle) * 6.5;
          helixPos[idx + 1] = (p - 0.5) * 22;
          helixPos[idx + 2] = Math.sin(angle) * 6.5;
          tmp.copy(cFrom).lerp(cTo, p);
          helixCol[idx] = tmp.r;
          helixCol[idx + 1] = tmp.g;
          helixCol[idx + 2] = tmp.b;
        }
      }
      const helixGeo = new THREE.BufferGeometry();
      helixGeo.setAttribute("position", new THREE.BufferAttribute(helixPos, 3));
      helixGeo.setAttribute("color", new THREE.BufferAttribute(helixCol, 3));
      const helixMat = new THREE.PointsMaterial({
        size: 0.06,
        vertexColors: true,
        transparent: true,
        opacity: (center ? 0.35 : 0.55) * k,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const helix = new THREE.Points(helixGeo, helixMat);
      hero.add(helix);
      disposables.push(helixGeo, helixMat);

      /* 5. Constellation: points joined to near neighbours */
      const NODE_COUNT = calm ? 36 : 70;
      const nodes: Array<[number, number, number]> = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push([
          (Math.random() - 0.5) * 36,
          (Math.random() - 0.5) * 20,
          -14 + Math.random() * 10,
        ]);
      }
      const linePts: number[] = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const dx = nodes[i][0] - nodes[j][0];
          const dy = nodes[i][1] - nodes[j][1];
          const dz = nodes[i][2] - nodes[j][2];
          if (dx * dx + dy * dy + dz * dz < 36) {
            linePts.push(...nodes[i], ...nodes[j]);
          }
        }
      }
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(linePts), 3)
      );
      const lineMat = new THREE.LineBasicMaterial({
        color: PALETTE.lines,
        transparent: true,
        opacity: 0.14 * k,
        depthWrite: false,
      });
      const constellation = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(constellation);

      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(nodes.flat()), 3)
      );
      const nodeMat = new THREE.PointsMaterial({
        color: PALETTE.dust,
        size: 0.14,
        transparent: true,
        opacity: 0.6 * k,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const nodePts = new THREE.Points(nodeGeo, nodeMat);
      constellation.add(nodePts);
      disposables.push(lineGeo, lineMat, nodeGeo, nodeMat);

      /* Sizing + hero placement */
      const resize = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;

        if (center) {
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

        knot.rotation.y = t * 0.1;
        knot.rotation.x = Math.sin(t * 0.15) * 0.4;
        shell.rotation.y = -t * 0.25;
        shell.rotation.z = t * 0.12;
        helix.rotation.y = t * 0.05;

        const breathe = 1 + Math.sin(t * 0.7) * 0.03;
        hero.scale.setScalar(breathe);

        shards.forEach((s) => {
          s.pivot.rotation.z += s.speed * 0.01;
          s.mesh.rotation.x = t * s.tumble;
          s.mesh.rotation.y = t * s.tumble * 0.7;
        });

        constellation.rotation.y = Math.sin(t * 0.04) * 0.08;
        constellation.position.x = Math.sin(t * 0.05) * 0.6;

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