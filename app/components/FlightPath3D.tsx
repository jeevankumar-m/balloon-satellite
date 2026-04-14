"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type Pkt, toLocal } from "../context/TelemetryContext";

interface Props { track: Pkt[] }

// ── colour ramp: cyan (low) → green → yellow → red (high) ───────────────────
function altColor(t: number): THREE.Color {
  return new THREE.Color().setHSL(Math.max(0, 0.55 - t * 0.55), 1.0, 0.55);
}

// ── gaussian-weighted smoothing ───────────────────────────────────────────────
function smoothTrack(
  pts:  THREE.Vector3[],
  alts: number[],
  win:  number,
): Array<{ v: THREE.Vector3; alt: number }> {
  const half = Math.floor(win / 2);
  return pts.map((_, i) => {
    let sx = 0, sy = 0, sz = 0, sa = 0, sw = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(pts.length - 1, i + half); j++) {
      const d  = j - i;
      const w  = Math.exp(-(d * d) / (2 * (half / 2) ** 2 + 0.001));
      sx += pts[j].x * w; sy += pts[j].y * w; sz += pts[j].z * w;
      sa += alts[j] * w;  sw += w;
    }
    return { v: new THREE.Vector3(sx / sw, sy / sw, sz / sw), alt: sa / sw };
  });
}

// ── single tube with altitude vertex colours ──────────────────────────────────
function makeTube(
  pts:    THREE.Vector3[],
  alts:   number[],
  minA:   number,
  maxA:   number,
  radius: number,
): THREE.Group {
  const grp = new THREE.Group();
  if (pts.length < 2) return grp;

  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  const TSEGS = Math.min(pts.length * 3, 400);
  const RSEGS = 10;
  const geo   = new THREE.TubeGeometry(curve, TSEGS, radius, RSEGS, false);

  // Altitude-based vertex colours
  const cnt  = geo.attributes.position.count;
  const colBuf = new Float32Array(cnt * 3);
  for (let i = 0; i <= TSEGS; i++) {
    const t    = i / TSEGS;
    const ai   = Math.round(t * (alts.length - 1));
    const altT = (alts[ai] - minA) / (maxA - minA || 1);
    const col  = altColor(altT);
    for (let j = 0; j <= RSEGS; j++) {
      const vi = (i * (RSEGS + 1) + j) * 3;
      colBuf[vi] = col.r; colBuf[vi + 1] = col.g; colBuf[vi + 2] = col.b;
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colBuf, 3));

  grp.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    vertexColors: true, shininess: 80,
    specular: new THREE.Color(0x223344),
  })));

  // Subtle glow shell
  const glowGeo = new THREE.TubeGeometry(curve, Math.floor(TSEGS / 4), radius * 3, 6, false);
  grp.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
    color: 0x00c8f0, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  })));

  return grp;
}

// ── canvas-texture label sprite ───────────────────────────────────────────────
function makeLabel(text: string, color = "#00b4d8"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 320; c.height = 48;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 20px monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 160, 24);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })
  );
  s.scale.set(4, 0.6, 1);
  return s;
}

// ── gradient sky ──────────────────────────────────────────────────────────────
function makeSky(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 2; c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0,   "#010810");
  g.addColorStop(0.5, "#021122");
  g.addColorStop(1,   "#03182e");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(c);
}

// ── star field ────────────────────────────────────────────────────────────────
function makeStars(): THREE.Points {
  const n = 1000;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 600;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0x3355aa, size: 0.15, sizeAttenuation: true }));
}

