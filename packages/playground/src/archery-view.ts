import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  Quaternion,
  aimRotation,
  projectileAt,
  projectileSphereHit,
  resolveAttachment,
  sampleMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieAttachment,
  IAutoMovieJointPose,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { applyPose, buildModel, mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_HORSE, buildHorse } from "./horse";
import { horseGallop } from "./horse-motion";
import { buildKnight } from "./knight";
import { QUADRUPED_JOINT_AXES, QUADRUPED_REST_FRAME } from "./quadruped-rig";

// ── Parthian shot, at the gallop: two knights charge across the field (camera
// tracking), the lead archer twists back in the saddle and looses an arrow at
// his pursuer. The arrow is a real ballistic projectile; the hit is DETECTED
// (in the moving target's frame), and the detected contact unhorses him — his
// horse gallops on while he tumbles to the turf and recedes. ~10s. ────────────
const params = new URLSearchParams(location.search);

const j = (
  bone: AutoMovieHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoMovieJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});
const v = (x: number, y: number, z: number): IAutoMovieVector3 => ({ x, y, z });
const tf = (t: IAutoMovieVector3): IAutoMovieTransform => ({
  translation: t,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const blend = (
  a: IAutoMovieJointPose[],
  b: IAutoMovieJointPose[],
  t: number,
): IAutoMovieJointPose[] => {
  const bones = new Set([...a, ...b].map((x) => x.bone));
  const at = (arr: IAutoMovieJointPose[], bone: AutoMovieHumanoidBone) =>
    arr.find((x) => x.bone === bone);
  return [...bones].map((bone) => {
    const pa = at(a, bone);
    const pb = at(b, bone);
    return {
      bone,
      flexion: lerp(pa?.flexion ?? 0, pb?.flexion ?? 0, t),
      abduction: lerp(pa?.abduction ?? 0, pb?.abduction ?? 0, t),
      twist: lerp(pa?.twist ?? 0, pb?.twist ?? 0, t),
    };
  });
};

// ── two mounts + riders (face +Z, the charge direction) ──────────────────────
const horseA = buildHorse(DEFAULT_HORSE);
const horseB = buildHorse(DEFAULT_HORSE);
const archer = buildKnight({ lance: false }); // flees with a bow
const target = buildKnight(); // pursues couching a lance
const horseAObj = buildModel(horseA.model);
const horseBObj = buildModel(horseB.model);
const archerObj = buildModel(archer.model);
const targetObj = buildModel(target.model);

const aRig = new THREE.Group(); // archer (leading)
const bRig = new THREE.Group(); // target (pursuing, behind)
aRig.add(horseAObj.object, archerObj.object);
bRig.add(horseBObj.object, targetObj.object);

const gallopA = horseGallop(horseA.skeleton.id);
const gallopB = horseGallop(horseB.skeleton.id);
const saddle: IAutoMovieAttachment = {
  parentBone: "spine",
  offset: tf(v(0, -0.72, -0.04)),
};

// charge kinematics: both travel +Z at V; archer leads by gap G
const V = 6.0;
const G = 3.8;
const DUR = 9;
const aZ = (t: number): number => V * t + G; // archer (front)
const bZ = (t: number): number => V * t; // target (behind)

// ── rider poses ──────────────────────────────────────────────────────────────
const ride: IAutoMovieJointPose[] = [
  j("spine", { flexion: 8 }),
  j("chest", { flexion: 5 }),
  j("leftUpperLeg", { flexion: -54, abduction: 24 }),
  j("rightUpperLeg", { flexion: -54, abduction: -24 }),
  j("leftLowerLeg", { flexion: 76 }),
  j("rightLowerLeg", { flexion: 76 }),
  // Rider arms are authored in clinical abduction; horse clips stay rig-space
  // because their front legs reuse upper-arm names on a quadruped.
  j("rightUpperArm", { flexion: 48, abduction: 82 }),
  j("rightLowerArm", { flexion: 26 }),
  j("leftUpperArm", { flexion: -30, abduction: 62 }),
  j("leftLowerArm", { flexion: -88 }),
];
// twisted back over the croup (facing −Z, at the pursuer), bow arm out, draw hand back
const drawBack: IAutoMovieJointPose[] = [
  j("spine", { flexion: 2, twist: -82 }),
  j("chest", { flexion: 0, twist: -68 }),
  j("neck", { twist: -34 }),
  j("head", { twist: -28 }),
  j("leftUpperLeg", { flexion: -54, abduction: 24 }),
  j("rightUpperLeg", { flexion: -54, abduction: -24 }),
  j("leftLowerLeg", { flexion: 76 }),
  j("rightLowerLeg", { flexion: 76 }),
  j("leftUpperArm", { flexion: -98, abduction: 100 }),
  j("leftLowerArm", { flexion: -6 }),
  j("rightUpperArm", { flexion: 40, abduction: 124 }),
  j("rightLowerArm", { flexion: 120 }),
];
const struck: IAutoMovieJointPose[] = [
  j("spine", { flexion: -28, twist: -16 }),
  j("chest", { flexion: -16 }),
  j("head", { flexion: -24 }),
  j("leftUpperArm", { flexion: -10, abduction: -6 }),
  j("rightUpperArm", { flexion: 10, abduction: -6 }),
  j("leftUpperLeg", { flexion: 12, abduction: 30 }),
  j("rightUpperLeg", { flexion: 16, abduction: -22 }),
  j("leftLowerLeg", { flexion: 38 }),
  j("rightLowerLeg", { flexion: 28 }),
];

// ── timing + the arrow (lead the moving target; detect in the target frame) ──
// the archer flees, then SNAPS around to loose — a fast twist just before release
const DRAW_START = 4.9;
const RELEASE = 5.4;
const g = v(0, -3.4, 0);
// positions frozen at release
const A0 = v(0, 1.55, aZ(RELEASE) + 0.15); // bow muzzle, just ahead of the archer
const B0 = v(0, 1.5, bZ(RELEASE)); // target torso at release
// aim in the TARGET's frame: arrow must cover −Z by ~(G) plus a little arc
const TAU = 0.42; // intended time of flight
const relVel = v(0, 1.4, -(A0.z - B0.z + 0.05) / TAU);
const targetTorso = { center: B0, radius: 0.55 };
const hit = projectileSphereHit(
  { origin: A0, velocity: relVel, gravity: g },
  targetTorso,
  1.5,
);
const FLIGHT = hit ? hit.time : TAU;
const HIT_AT = RELEASE + FLIGHT;
const hitWorldZ = B0.z + V * FLIGHT; // where the (moving) target is struck
// world launch velocity = relative aim + the rider's forward carry
const arrowVel = v(relVel.x, relVel.y, relVel.z + V);
// eslint-disable-next-line no-console
console.log(
  `[archery] hit=${hit ? "yes" : "NO"} flight=${FLIGHT.toFixed(3)} hitZ=${hitWorldZ.toFixed(2)}`,
);

const arrow = new THREE.Group();
const shaft = new THREE.Mesh(
  new THREE.CylinderGeometry(0.013, 0.013, 0.72, 8),
  new THREE.MeshStandardMaterial({ color: 0x6b4a2b }),
);
shaft.rotation.x = Math.PI / 2;
const ahead = new THREE.Mesh(
  new THREE.ConeGeometry(0.032, 0.11, 8),
  new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.4 }),
);
ahead.rotation.x = Math.PI / 2;
ahead.position.z = 0.41;
arrow.add(shaft, ahead);
arrow.visible = false;
const bow = new THREE.Mesh(
  new THREE.TorusGeometry(0.28, 0.02, 8, 24, Math.PI * 1.2),
  new THREE.MeshStandardMaterial({ color: 0x3a2a18 }),
);

// ── scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeaf0f7);
scene.add(aRig, bRig, arrow);
const bowHand = archerObj.bones.get("leftHand");
if (bowHand) {
  bow.rotation.y = Math.PI / 2;
  bowHand.add(bow);
}
scene.add(new THREE.GridHelper(160, 320, 0xb8c0cc, 0xd5dbe4));
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(4, 6, 2);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 400);
const az = (Number(params.get("az") ?? 58) * Math.PI) / 180;
const dist = Number(params.get("dist") ?? 7.5);

const setRider = (
  riderObj: typeof archerObj,
  sk: typeof archer.skeleton,
  joints: IAutoMovieJointPose[],
  seat: IAutoMovieTransform,
): void => {
  applyPose(
    riderObj,
    { skeleton: sk.id, root: seat, joints },
    sk,
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  );
};

const step = (t: number): void => {
  // gallop cycles (in place); rigs carry the forward travel
  applyPose(
    horseAObj,
    sampleMotion(gallopA, t).pose,
    horseA.skeleton,
    QUADRUPED_JOINT_AXES,
    QUADRUPED_REST_FRAME,
  );
  applyPose(
    horseBObj,
    sampleMotion(gallopB, t).pose,
    horseB.skeleton,
    QUADRUPED_JOINT_AXES,
    QUADRUPED_REST_FRAME,
  );
  aRig.position.z = aZ(t);
  bRig.position.z = bZ(t);

  const seatA = resolveAttachment(
    sampleMotion(gallopA, t).pose,
    horseA.skeleton,
    saddle,
  );
  const seatB = resolveAttachment(
    sampleMotion(gallopB, t).pose,
    horseB.skeleton,
    saddle,
  );

  // archer: ride → twist into the draw between DRAW_START and RELEASE, hold
  const dw = Math.min(
    Math.max((t - DRAW_START) / (RELEASE - DRAW_START), 0),
    1,
  );
  setRider(archerObj, archer.skeleton, blend(ride, drawBack, dw), seatA);

  // target: seated until struck; then thrown off — stays in the world where he
  // was hit (counter the rig's ongoing travel) and tumbles down as the horse runs on
  if (t < HIT_AT) {
    setRider(targetObj, target.skeleton, ride, seatB);
  } else {
    const p = Math.min((t - HIT_AT) / 1.4, 1);
    const localZ = hitWorldZ - bRig.position.z - 0.3 * p; // hold world z, drift back a touch
    const fall: IAutoMovieTransform = {
      translation: {
        x: seatB.translation.x + 0.5 * p,
        y: seatB.translation.y - 1.55 * p,
        z: localZ,
      },
      rotation: Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, -95 * p),
      scale: { x: 1, y: 1, z: 1 },
    };
    setRider(targetObj, target.skeleton, struck, fall);
  }

  // arrow flight (world)
  if (t >= RELEASE && t <= HIT_AT + 0.04) {
    const s = projectileAt(
      { origin: A0, velocity: arrowVel, gravity: g },
      t - RELEASE,
    );
    arrow.visible = true;
    arrow.position.set(s.position.x, s.position.y, s.position.z);
    const q = aimRotation({ x: 0, y: 0, z: 1 }, s.velocity);
    arrow.quaternion.set(q.x, q.y, q.z, q.w);
  } else {
    arrow.visible = false;
  }

  // camera tracks the chase (midpoint of the two riders), then on impact eases
  // down onto the fallen knight while the riderless horse gallops out of frame
  const post = Math.min(Math.max((t - HIT_AT) / 0.7, 0), 1);
  const chaseZ = bZ(Math.min(t, HIT_AT)) + G * 0.5;
  const followZ = chaseZ - post * (G * 0.5); // ease from midpoint to the fallen knight
  const camD = dist - post * 1.6; // dolly in a touch
  const lookY = 1.1 - post * 0.65;
  camera.position.set(
    camD * Math.sin(az),
    2.0 - post * 0.7,
    followZ + camD * Math.cos(az),
  );
  camera.lookAt(0, lookY, followZ);
};

const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
if (freezeAt !== null && Number.isFinite(freezeAt)) step(freezeAt);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const capMode = params.get("cap") === "1";
const handle = mountViewer(canvas, scene, camera, (elapsed) => {
  if (!capMode && freezeAt === null) step(elapsed % DUR);
});
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => {
  step(t);
  handle.renderer.render(scene, camera);
};

(window as unknown as { __automovie: unknown }).__automovie = {
  ready: true,
  hit: hit !== null,
  flight: FLIGHT,
  duration: DUR,
};
