"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

interface Props { ax: number; ay: number; az: number }

export default function CubeIMU({ ax, ay, az }: Props) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);
  const stateRef = useRef<{
    renderer:    THREE.WebGLRenderer;
    scene:       THREE.Scene;
    camera:      THREE.PerspectiveCamera;
    group:       THREE.Group;
    gizmoScene:  THREE.Scene;
    gizmoCamera: THREE.PerspectiveCamera;
    gizmoGroup:  THREE.Group;
    target:      { pitch: number; roll: number };
  } | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;

    /* ── renderer ─────────────────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    /* ── main scene ───────────────────────────────────────────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    camera.position.set(0, 0.7, 6);

    scene.add(new THREE.AmbientLight(0x223355, 10));
    const d1 = new THREE.DirectionalLight(0xffffff, 3);
    d1.position.set(3, 5, 6); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x0055bb, 1.2);
    d2.position.set(-3, -3, -4); scene.add(d2);

    /* ── STL model ────────────────────────────────────────────────────── */
    const group = new THREE.Group();
    // Rotate -90° on X so we see the front face instead of top-down
    group.rotation.x = -Math.PI / 2;
    scene.add(group);

    const loader = new STLLoader();
    loader.load("/DefionixSAT.stl", (geometry) => {
      geometry.computeVertexNormals();

      // Center the model
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const center = new THREE.Vector3();
      box.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      // Scale to fit the viewport
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      const material = new THREE.MeshPhongMaterial({
        color: 0x00c8f0,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        shininess: 80,
        specular: 0x7df9ff,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(scale);
      group.add(mesh);

      // Wireframe overlay
      const edgeGeo = new THREE.EdgesGeometry(geometry, 15);
      const edges = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ color: 0x00c8f0 })
      );
      edges.scale.setScalar(scale);
      group.add(edges);

      // Soft outer glow
      const glow = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.25 })
      );
      glow.scale.setScalar(scale * 1.01);
      group.add(glow);
    });

    // Floor grid
    const grid = new THREE.GridHelper(7, 7, 0x061828, 0x061828);
    grid.position.y = -1.8;
    scene.add(grid);

    /* ── gizmo scene (corner axis indicator) ─────────────────────────── */
    const gizmoScene  = new THREE.Scene();
    const gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    gizmoCamera.position.set(0, 0, 3);

    const gizmoGroup = new THREE.Group();
    gizmoScene.add(gizmoGroup);

    // Build labelled axes manually for clarity
    const axisData = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xff3333, label: "X" },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x33ff33, label: "Y" },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x3399ff, label: "Z" },
    ];
    axisData.forEach(({ dir, color }) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dir.clone().multiplyScalar(0.8),
      ]);
      gizmoGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));

      // Cone arrowhead
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.2, 8),
        new THREE.MeshBasicMaterial({ color })
      );
      cone.position.copy(dir.clone().multiplyScalar(0.9));
      // Orient cone along axis
      if (Math.abs(dir.x) > 0.5) cone.rotation.z = -Math.PI / 2;
      else if (Math.abs(dir.z) > 0.5) cone.rotation.x = Math.PI / 2;
      gizmoGroup.add(cone);
    });

    // Ambient light for gizmo cones
    gizmoScene.add(new THREE.AmbientLight(0xffffff, 3));

    const target = { pitch: 0, roll: 0 };
    stateRef.current = { renderer, scene, camera, group, gizmoScene, gizmoCamera, gizmoGroup, target };

    /* ── render loop ──────────────────────────────────────────────────── */
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const s = stateRef.current!;
      const w = el.clientWidth;
      const h = el.clientHeight;

      s.group.rotation.x += ((-Math.PI / 2 + s.target.pitch) - s.group.rotation.x) * 0.07;
      s.group.rotation.z += (s.target.roll - s.group.rotation.z) * 0.07;

      // Mirror group rotation onto gizmo
      s.gizmoGroup.rotation.copy(s.group.rotation);

      renderer.clear();

      // Main scene — full viewport
      renderer.setViewport(0, 0, w, h);
      renderer.setScissor(0, 0, w, h);
      renderer.setScissorTest(true);
      renderer.render(scene, camera);

      // Gizmo — top-right corner
      const gs = Math.round(Math.min(w, h) * 0.26);
      renderer.setViewport(w - gs - 8, h - gs - 8, gs, gs);
      renderer.setScissor(w - gs - 8, h - gs - 8, gs, gs);
      renderer.clearDepth();
      renderer.render(gizmoScene, gizmoCamera);
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