// ── ground grid ───────────────────────────────────────────────────────────────
function makeGrid(radius = 30): THREE.Group {
  const grp = new THREE.Group();
  const dimMat  = (op: number) => new THREE.LineBasicMaterial({ color: 0x0a2035, transparent: true, opacity: op });
  const accentMat = new THREE.LineBasicMaterial({ color: 0x0d3555, transparent: true, opacity: 0.6 });

  // Grid squares (flat)
  const step = 4;
  for (let x = -radius; x <= radius; x += step) {
    grp.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, -radius), new THREE.Vector3(x, 0, radius)]),
      dimMat(x === 0 ? 0.4 : 0.18)
    ));
  }
  for (let z = -radius; z <= radius; z += step) {
    grp.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-radius, 0, z), new THREE.Vector3(radius, 0, z)]),
      dimMat(z === 0 ? 0.4 : 0.18)
    ));
  }

  // Outer border
  const border = [
    new THREE.Vector3(-radius, 0, -radius),
    new THREE.Vector3( radius, 0, -radius),
    new THREE.Vector3( radius, 0,  radius),
    new THREE.Vector3(-radius, 0,  radius),
    new THREE.Vector3(-radius, 0, -radius),
  ];
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(border), accentMat));

  return grp;
}

// ── pulsing ring ──────────────────────────────────────────────────────────────
function makePulseRing(color: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.3, 0.5, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const m   = new THREE.Mesh(geo, mat);
  m.userData.phase = 0;
  return m;
}

