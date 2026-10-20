"use client";

import { useEffect, useRef } from "react";

/**
 * Shared Three.js background: a refined Möbius strip.
 * Needs: npm i three && npm i -D @types/three
 *
 * focus="side"   -> strip sits on the right (lobby)
 * focus="center" -> strip sits behind the content (duel arena)
 * calm           -> fainter, for data-heavy pages
 */

// sRGB 0-255, used directly in the shader
const PALETTE = {
  a: [99, 102, 241], // indigo-500
  b: [139, 92, 246], // violet-500
  c: [34, 211, 238], // cyan-400
  edge: 0xa5f3fc, // cyan-200
  dust: 0xc7d2fe, // indigo-200
};

const VERTEX = /* glsl */ `
  attribute float aU;
  attribute float aV;
  varying vec3 vView;
  varying float vU;
  varying float vV;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    vU = aU;
    vV = aV;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  varying vec3 vView;
  varying float vU;
  varying float vV;

  void main() {
    // Per-pixel normal. A Möbius strip is non-orientable, so interpolated
    // vertex normals would flip at the seam; screen derivatives avoid that.
    vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
    vec3 viewDir = normalize(-vView);
    float ndv = abs(dot(n, viewDir));
    float fresnel = pow(1.0 - ndv, 2.5);

    // Colour travels around the loop (only 2π-periodic terms, so no seam)
    float g1 = 0.5 + 0.5 * sin(vU);
    float g2 = 0.5 + 0.5 * cos(vU * 2.0 + 1.0);
    vec3 col = mix(mix(uA, uB, g1), uC, g2 * 0.6);

    // Fine grid lines (symmetric in v so they match across the twist seam)
    float gv = (vV * 0.5 + 0.5) * 6.0;
    float dv = abs(fract(gv - 0.5) - 0.5) / max(fwidth(gv), 1e-4);
    float lineV = 1.0 - min(dv, 1.0);

    float gu = vU / 6.2831853 * 72.0;
    float du = abs(fract(gu - 0.5) - 0.5) / max(fwidth(gu), 1e-4);
    float lineU = (1.0 - min(du, 1.0)) * 0.45;

    // Soft light that slowly travels along the strip
    float pulse = 0.55 + 0.45 * sin(vU * 2.0 - uTime * 0.9);
    float edge = smoothstep(0.82, 1.0, abs(vV));

    float alpha = 0.07 + fresnel * 0.45 + edge * 0.14 + (lineV + lineU) * 0.16 * pulse;
    col = mix(col, vec3(1.0), lineV * 0.25 + fresnel * 0.2);

    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;

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

      const center = focus === "center";
      const strength = (center ? 0.6 : 1) * (calm ? 0.55 : 1);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 14;

      const disposables: Array<{ dispose: () => void }> = [];

      /* ---------------- Möbius strip geometry ---------------- */
      const U = 220; // steps around the loop
      const V = 28; // steps across the width
      const R = 3.6; // loop radius
      const W = 1.35; // half width

      // U + 1 columns: the last one duplicates the first with the width
      // flipped, which is exactly the half-twist closure.
      const cols = U + 1;
      const positions = new Float32Array(cols * (V + 1) * 3);
      const aU = new Float32Array(cols * (V + 1));
      const aV = new Float32Array(cols * (V + 1));

      for (let i = 0; i < cols; i++) {
        const u = (i / U) * Math.PI * 2;
        for (let j = 0; j <= V; j++) {
          const vn = (j / V - 0.5) * 2; // -1 .. 1
          const v = vn * W;
          const r = R + v * Math.cos(u / 2);
          const k = i * (V + 1) + j;
          positions[k * 3] = r * Math.cos(u);
          positions[k * 3 + 1] = r * Math.sin(u);
          positions[k * 3 + 2] = v * Math.sin(u / 2);
          aU[k] = u;
          aV[k] = vn;
        }
      }

      const indices: number[] = [];
      for (let i = 0; i < U; i++) {
        for (let j = 0; j < V; j++) {
          const a = i * (V + 1) + j;
          const b = a + 1;
          const c = (i + 1) * (V + 1) + j;
          const d = c + 1;
          indices.push(a, b, c, b, d, c);
        }
      }

      const stripGeo = new THREE.BufferGeometry();
      stripGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      stripGeo.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
      stripGeo.setAttribute("aV", new THREE.BufferAttribute(aV, 1));
      stripGeo.setIndex(indices);

      const toVec = (c: number[]) =>
        new THREE.Vector3(c[0] / 255, c[1] / 255, c[2] / 255);

      const surfaceMat = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: strength },
          uA: { value: toVec(PALETTE.a) },
          uB: { value: toVec(PALETTE.b) },
          uC: { value: toVec(PALETTE.c) },
        },
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const strip = new THREE.Group();
      scene.add(strip);
      strip.add(new THREE.Mesh(stripGeo, surfaceMat));

      /* ------- The single continuous edge, as a thin glowing tube ------- */
      const edgePoints: InstanceType<typeof THREE.Vector3>[] = [];
      for (let pass = 0; pass < 2; pass++) {
        const j = pass === 0 ? 0 : V;
        for (let i = 0; i < U; i++) {
          const k = (i * (V + 1) + j) * 3;
          edgePoints.push(
            new THREE.Vector3(positions[k], positions[k + 1], positions[k + 2])
          );
        }
      }
      const curve = new THREE.CatmullRomCurve3(edgePoints, true);
      const edgeGeo = new THREE.TubeGeometry(curve, 720, 0.02, 6, true);
      const edgeMat = new THREE.MeshBasicMaterial({
        color: PALETTE.edge,
        transparent: true,
        opacity: 0.8 * strength,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      strip.add(new THREE.Mesh(edgeGeo, edgeMat));

      disposables.push(stripGeo, surfaceMat, edgeGeo, edgeMat);

      /* ---------------- Quiet background dust ---------------- */
      const COUNT = calm ? 90 : 160;
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
        size: 0.04,
        transparent: true,
        opacity: calm ? 0.18 : 0.3,
        depthWrite: false,
      });
      const dust = new THREE.Points(dustGeo, dustMat);
      scene.add(dust);
      disposables.push(dustGeo, dustMat);

      /* ---------------- Sizing + placement ---------------- */
      const resize = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;

        if (center) {
          strip.position.set(0, 0, -6);
          strip.scale.setScalar(w < 700 ? 0.8 : 1);
        } else if (w < 900) {
          strip.position.set(0, 4, -3);
          strip.scale.setScalar(0.8);
        } else {
          strip.position.set(5.5, 0.5, -3);
          strip.scale.setScalar(1);
        }

        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      /* ---------------- Mouse parallax ---------------- */
      const pointer = { x: 0, y: 0 };
      const onMove = (event: PointerEvent) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      /* ---------------- Loop ---------------- */
      const clock = new THREE.Clock();
      let frame = 0;

      const render = () => {
        const t = clock.getElapsedTime();

        surfaceMat.uniforms.uTime.value = t;
        strip.rotation.x = -1.15 + Math.sin(t * 0.2) * 0.08;
        strip.rotation.z = t * 0.1;
        dust.rotation.y = t * 0.006;

        camera.position.x += (pointer.x * 0.7 - camera.position.x) * 0.04;
        camera.position.y += (-pointer.y * 0.5 - camera.position.y) * 0.04;
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