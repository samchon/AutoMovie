import {
  HUMANOID_JOINT_AXES,
  Quaternion,
  aimRotation,
  projectileAt,
  projectileSphereHit,
  resolveAttachment,
  sampleMotion,
} from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmAttachment,
  IAutoFilmJointPose,
  IAutoFilmPose,
  IAutoFilmTransform,
  IAutoFilmVector3,
} from "@autofilm/interface";
import { applyPose, buildModel, mountViewer } from "@autofilm/viewer";
import * as THREE from "three";

import { DEFAULT_HORSE, buildHorse } from "./horse";
import { horseIdle } from "./horse-motion";
import { buildKnight } from "./knight";

// ── the Parthian shot: a mounted archer twists back in the saddle, looses an
// arrow, and the arrow (a real ballistic projectile) is tested for collision
// against a second rider's torso — a detected hit, not a timed cue, unhorses
// him. ────────────────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);

const j = (
  bone: AutoFilmHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoFilmJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});
const v = (x: number, y: number, z: number): IAutoFilmVector3 => ({ x, y, z });
const tf = (
  t: IAutoFilmVector3,
  r: { x: number; y: number; z: number; w: number } = {
    x: 0,
    y: 0,
    z: 0,
    w: 1,
  },
): IAutoFilmTransform => ({
  translation: t,
  rotation: r,
  scale: { x: 1, y: 1, z: 1 },
});

// ── two mounts + two riders ──────────────────────────────────────────────────
const horseA = buildHorse(DEFAULT_HORSE);
const horseB = buildHorse(DEFAULT_HORSE);
const archer = buildKnight({ lance: false }); // bow, not lance
const target = buildKnight({ lance: false });
const horseAObj = buildModel(horseA.model);
const horseBObj = buildModel(horseB.model);
const archerObj = buildModel(archer.model);
const targetObj = buildModel(target.model);

// Both horses face −Z (yaw π). Archer's mount at the origin is "fleeing" toward
// −Z; the target pursues from +Z. So the archer must shoot *backward* (+Z).
const group = (x: number, z: number): THREE.Group => {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI;
  return g;
};
// Each mount + its rider share one group; the rider's LOCAL transform is the
// saddle frame (horse-local, from resolveAttachment), so the group's placement
// and yaw carry both together.
const aGroup = group(0, 0);
const bGroup = group(0, 2.6);
aGroup.add(horseAObj.object);
aGroup.add(archerObj.object);
bGroup.add(horseBObj.object);
bGroup.add(targetObj.object);

const idleA = horseIdle(horseA.skeleton.id);
const idleB = horseIdle(horseB.skeleton.id);
const saddle: IAutoFilmAttachment = {
  parentBone: "spine",
  offset: tf(v(0, -0.72, -0.04)),
};

// ── rider poses ──────────────────────────────────────────────────────────────
// archer twisted back over the croup, bow arm (left) reaching toward the target,
// draw hand (right) pulled to the cheek — held as the loose frame
const archerDraw: IAutoFilmJointPose[] = [
  j("spine", { flexion: 4, twist: 64 }),
  j("chest", { flexion: 2, twist: 58 }),
  j("neck", { twist: 30 }),
  j("head", { twist: 24 }),
  j("leftUpperLeg", { flexion: -52, abduction: 24 }),
  j("rightUpperLeg", { flexion: -52, abduction: -24 }),
  j("leftLowerLeg", { flexion: 74 }),
  j("rightLowerLeg", { flexion: 74 }),
  // bow arm out toward +Z (in the twisted torso frame), draw arm pulled back
  j("leftUpperArm", { flexion: -96, abduction: 10 }),
  j("leftLowerArm", { flexion: -6 }),
  j("rightUpperArm", { flexion: 38, abduction: -30 }),
  j("rightLowerArm", { flexion: 116 }),
];
const ride: IAutoFilmJointPose[] = [
  j("spine", { flexion: 6 }),
  j("chest", { flexion: 4 }),
  j("leftUpperLeg", { flexion: -52, abduction: 24 }),
  j("rightUpperLeg", { flexion: -52, abduction: -24 }),
  j("leftLowerLeg", { flexion: 74 }),
  j("rightLowerLeg", { flexion: 74 }),
  j("rightUpperArm", { flexion: 52, abduction: 8 }),
  j("rightLowerArm", { flexion: 22 }),
  j("leftUpperArm", { flexion: -34, abduction: -30 }),
  j("leftLowerArm", { flexion: -86 }),
];
// target's reaction once struck: thrown back off the horse
const struck: IAutoFilmJointPose[] = [
  j("spine", { flexion: -26, twist: -18 }),
  j("chest", { flexion: -16 }),
  j("head", { flexion: -22 }),
  j("leftUpperArm", { flexion: -10, abduction: -90 }),
  j("rightUpperArm", { flexion: 10, abduction: 90 }),
  j("leftUpperLeg", { flexion: 10, abduction: 30 }),
  j("rightUpperLeg", { flexion: 14, abduction: -20 }),
  j("leftLowerLeg", { flexion: 40 }),
  j("rightLowerLeg", { flexion: 30 }),
];

