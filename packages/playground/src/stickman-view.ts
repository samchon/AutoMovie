import { HUMANOID_JOINT_AXES, IAutoFilmJointAxes } from "@autofilm/engine";
import { AutoFilmHumanoidBone } from "@autofilm/interface";
import { AutoFilmPlayer, buildModel, mountViewer } from "@autofilm/viewer";
import * as THREE from "three";

import { DEFAULT_CAT, buildCat } from "./cat";
import { CAT_CLIPS } from "./cat-motion";
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
const jointAxes:
  | Partial<Record<AutoFilmHumanoidBone, IAutoFilmJointAxes>>
  | undefined = isCat ? undefined : HUMANOID_JOINT_AXES;
const defaultClip = isCat ? "idle" : "jumpingJack";

const clipName =
  params.get("clip") !== null && params.get("clip")! in clips
    ? params.get("clip")!
    : defaultClip;
// `?clamp=1` enforces ROM; the cat's tail gets spring follow-through so it
// trails and overshoots the body instead of snapping (turn off with ?spring=0).
const catTailSpring =
  isCat && params.get("spring") !== "0"
    ? {
        joints: [
          "leftLittleProximal",
          "leftLittleIntermediate",
          "leftLittleDistal",
        ] as AutoFilmHumanoidBone[],
        stiffness: 90,
        damping: 9,
      }
    : undefined;
const player = new AutoFilmPlayer(
  object,
  skeleton,
  clips[clipName]!,
  jointAxes,
  params.get("clamp") === "1",
  catTailSpring,
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
const target = isCat ? 0.26 : 0.92;
const dist = isCat ? 1.7 : 3.8;
const ctr = isCat ? 0.12 : 0; // cat trunk centre is forward of the hips
camera.position.set(
  dist * Math.sin(az),
  target + (isCat ? 0.22 : 0.1),
  ctr + dist * Math.cos(az),
);
camera.lookAt(0, target, ctr);

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
    if (flex == null) continue;
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

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
mountViewer(canvas, scene, camera, (elapsed) => {
  if (!showRom && freezeAt === null) player.update(elapsed);
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
