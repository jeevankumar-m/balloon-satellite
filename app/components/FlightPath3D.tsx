"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type Pkt, toLocal } from "../context/TelemetryContext";

interface Props { track: Pkt[] }

// ── colour ramp: cyan → green → yellow → red (altitude 0 → 1) ─────────────
function altColor(t: number): THREE.Color {
  return new THREE.Color().setHSL(0.55 - t * 0.55, 1, 0.55);
}

// ── canvas sprite label ────────────────────────────────────────────────────
function makeLabel(text: string, color = "#00b4d8"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 56;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 24px monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 28);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true, depthTest: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(3.5, 0.8, 1);
  return s;
}

// ── background star field ──────────────────────────────────────────────────
function makeStars(): THREE.Points {
  const n = 600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 300;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0x334466, size: 0.25, sizeAttenuation: true })
  );
}

export default function FlightPath3D({ track }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);
  const stateRef = useRef<{
    renderer:  THREE.WebGLRenderer;
    scene:     THREE.Scene;
    camera:    THREE.PerspectiveCamera;
    controls:  OrbitControls;
    trackGrp:  THREE.Group;   // cleared & rebuilt on track update
    camFitted: boolean;
  } | null>(null);

  // ── scene setup (once) ─────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current!;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020c1b, 1);
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    scene.fog    = new THREE.FogExp2(0x020c1b, 0.008);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    camera.position.set(20, 15, 30);

    // Lights
    scene.add(new THREE.AmbientLight(0x223355, 8));
    const dl = new THREE.DirectionalLight(0xffffff, 2);
    dl.position.set(10, 20, 15);
    scene.add(dl);

    // Stars
    scene.add(makeStars());

    // Ground grid (will be repositioned to actual ground level when data arrives)
    const grid = new THREE.GridHelper(120, 30, 0x0b2238, 0x0b2238);
    grid.name = "groundGrid";
    scene.add(grid);

    // Axis arrows (thin, decorative)
    const axMat = (c: number) => new THREE.LineBasicMaterial({ color: c });
    const axLine = (a: THREE.Vector3, b: THREE.Vector3, c: number) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      return new THREE.Line(g, axMat(c));
    };
    const axLen = 12;
    scene.add(axLine(new THREE.Vector3(0,0,0), new THREE.Vector3(axLen,0,0), 0xff3b5c));  // X red
    scene.add(axLine(new THREE.Vector3(0,0,0), new THREE.Vector3(0,axLen,0), 0x00e07a));  // Y green
    scene.add(axLine(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-axLen), 0x00b4d8)); // Z cyan

    // Axis labels
    const lx = makeLabel("EAST (+LON)", "#ff3b5c");   lx.position.set(axLen+2, 0, 0);
    const ly = makeLabel("ALTITUDE", "#00e07a");       ly.position.set(0, axLen+1, 0);
    const lz = makeLabel("NORTH (+LAT)", "#00b4d8");   lz.position.set(0, 0, -(axLen+2));
    scene.add(lx, ly, lz);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance   = 2;
    controls.maxDistance   = 200;

    // Track group
    const trackGrp = new THREE.Group();
    trackGrp.name  = "trackGrp";
    scene.add(trackGrp);

    // Animate
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    // Resize
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h) { camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h); }
    }));

    stateRef.current = { renderer, scene, camera, controls, trackGrp, camFitted: false };

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // ── rebuild track geometry when data changes ───────────────────────────
  useEffect(() => {
    if (!stateRef.current || track.length < 1) return;
    const { scene, trackGrp, camera, controls } = stateRef.current;

    // Clear previous
    while (trackGrp.children.length) {
      const c = trackGrp.children[0] as THREE.Mesh | THREE.Line;
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else if (c.material) (c.material as THREE.Material).dispose();
      trackGrp.remove(c);
    }

    if (track.length < 1) return;

    const origin = track[0];

    // Convert to local coords
    const pts = track.map(p => {
      const lc = toLocal(p, origin);
      return { v: new THREE.Vector3(lc.x, lc.y, lc.z), alt: p.bmpalt, pkt: p };
    });

    const alts  = pts.map(p => p.alt);
    const minA  = Math.min(...alts);
    const maxA  = Math.max(...alts);
    const rngA  = maxA - minA || 1;

    // ── Scaling ─────────────────────────────────────────────────────────
    // Normalize so max altitude = 15 Three.js units
    const SCALE = 15 / (maxA - (track[0]?.bmpalt ?? 0) || 1);
    pts.forEach(p => {
      p.v.x *= SCALE;
      p.v.y  = (p.alt - minA) * SCALE;  // start at y=0
      p.v.z *= SCALE;
    });

    // ── Flight path line ────────────────────────────────────────────────
    if (pts.length >= 2) {
      const positions = new Float32Array(pts.length * 3);
      const colors    = new Float32Array(pts.length * 3);

      pts.forEach(({ v, alt }, i) => {
        positions[i*3]   = v.x;
        positions[i*3+1] = v.y;
        positions[i*3+2] = v.z;
        const c = altColor((alt - minA) / rngA);
        colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color",    new THREE.BufferAttribute(colors,    3));
      trackGrp.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true })));
    }

    // ── Vertical drop lines (subtle) ────────────────────────────────────
    if (pts.length >= 2) {
      const dropPos: number[] = [];
      pts.forEach(({ v }) => {
        dropPos.push(v.x, v.y, v.z,  v.x, 0, v.z);
      });
      const dg = new THREE.BufferGeometry();
      dg.setAttribute("position", new THREE.Float32BufferAttribute(dropPos, 3));
      trackGrp.add(new THREE.LineSegments(dg,
        new THREE.LineBasicMaterial({ color: 0x0b2238, transparent: true, opacity: 0.5 })));
    }

    // ── Launch sphere ───────────────────────────────────────────────────
    const launchPos = pts[0].v;
    const lSph = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0xf4a522, emissive: 0xf4a522, emissiveIntensity: 0.5 })
    );
    lSph.position.copy(launchPos);
    trackGrp.add(lSph);

    // Launch glow ring
    const ringGeo = new THREE.RingGeometry(0.45, 0.6, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xf4a522, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    }));
    ring.position.copy(launchPos);
    trackGrp.add(ring);

    // Launch label
    const lLabel = makeLabel("⬟ LAUNCH", "#f4a522");
    lLabel.position.set(launchPos.x, launchPos.y + 1.2, launchPos.z);
    trackGrp.add(lLabel);

    // ── Current position sphere ─────────────────────────────────────────
    const curPos = pts[pts.length - 1].v;
    const curSph = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0x00c8f0, emissive: 0x00c8f0, emissiveIntensity: 0.7 })
    );
    curSph.position.copy(curPos);
    curSph.name = "curSph";
    trackGrp.add(curSph);

    // Current label
    const curLabel = makeLabel("◈ CURRENT", "#00c8f0");
    curLabel.position.set(curPos.x, curPos.y + 1.3, curPos.z);
    trackGrp.add(curLabel);

    // ── Peak sphere (if path went up and came back) ─────────────────────
    const peakIdx = alts.indexOf(Math.max(...alts));
    if (peakIdx !== 0 && peakIdx !== pts.length - 1) {
      const peakPos = pts[peakIdx].v;
      const pkSph = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xff3b5c, emissive: 0xff3b5c, emissiveIntensity: 0.5 })
      );
      pkSph.position.copy(peakPos);
      trackGrp.add(pkSph);
      const pkLabel = makeLabel(`▲ PEAK  ${maxA.toFixed(0)} m`, "#ff3b5c");
      pkLabel.position.set(peakPos.x, peakPos.y + 1.2, peakPos.z);
      trackGrp.add(pkLabel);
    }

    // ── Reposition grid to ground ───────────────────────────────────────
    const gridObj = scene.getObjectByName("groundGrid");
    if (gridObj) gridObj.position.y = 0;

    // ── Fit camera (first time only) ────────────────────────────────────
    if (!stateRef.current!.camFitted && pts.length >= 2) {
      const box    = new THREE.Box3();
      pts.forEach(p => box.expandByPoint(p.v));
      const centre = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 5);
      camera.position.set(
        centre.x + maxDim * 0.9,
        centre.y + maxDim * 0.7,
        centre.z + maxDim * 1.2
      );
      controls.target.copy(centre);
      controls.update();
      stateRef.current!.camFitted = true;
    }
  }, [track]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
