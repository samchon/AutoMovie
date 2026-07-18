import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  aimRotation,
  solveTwoBoneIK,
} from "@automovie/engine";
import {
  AutoMovieGuidePass,
  AutoMovieHumanoidBone,
} from "@automovie/interface";
import {
  AutoMoviePlayer,
  IAutoMovieRenderModeHandle,
  applyCaptureCanvasSize,
  applyRenderMode,
  buildModel,
  mountViewer,
} from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_CAT, buildCat } from "./cat";
import { CAT_CLIPS } from "./cat-motion";
import { QUADRUPED_JOINT_AXES, QUADRUPED_REST_FRAME } from "./quadruped-rig";
import { DEFAULT_STICKMAN, buildStickman } from "./stickman";
import { STICKMAN_CLIPS } from "./stickman-motion";

const params = new URLSearchParams(location.search);
const isCat = params.get("char") === "cat";
// `?rom=1` freezes the figure at rest and draws each joint's flexion gamut.
const showRom = params.get("rom") === "1";

// ── build the chosen character + its clips ──────────────────────────────────
// The cat is a quadruped (legs point down at rest) so it uses the default
// clinical axes; the human T-pose rig opts into HUMANOID_JOINT_AXES.
const { model, skeleton } = isCat
  ? buildCat(DEFAULT_CAT)
  : buildStickman(DEFAULT_STICKMAN);
const object = buildModel(model);
const clips = isCat ? CAT_CLIPS(skeleton.id) : STICKMAN_CLIPS(skeleton.id);
const jointAxes = isCat ? QUADRUPED_JOINT_AXES : HUMANOID_JOINT_AXES;
const defaultClip = isCat ? "idle" : "jumpingJack";

const clipName =
  params.get("clip") !== null && params.get("clip")! in clips
    ? params.get("clip")!
    : defaultClip;
const restFrames = isCat ? QUADRUPED_REST_FRAME : HUMANOID_REST_FRAME;
// `?clamp=1` enforces ROM; the cat's tail gets spring follow-through so it
// trails and overshoots the body instead of snapping (turn off with ?spring=0).
const catTailSpring =
  isCat && params.get("spring") !== "0"
    ? {
        joints: [
          "leftLittleProximal",
          "leftLittleIntermediate",
          "leftLittleDistal",
        ] as AutoMovieHumanoidBone[],
        stiffness: 90,
        damping: 9,
      }
    : undefined;
const player = new AutoMoviePlayer(
  object,
  skeleton,
  clips[clipName]!,
  jointAxes,
  params.get("clamp") === "1",
  catTailSpring,
  restFrames,
);

// `?t=<seconds>` freezes one sampled frame (deterministic capture); otherwise
// the clip plays live off the render loop.
const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
if (!showRom && freezeAt !== null && Number.isFinite(freezeAt))
  player.update(freezeAt);

// ── scene scaffolding ───────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f8);
scene.add(object.object);

// a large floor so a traveling clip (followed by the camera) always has ground
// scrolling beneath it instead of walking off the edge of a small grid
const grid = new THREE.GridHelper(40, 80, 0xb8c0cc, 0xd5dbe4);
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
const target = isCat ? 0.26 : 0.92;
const dist = isCat ? 1.7 : 3.8;
const ctr = isCat ? 0.12 : 0; // cat trunk centre is forward of the hips
const camY = target + (isCat ? 0.22 : 0.1);

// `?follow=1` makes the camera ride along with the character's root as a
// traveling clip (stroll/sprint/prowl/bound) carries it across the floor —
// holding the same orbit offset but re-centred on the moving body, so the
// figure stays framed while the ground scrolls past (a tracking shot). The
// root translation the engine bakes via travelMotion lands on `object.object`,
// so we just read its world position each frame.
const followMode = params.get("follow") === "1";
const followCamera = (): void => {
  const px = object.object.position.x;
  const pz = object.object.position.z;
  camera.position.set(
    px + dist * Math.sin(az),
    camY,
    pz + ctr + dist * Math.cos(az),
  );
  camera.lookAt(px, target, pz + ctr);
};
camera.position.set(dist * Math.sin(az), camY, ctr + dist * Math.cos(az));
camera.lookAt(0, target, ctr);
if (followMode) followCamera();

