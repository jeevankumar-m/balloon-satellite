"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props { ax: number; ay: number; az: number }

export default function CubeIMU({ ax, ay, az }: Props) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene:    THREE.Scene;
    camera:   THREE.PerspectiveCamera;
    group:    THREE.Group;
    target:   { pitch: number; roll: number };
  } | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;

    /* ── renderer ─────────────────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    /* ── scene ────────────────────────────────────────────────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.7, 6);

    scene.add(new THREE.AmbientLight(0x223355, 10));
    const d1 = new THREE.DirectionalLight(0xffffff, 3);
    d1.position.set(3, 5, 6); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x0055bb, 1.2);
    d2.position.set(-3, -3, -4); scene.add(d2);

    /* ── cube ─────────────────────────────────────────────────────────── */
    const group = new THREE.Group();
    scene.add(group);

    const geo   = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const faces = [0x00c8f0, 0x9b59ff, 0x00e87d, 0xff3366, 0xf5a623, 0x00c8f0];
    group.add(
      new THREE.Mesh(
        geo,
        faces.map(c => new THREE.MeshPhongMaterial({
          color: c, transparent: true, opacity: 0.2,
          side: THREE.DoubleSide, shininess: 60,
        }))
      )
    );

    // Primary wireframe
    const edgeGeo = new THREE.EdgesGeometry(geo, 1);
    group.add(new THREE.LineSegments(edgeGeo,
      new THREE.LineBasicMaterial({ color: 0x00c8f0 })));

    // Soft outer glow
    const glow = new THREE.LineSegments(edgeGeo,
      new THREE.LineBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.25 }));
    glow.scale.setScalar(1.02);
    group.add(glow);

    // Axes (X=red, Y=green, Z=blue)
    group.add(new THREE.AxesHelper(1.2));

    // Floor grid
    const grid = new THREE.GridHelper(7, 7, 0x061828, 0x061828);
    grid.position.y = -1.8;
    scene.add(grid);

    const target = { pitch: 0, roll: 0 };
    stateRef.current = { renderer, scene, camera, group, target };

    /* ── render loop ──────────────────────────────────────────────────── */
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      group.rotation.x += (target.pitch - group.rotation.x) * 0.07;
      group.rotation.z += (target.roll  - group.rotation.z) * 0.07;
      renderer.render(scene, camera);
    };
    tick();

    /* ── responsive sizing ────────────────────────────────────────────── */
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    // Two-frame delay ensures the flex layout has settled before we read dimensions
    requestAnimationFrame(() => requestAnimationFrame(resize));

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!stateRef.current) return;
    stateRef.current.target.pitch = Math.atan2(ay, Math.sqrt(ax * ax + az * az));
    stateRef.current.target.roll  = Math.atan2(-ax, az);
  }, [ax, ay, az]);

  return (
    <div
      ref={wrapRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    />
  );
}
