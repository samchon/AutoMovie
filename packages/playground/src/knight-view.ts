import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  resolveAttachment,
  sampleMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieAttachment,
  IAutoMovieJointPose,
  IAutoMovieMotion,
  IAutoMoviePose,
} from "@automovie/interface";
import { AutoMoviePlayer, buildModel, mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_HORSE, buildHorse } from "./horse";
import { HORSE_CLIPS } from "./horse-motion";
import { buildKnight } from "./knight";
import { QUADRUPED_JOINT_AXES, QUADRUPED_REST_FRAME } from "./quadruped-rig";

const params = new URLSearchParams(location.search);

// ── build the horse (mount) and the knight (rider) ──────────────────────────
const horse = buildHorse(DEFAULT_HORSE);
const knight = buildKnight();
const horseObj = buildModel(horse.model);
const knightObj = buildModel(knight.model);

const horseClips = HORSE_CLIPS(horse.skeleton.id);
const clipName =
  params.get("clip") !== null && params.get("clip")! in horseClips
    ? params.get("clip")!
    : "performance";
let horseClip: IAutoMovieMotion = horseClips[clipName]!;

const horsePlayer = new AutoMoviePlayer(
  horseObj,
  horse.skeleton,
  horseClip,
  QUADRUPED_JOINT_AXES,
  false,
  // the tail trails with damped follow-through
  {
    joints: [
      "leftLittleProximal",
      "leftLittleIntermediate",
      "leftLittleDistal",
    ] as AutoMovieHumanoidBone[],
    stiffness: 70,
    damping: 8,
  },
  QUADRUPED_REST_FRAME,
);

// ── the rider's body pose: sitting astride, lance couched, shield up ────────
const j = (
  bone: AutoMovieHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoMovieJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});
const ridePose = (lean: number): IAutoMoviePose => ({
  skeleton: knight.skeleton.id,
  root: null,
  joints: [
    j("spine", { flexion: 6 + lean }),
    j("chest", { flexion: 4 }),
    // legs straddle the barrel and grip: thighs forward-and-out, knees bent
    j("leftUpperLeg", { flexion: -52, abduction: 24 }),
    j("rightUpperLeg", { flexion: -52, abduction: -24 }),
    j("leftLowerLeg", { flexion: 74 }),
    j("rightLowerLeg", { flexion: 74 }),
    // right arm couches the lance forward
    // Rider arms are authored in clinical abduction. The horse clip remains
    // rig-space because its front legs reuse upper-arm names on a quadruped.
    j("rightUpperArm", { flexion: 52, abduction: 82 }),
    j("rightLowerArm", { flexion: 22 }),
    // left arm holds the shield up in front
    j("leftUpperArm", { flexion: -34, abduction: 60 }),
    j("leftLowerArm", { flexion: -86 }),
  ],
});
const rideClip: IAutoMovieMotion = {
  id: "ride",
  skeleton: knight.skeleton.id,
  duration: 0.62,
  loop: true,
  keyframes: [
    {
      time: 0,
      pose: ridePose(0),
      expression: null,
      easing: "easeInOut",
      bezier: null,
    },
    {
      time: 0.31,
      pose: ridePose(4),
      expression: null,
      easing: "easeInOut",
      bezier: null,
    },
    {
      time: 0.62,
      pose: ridePose(0),
      expression: null,
      easing: "easeInOut",
      bezier: null,
    },
  ],
};
const knightPlayer = new AutoMoviePlayer(
  knightObj,
  knight.skeleton,
  rideClip,
  HUMANOID_JOINT_AXES,
  false,
  undefined,
  HUMANOID_REST_FRAME,
);

// ── the saddle attachment: fix the rider's root into the horse's spine bone ──
// The seat offset drops the rider's root so its pelvis lands on the back, a
// touch behind the withers; the rider rides the bone's world frame, so when the
// horse rears (spine pitches up) the knight is carried back with it.
const seatY = Number(params.get("seatY") ?? -0.72);
const seatZ = Number(params.get("seatZ") ?? -0.04);
const attachment: IAutoMovieAttachment = {
  parentBone: "spine",
  offset: {
    translation: { x: 0, y: seatY, z: seatZ },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
};
const placeRider = (seconds: number): void => {
  const horsePose = sampleMotion(horseClip, seconds).pose;
  const seat = resolveAttachment(horsePose, horse.skeleton, attachment);
  knightObj.object.position.set(
    seat.translation.x,
    seat.translation.y,
    seat.translation.z,
  );
  knightObj.object.quaternion.set(
    seat.rotation.x,
    seat.rotation.y,
    seat.rotation.z,
    seat.rotation.w,
  );
};

// ── scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef1f6);
scene.add(horseObj.object);
scene.add(knightObj.object);

const grid = new THREE.GridHelper(60, 120, 0xb8c0cc, 0xd5dbe4);
scene.add(grid);

const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(3, 5, 4);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
const az = (Number(params.get("az") ?? 35) * Math.PI) / 180;
const target = 1.2;
const dist = Number(params.get("dist") ?? 5.2);
const camY = 1.9;
const followMode = params.get("follow") === "1";
const followCamera = (): void => {
  const px = horseObj.object.position.x;
  const pz = horseObj.object.position.z;
  camera.position.set(px + dist * Math.sin(az), camY, pz + dist * Math.cos(az));
  camera.lookAt(px, target, pz);
};
camera.position.set(dist * Math.sin(az), camY, dist * Math.cos(az));
camera.lookAt(0, target, 0);

// `?t=<seconds>` freezes a deterministic frame for capture.
const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
const step = (elapsed: number): void => {
  horsePlayer.update(elapsed);
  knightPlayer.update(elapsed);
  placeRider(elapsed);
  if (followMode) followCamera();
};
if (freezeAt !== null && Number.isFinite(freezeAt)) step(freezeAt);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
// `?cap=1` lets a recorder drive frame timing via window.__afSeek.
const capMode = params.get("cap") === "1";
const handle = mountViewer(canvas, scene, camera, (elapsed) => {
  if (!capMode && freezeAt === null) step(elapsed);
});
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => {
  step(t);
  handle.renderer.render(scene, camera);
};

// ── clip selector ────────────────────────────────────────────────────────────
const bar = document.querySelector<HTMLDivElement>("#clips");
if (bar !== null) {
  for (const name of Object.keys(horseClips)) {
    const b = document.createElement("button");
    b.textContent = name;
    b.className = name === clipName ? "on" : "";
    b.addEventListener("click", () => {
      horseClip = horseClips[name]!;
      horsePlayer.setMotion(horseClip);
      for (const el of bar.children)
        el.className = el.textContent === name ? "on" : "";
    });
    bar.appendChild(b);
  }
}

(window as unknown as { __automovie: unknown }).__automovie = {
  ready: true,
  clip: clipName,
  horseBones: () => horseObj.bones.size,
  knightBones: () => knightObj.bones.size,
};