// ── ROM overlay: a flexion-gamut fan at every constrained joint ─────────────
// Each joint's `constraint.flexion` [min,max] swept about its flexion axis (the
// same axis the engine validates against), drawn at rest so the figure's whole
// range of motion is visible at once — the joint-limit idea made tangible.
const buildRomFans = (): void => {
  scene.updateMatrixWorld(true);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  for (const b of skeleton.bones) {
    const flex = b.constraint?.flexion;
    if (flex === null || flex === undefined) continue;
    const child = skeleton.bones.find((x) => x.parent === b.bone);
    const tb = object.bones.get(b.bone);
    if (child === undefined || tb === undefined) continue;
    tb.matrixWorld.decompose(pos, quat, scl);
    const childDir = new THREE.Vector3(
      child.rest.translation.x,
      child.rest.translation.y,
      child.rest.translation.z,
    );
    const a = jointAxes?.[b.bone]?.flexion ?? { x: 1, y: 0, z: 0 };
    const axis = new THREE.Vector3(a.x, a.y, a.z);
    const arc: THREE.Vector3[] = [];
    const N = 28;
    for (let i = 0; i <= N; ++i) {
      const deg = flex.min + ((flex.max - flex.min) * i) / N;
      const q = new THREE.Quaternion().setFromAxisAngle(
        axis,
        (deg * Math.PI) / 180,
      );
      arc.push(
        pos
          .clone()
          .add(childDir.clone().applyQuaternion(q).applyQuaternion(quat)),
      );
    }
    const outline = [pos.clone(), ...arc, pos.clone()];
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(outline),
        new THREE.LineBasicMaterial({
          color: 0xff7a2f,
          transparent: true,
          opacity: 0.9,
        }),
      ),
    );
  }
};
if (showRom) buildRomFans();

// ── aim / look-at driver (?look=1) ──────────────────────────────────────────
// The head's forward (+Z, where the eyes are) tracks a target orbiting in front
// of the face: each frame compute the world look direction and convert it to the
// head bone's local rotation via the engine's aimRotation.
const lookMode = params.get("look") === "1";
const headBone = object.bones.get("head");
const aimHead = (elapsed: number): void => {
  if (headBone === undefined) return;
  scene.updateMatrixWorld(true);
  const parentQ = new THREE.Quaternion();
  headBone.parent!.getWorldQuaternion(parentQ);
  // a target circling in front of the head (forward +Z, sweeping x/y)
  const dir = new THREE.Vector3(
    0.6 * Math.cos(elapsed * 1.5),
    0.45 * Math.sin(elapsed * 1.5),
    0.9,
  ).normalize();
  const a = aimRotation({ x: 0, y: 0, z: 1 }, { x: dir.x, y: dir.y, z: dir.z });
  const world = new THREE.Quaternion(a.x, a.y, a.z, a.w);
  headBone.quaternion.copy(parentQ.invert().multiply(world));
};

// ── two-bone IK reach driver (?reach=1) ─────────────────────────────────────
// The right arm reaches a moving target: aim the upper arm off the shoulder→goal
// line by the engine's solveTwoBoneIK `lift`, then point the forearm at the goal
// — the hand lands on the target, the elbow bending as it moves in and out.
const reachMode = params.get("reach") === "1";
const segLen = (b: string): number => {
  const t = skeleton.bones.find((x) => x.bone === b)?.rest.translation;
  return t ? Math.hypot(t.x, t.y, t.z) : 0.25;
};
const L1 = segLen("rightLowerArm"); // shoulder → elbow
const L2 = segLen("rightHand"); // elbow → wrist
const reachTarget = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0xe5484d }),
);
if (reachMode) scene.add(reachTarget);
const FWD = { x: -1, y: 0, z: 0 }; // right-arm rest points down its −X local axis
const toThree = (q: { x: number; y: number; z: number; w: number }) =>
  new THREE.Quaternion(q.x, q.y, q.z, q.w);