// ── the arrow as a projectile ────────────────────────────────────────────────
// launch from near the archer's bow toward the target's torso; gravity gives a
// slight arc. The collision is computed against a sphere on the target.
const bowOrigin = v(0, 1.55, 0.3); // world-ish (groups are axis-aligned in X/Y)
const targetTorso = { center: v(0, 1.55, 2.35), radius: 0.5 };
const launch = {
  origin: bowOrigin,
  velocity: v(0, 0.6, 12.5),
  gravity: v(0, -3.2, 0),
};
const hit = projectileSphereHit(launch, targetTorso, 2.0);
const RELEASE = 1.6; // seconds into the clip the arrow leaves the bow
const FLIGHT = hit ? hit.time : 0.3; // detected time of flight to contact
const HIT_AT = RELEASE + FLIGHT;
// eslint-disable-next-line no-console
console.log(`[archery] hit=${hit ? "yes" : "NO"} flight=${FLIGHT.toFixed(3)}s`);

// arrow mesh (shaft + head) and a bow on the archer's left hand
const arrow = new THREE.Group();
const shaft = new THREE.Mesh(
  new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8),
  new THREE.MeshStandardMaterial({ color: 0x6b4a2b }),
);
shaft.rotation.x = Math.PI / 2; // lie along +Z
const head = new THREE.Mesh(
  new THREE.ConeGeometry(0.03, 0.1, 8),
  new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.4 }),
);
head.rotation.x = Math.PI / 2;
head.position.z = 0.4;
arrow.add(shaft, head);
arrow.visible = false;
const bow = new THREE.Mesh(
  new THREE.TorusGeometry(0.28, 0.02, 8, 24, Math.PI * 1.2),
  new THREE.MeshStandardMaterial({ color: 0x3a2a18 }),
);

// ── scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef1f6);
scene.add(aGroup, bGroup, arrow);
const bowHand = archerObj.bones.get("leftHand");
if (bowHand) {
  bow.rotation.y = Math.PI / 2;
  bowHand.add(bow);
}
scene.add(new THREE.GridHelper(40, 80, 0xb8c0cc, 0xd5dbe4));
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(4, 6, 2);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(44, 1, 0.05, 200);
const az = (Number(params.get("az") ?? 62) * Math.PI) / 180;
const dist = Number(params.get("dist") ?? 6.0);
const ctrZ = 1.3;
camera.position.set(dist * Math.sin(az), 1.8, ctrZ + dist * Math.cos(az));
camera.lookAt(0, 1.1, ctrZ);

const seatOf = (
  idle: ReturnType<typeof horseIdle>,
  sk: typeof horseA.skeleton,
  t: number,
): IAutoFilmTransform =>
  resolveAttachment(sampleMotion(idle, t).pose, sk, saddle);

const placeRider = (
  riderObj: typeof archerObj,
  sk: typeof archer.skeleton,
  joints: IAutoFilmJointPose[],
  seat: IAutoFilmTransform,
): void => {
  const pose: IAutoFilmPose = { skeleton: sk.id, root: seat, joints };
  applyPose(riderObj, pose, sk, HUMANOID_JOINT_AXES);
};

const step = (t: number): void => {
  // horses idle; sample for the saddle frames
  applyPose(horseAObj, sampleMotion(idleA, t).pose, horseA.skeleton, undefined);
  applyPose(horseBObj, sampleMotion(idleB, t).pose, horseB.skeleton, undefined);
  const seatA = seatOf(idleA, horseA.skeleton, t);
  const seatB = seatOf(idleB, horseB.skeleton, t);

  // archer: ride, then draw as the loose approaches
  const drawing = t > 0.7 ? archerDraw : ride;
  placeRider(archerObj, archer.skeleton, drawing, seatA);

  // target: seated until struck, then thrown off and down
  if (t < HIT_AT) {
    placeRider(targetObj, target.skeleton, ride, seatB);
  } else {
    const p = Math.min((t - HIT_AT) / 1.3, 1);
    // topple off the far side (+X) and down to the ground, pitching back
    const fallRoot: IAutoFilmTransform = {
      translation: {
        x: seatB.translation.x + 0.6 * p,
        y: seatB.translation.y - 1.5 * p,
        z: seatB.translation.z + 0.2 * p,
      },
      rotation: Quaternion.multiply(
        seatB.rotation,
        Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, -90 * p),
      ),
      scale: { x: 1, y: 1, z: 1 },
    };
    const pose: IAutoFilmPose = {
      skeleton: target.skeleton.id,
      root: fallRoot,
      joints: struck,
    };
    applyPose(targetObj, pose, target.skeleton, HUMANOID_JOINT_AXES);
  }

  // arrow flight
  if (t >= RELEASE && t <= HIT_AT + 0.05) {
    const s = projectileAt(launch, t - RELEASE);
    arrow.visible = true;
    arrow.position.set(s.position.x, s.position.y, s.position.z);
    const d = s.velocity;
    const q = aimRotation({ x: 0, y: 0, z: 1 }, d);
    arrow.quaternion.set(q.x, q.y, q.z, q.w);
  } else {
    arrow.visible = false;
  }
};

const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
if (freezeAt !== null && Number.isFinite(freezeAt)) step(freezeAt);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const capMode = params.get("cap") === "1";
const LOOP = HIT_AT + 2.0;
const handle = mountViewer(canvas, scene, camera, (elapsed) => {
  if (!capMode && freezeAt === null) step(elapsed % LOOP);
});
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => {
  step(t);
  handle.renderer.render(scene, camera);
};

(window as unknown as { __autofilm: unknown }).__autofilm = {
  ready: true,
  hit: hit !== null,
  flight: FLIGHT,
  duration: LOOP,
};
