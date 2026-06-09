import { HUMANOID_JOINT_AXES } from "@autofilm/engine";
import { AutoFilmPlayer, buildModel, mountViewer } from "@autofilm/viewer";
import * as THREE from "three";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";
import { STICKMAN_CLIPS } from "./stickman-motion";

// ── build the stick figure + its motion clips ───────────────────────────────
const { model, skeleton } = buildStickman(DEFAULT_STICKMAN);
const object = buildModel(model);
const clips = STICKMAN_CLIPS(skeleton.id);

const params = new URLSearchParams(location.search);
const clipName =
  params.get("clip") !== null && params.get("clip")! in clips
    ? params.get("clip")!
    : "jumpingJack";
const player = new AutoFilmPlayer(
  object,
  skeleton,
  clips[clipName]!,
  HUMANOID_JOINT_AXES,
);

// `?t=<seconds>` freezes one sampled frame (deterministic capture); otherwise
// the clip plays live off the render loop.
const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
if (freezeAt !== null && Number.isFinite(freezeAt)) player.update(freezeAt);

// ── scene scaffolding ───────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f8);
scene.add(object.object);

const grid = new THREE.GridHelper(6, 12, 0xb8c0cc, 0xd5dbe4);
scene.add(grid);

const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 4, 3);
scene.add(sun);

// `?az=<deg>` orbits the camera (0 = front, 90 = right side) so sagittal clips
// like walk/hop can be inspected from the side.
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
const az = (Number(params.get("az") ?? 0) * Math.PI) / 180;
camera.position.set(3.8 * Math.sin(az), 1.0, 3.8 * Math.cos(az));
camera.lookAt(0, 0.92, 0);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
mountViewer(canvas, scene, camera, (elapsed) => {
  if (freezeAt === null) player.update(elapsed);
});

// ── clip selector (live switching) ──────────────────────────────────────────
const bar = document.querySelector<HTMLDivElement>("#clips");
if (bar !== null) {
  let active = clipName;
  for (const name of Object.keys(clips)) {
    const b = document.createElement("button");
    b.textContent = name;
    b.className = name === active ? "on" : "";
    b.addEventListener("click", () => {
      active = name;
      player.setMotion(clips[name]!);
      for (const el of bar.children)
        el.className = el.textContent === name ? "on" : "";
    });
    bar.appendChild(b);
  }
}

// expose for headless verification (the screenshot harness reads this)
(window as unknown as { __autofilm: unknown }).__autofilm = {
  ready: true,
  clip: clipName,
  boneCount: () => object.bones.size,
  partCount: () => model.parts.length,
};