const reach = (elapsed: number): void => {
  const upper = object.bones.get("rightUpperArm");
  const lower = object.bones.get("rightLowerArm");
  if (upper === undefined || lower === undefined) return;
  scene.updateMatrixWorld(true);
  const root = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
  // target circles in front of and beside the right shoulder, in and out
  const goal = root
    .clone()
    .add(
      new THREE.Vector3(
        -0.15 + 0.2 * Math.sin(elapsed * 1.1),
        0.15 * Math.sin(elapsed * 1.7),
        0.18 + (L1 + L2) * (0.55 + 0.4 * Math.sin(elapsed * 0.9)),
      ),
    );
  reachTarget.position.copy(goal);

  const toGoal = goal.clone().sub(root);
  const dir = toGoal.clone().normalize();
  const { lift } = solveTwoBoneIK(L1, L2, toGoal.length());
  const pole = new THREE.Vector3(0, -1, -0.4).normalize();
  const bendAxis = new THREE.Vector3().crossVectors(dir, pole).normalize();
  const upperDir = dir
    .clone()
    .applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(bendAxis, (lift * Math.PI) / 180),
    );
  const elbow = root.clone().add(upperDir.clone().multiplyScalar(L1));
  const handDir = goal.clone().sub(elbow).normalize();

  const parentQ = new THREE.Quaternion();
  upper.parent!.getWorldQuaternion(parentQ);
  const upperWorld = toThree(aimRotation(FWD, upperDir));
  upper.quaternion.copy(parentQ.clone().invert().multiply(upperWorld));
  upper.updateWorldMatrix(true, false);
  const upperWorldQ = new THREE.Quaternion();
  upper.getWorldQuaternion(upperWorldQ);
  const lowerWorld = toThree(
    aimRotation(FWD, { x: handDir.x, y: handDir.y, z: handDir.z }),
  );
  lower.quaternion.copy(upperWorldQ.invert().multiply(lowerWorld));
};

// One frame of animation at `elapsed` seconds — shared by the live render loop
// and the deterministic capture hook below.
const frame = (elapsed: number): void => {
  if (reachMode) reach(elapsed);
  else if (lookMode) aimHead(elapsed);
  else if (!showRom) {
    player.update(elapsed);
    if (followMode) followCamera();
  }
};

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
// `?cap=1` hands frame timing to the capturer (window.__afSeek) instead of the
// wall clock, so a recorder can step through deterministically in one session.
const capMode = params.get("cap") === "1";
// Pin the capture canvas to the render plan's exact frame size (#1251), so a
// headless screenshot of `#view` is that size regardless of the host window.
if (capMode)
  applyCaptureCanvasSize(
    canvas,
    Number(params.get("w")),
    Number(params.get("h")),
  );
const handle = mountViewer(
  canvas,
  scene,
  camera,
  (elapsed) => {
    if (!capMode && freezeAt === null) frame(elapsed);
  },
  // Capture renders with AA off and a pinned pixel ratio (#1169) so structural
  // guide passes read back crisp and byte-stable across hosts.
  capMode ? { antialias: false, pixelRatio: 1 } : undefined,
);
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => {
  frame(t);
  handle.renderer.render(scene, camera);
};
// `__afPass` switches the guide pass a capturer screenshots (#1165): restore
// whatever pass was live, apply the requested one over the already-seeked
// scene, and re-render — so one seek yields every pass of that frame.
let passHandle: IAutoMovieRenderModeHandle | null = null;
(
  window as unknown as { __afPass: (pass: AutoMovieGuidePass) => void }
).__afPass = (pass: AutoMovieGuidePass): void => {
  passHandle?.restore();
  passHandle = applyRenderMode(scene, pass);
  handle.renderer.render(scene, camera);
};

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
(window as unknown as { __automovie: unknown }).__automovie = {
  ready: true,
  clip: clipName,
  boneCount: () => object.bones.size,
  partCount: () => model.parts.length,
};