// ════════════════════════════════════════════════════════════════════════════
export default function FlightPath3D({ track }: Props) {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const stateRef   = useRef<{
    renderer:   THREE.WebGLRenderer;
    scene:      THREE.Scene;
    camera:     THREE.PerspectiveCamera;
    controls:   OrbitControls;
    trackGrp:   THREE.Group;
    pulseRings: THREE.Mesh[];
    clock:      THREE.Clock;
    camFitted:  boolean;
  } | null>(null);

  // ── scene setup (once) ──────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current!;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    scene.background = makeSky();

    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1200);
    camera.position.set(24, 28, 34);

    // Lighting
    scene.add(new THREE.AmbientLight(0x223355, 10));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(12, 20, 18); scene.add(sun);
    const fill = new THREE.DirectionalLight(0x002255, 1.5);
    fill.position.set(-10, -5, -15); scene.add(fill);

    scene.add(makeStars());

    const grid = makeGrid(30);
    grid.name  = "grid";
    scene.add(grid);

    // Axis lines
    const aLen = 8;
    const aLine = (a: THREE.Vector3, b: THREE.Vector3, c: number) =>
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.5 })
      );
    scene.add(aLine(new THREE.Vector3(0,0,0), new THREE.Vector3(aLen,0,0), 0xff3355));  // E
    scene.add(aLine(new THREE.Vector3(0,0,0), new THREE.Vector3(0,aLen,0), 0x00e07a));  // Alt
    scene.add(aLine(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-aLen), 0x00b4d8)); // N

    const lX = makeLabel("E →", "#ff3355");      lX.position.set(aLen + 1.2, 0, 0);
    const lY = makeLabel("↑ ALT", "#00e07a");    lY.position.set(0, aLen + 1, 0);
    const lZ = makeLabel("← N", "#00b4d8");      lZ.position.set(0, 0, -(aLen + 1.2));
    scene.add(lX, lY, lZ);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance   = 0.5;
    controls.maxDistance   = 500;
    controls.zoomSpeed     = 1.2;

    const trackGrp = new THREE.Group();
    trackGrp.name  = "track";
    scene.add(trackGrp);

    const clock = new THREE.Clock();

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      controls.update();
      stateRef.current?.pulseRings.forEach(ring => {
        ring.userData.phase = (ring.userData.phase + dt * 1.0) % 1;
        const s = 1 + ring.userData.phase * 3;
        ring.scale.set(s, s, s);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - ring.userData.phase) * 0.55;
      });
      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h) { camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w, h); }
    }));

    stateRef.current = { renderer, scene, camera, controls, trackGrp, pulseRings: [], clock, camFitted: false };

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // ── rebuild track when data changes ─────────────────────────────────────
  useEffect(() => {
    if (!stateRef.current || track.length < 2) return;
    const { scene, trackGrp, camera, controls } = stateRef.current;
    stateRef.current.pulseRings = [];

    // Clear old geometry
    while (trackGrp.children.length) {
      const c = trackGrp.children[0] as THREE.Mesh | THREE.Line;
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else if (c.material) (c.material as THREE.Material).dispose();
      trackGrp.remove(c);
    }

    const origin = track[0];
    const raw    = track.map(p => {
      const lc = toLocal(p, origin);
      return { v: new THREE.Vector3(lc.x, 0, lc.z), alt: p.bmpalt };
    });

    // ── Smoothing window: ~8% of track length, min 5, max 21 ────────────
    const smoothWin = Math.min(21, Math.max(5, Math.floor(raw.length * 0.08) | 1));
    const smoothed  = smoothTrack(raw.map(r => r.v), raw.map(r => r.alt), smoothWin);

    const alts = smoothed.map(s => s.alt);
    const minA = Math.min(...alts);
    const maxA = Math.max(...alts);

    // Horizontal extent
    const xs   = smoothed.map(s => s.v.x);
    const zs   = smoothed.map(s => s.v.z);
    const hExt = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 1);
    const vExt = Math.max(maxA - minA, 0.1);

    // Altitude exaggeration — cap at 8× for cleaner look
    const targetRatio = 0.5;
    const rawRatio    = vExt / hExt;
    const altExag     = rawRatio < targetRatio ? Math.min(targetRatio / rawRatio, 8) : 1;

    // Normalise scene to ≈20 units wide
    const SCALE = 20 / Math.max(hExt, vExt * altExag, 1);

    const scaled = smoothed.map(s => ({
      v:   new THREE.Vector3(s.v.x * SCALE, (s.alt - minA) * altExag * SCALE, s.v.z * SCALE),
      alt: s.alt,
    }));

    // Downsample to 100 points for the tube curve
    const MAX_PTS = 100;
    const DS      = Math.max(1, Math.floor(scaled.length / MAX_PTS));
    const sampled = scaled.filter((_, i) => i % DS === 0 || i === scaled.length - 1);

    const sVecs = sampled.map(p => p.v);
    const sAlts = sampled.map(p => p.alt);
    const tubeR = Math.max(0.07, SCALE * hExt * 0.008);

    // ── Tube ─────────────────────────────────────────────────────────────
    trackGrp.add(makeTube(sVecs, sAlts, minA, maxA, tubeR));

    // ── Launch marker ────────────────────────────────────────────────────
    const lPos = scaled[0].v.clone();
    const lSph = new THREE.Mesh(
      new THREE.SphereGeometry(tubeR * 3.5, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0xf4a522, emissive: 0xf4a522, emissiveIntensity: 0.7 })
    );
    lSph.position.copy(lPos); trackGrp.add(lSph);
    // Vertical stem to ground
    if (lPos.y > 0.05) {
      trackGrp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([lPos, new THREE.Vector3(lPos.x, 0, lPos.z)]),
        new THREE.LineBasicMaterial({ color: 0xf4a522, transparent: true, opacity: 0.35 })
      ));
    }
    const lLab = makeLabel("⬟ LAUNCH", "#f4a522");
    lLab.position.set(lPos.x, lPos.y + tubeR * 7, lPos.z);
    trackGrp.add(lLab);
    const lLight = new THREE.PointLight(0xf4a522, 1.5, 8); lLight.position.copy(lPos); trackGrp.add(lLight);

    // ── Current position marker ──────────────────────────────────────────
    const cPos = scaled[scaled.length - 1].v.clone();
    const cSph = new THREE.Mesh(
      new THREE.SphereGeometry(tubeR * 4, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0x00c8f0, emissive: 0x00c8f0, emissiveIntensity: 0.8 })
    );
    cSph.position.copy(cPos); trackGrp.add(cSph);
    if (cPos.y > 0.05) {
      trackGrp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([cPos, new THREE.Vector3(cPos.x, 0, cPos.z)]),
        new THREE.LineBasicMaterial({ color: 0x00c8f0, transparent: true, opacity: 0.4 })
      ));
    }
    for (let i = 0; i < 2; i++) {
      const ring = makePulseRing(0x00c8f0);
      ring.position.copy(cPos);
      ring.userData.phase = i * 0.5;
      trackGrp.add(ring);
      stateRef.current!.pulseRings.push(ring);
    }
    const cLab = makeLabel("◈ NOW", "#00c8f0");
    cLab.position.set(cPos.x, cPos.y + tubeR * 8, cPos.z);
    trackGrp.add(cLab);
    const cLight = new THREE.PointLight(0x00c8f0, 2, 10); cLight.position.copy(cPos); trackGrp.add(cLight);

    // ── Peak altitude marker ─────────────────────────────────────────────
    const peakIdx = sAlts.indexOf(Math.max(...sAlts));
    if (peakIdx !== 0 && peakIdx !== sAlts.length - 1 && sAlts[peakIdx] > sAlts[0] + 0.5) {
      const pPos = scaled[Math.round(peakIdx * (scaled.length - 1) / (sampled.length - 1))].v.clone();
      const pSph = new THREE.Mesh(
        new THREE.SphereGeometry(tubeR * 3, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 0.6 })
      );
      pSph.position.copy(pPos); trackGrp.add(pSph);
      const pLab = makeLabel(`▲ PEAK  ${maxA.toFixed(0)} m`, "#ff3b5c");
      pLab.position.set(pPos.x, pPos.y + tubeR * 6, pPos.z);
      trackGrp.add(pLab);
    }

    // ── Overlay ──────────────────────────────────────────────────────────
    if (overlayRef.current) {
      overlayRef.current.textContent = altExag > 1.05
        ? `ALT × ${altExag.toFixed(1)}x  vertical exaggeration`
        : "";
    }

    // ── Fit camera first time ────────────────────────────────────────────
    if (!stateRef.current!.camFitted && scaled.length >= 2) {
      const box    = new THREE.Box3();
      scaled.forEach(p => box.expandByPoint(p.v));
      const centre = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const d      = Math.max(size.x, size.y, size.z, 4) * 2.0;
      camera.position.set(centre.x + d * 0.55, centre.y + d * 0.65, centre.z + d * 0.85);
      controls.target.copy(centre);
      controls.update();
      stateRef.current!.camFitted = true;
    }
  }, [track]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={wrapRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />

      {/* Altitude exaggeration notice */}
      <div ref={overlayRef} style={{
        position: "absolute", bottom: 12, right: 14,
        fontSize: "0.5rem", letterSpacing: "0.1em",
        color: "rgba(245,165,35,0.75)", pointerEvents: "none",
        textShadow: "0 0 6px rgba(245,165,35,0.3)",
      }} />

      {/* Colour legend */}
      <div style={{
        position: "absolute", bottom: 12, left: 14, display: "flex", flexDirection: "column", gap: 3,
        pointerEvents: "none",
      }}>
        {[
          { c: "#ff3b5c", l: "HIGH ALT" },
          { c: "#f4d03f", l: "MID" },
          { c: "#00e07a", l: "LOW" },
          { c: "#00c8f0", l: "LAUNCH" },
        ].map(({ c, l }) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 18, height: 3, background: c, borderRadius: 1, boxShadow: `0 0 4px ${c}` }} />
            <span style={{ fontSize: "0.44rem", letterSpacing: "0.1em", color: "var(--txt-label)" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div style={{
        position: "absolute", top: 8, right: 14,
        fontSize: "0.46rem", letterSpacing: "0.1em",
        color: "rgba(40,75,110,0.8)", pointerEvents: "none",
      }}>
        DRAG · SCROLL · RIGHT-DRAG
      </div>
    </div>
  );
}
