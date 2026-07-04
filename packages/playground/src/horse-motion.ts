import { Quaternion, sequenceMotion, travelMotion } from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieTransform,
} from "@automovie/interface";

/**
 * Motion clips for the stick horse. The horse keeps all four legs down at rest
 * (default clinical axes), so leg `flexion` strides fore/aft (negative swings a
 * leg forward, positive back) and the lower-limb `flexion` bends the knee/hock;
 * spine `flexion` arches the back (negative pitches the front end **up** — the
 * rear). The tail rides the repurposed finger chain.
 *
 * @author Samchon
 */
const j = (
  bone: AutoMovieHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoMovieJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});

const root = (y: number, pitch = 0): IAutoMovieTransform => ({
  translation: { x: 0, y, z: 0 },
  rotation: Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, pitch),
  scale: { x: 1, y: 1, z: 1 },
});

/** A root placement with a heading change (yaw about +Y, degrees). */
const rootYaw = (y: number, yawDeg: number): IAutoMovieTransform => ({
  translation: { x: 0, y, z: 0 },
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, yawDeg),
  scale: { x: 1, y: 1, z: 1 },
});

const pose = (
  sk: string,
  joints: IAutoMovieJointPose[],
  r: IAutoMovieTransform | null = null,
): IAutoMoviePose => ({ skeleton: sk, root: r, joints });

const key = (time: number, p: IAutoMoviePose): IAutoMovieKeyframe => ({
  time,
  pose: p,
  expression: null,
  easing: "easeInOut",
  bezier: null,
});

/** Tail as a trailing S-curve; `sway` ∈ [−1,1], `lift` raises the whole tail. */
const tail = (sway: number, lift = 0): IAutoMovieJointPose[] => [
  j("leftLittleProximal", { abduction: 16 * sway, flexion: 10 + lift }),
  j("leftLittleIntermediate", { abduction: 20 * sway, flexion: 14 + lift }),
  j("leftLittleDistal", { abduction: 24 * sway, flexion: 16 + lift }),
];

/** Idle — standing square, tail swaying, head and neck breathing gently. */
export const horseIdle = (sk: string): IAutoMovieMotion => ({
  id: "idle",
  skeleton: sk,
  duration: 2.4,
  loop: true,
  keyframes: [
    key(
      0,
      pose(sk, [
        ...tail(-1),
        j("neck", { flexion: 4 }),
        j("head", { flexion: -6 }),
      ]),
    ),
    key(
      1.2,
      pose(sk, [
        ...tail(1),
        j("neck", { flexion: 8 }),
        j("head", { flexion: -10 }),
      ]),
    ),
    key(
      2.4,
      pose(sk, [
        ...tail(-1),
        j("neck", { flexion: 4 }),
        j("head", { flexion: -6 }),
      ]),
    ),
  ],
});

/**
 * One side's legs (front + hind of the same side) — `lead` swings that pair
 * forward and plants while the opposite pair drives back. A horse coordinates
 * by side/diagonal, not both-front-then-both-hind like a bounding cat.
 */
const gaitSide = (
  sk: string,
  lead: "left" | "right",
  reach: number,
  bend: number,
  y: number,
): IAutoMoviePose => {
  const lf = lead === "left" ? -reach : reach; // forward = negative flexion
  const rf = lead === "left" ? reach : -reach;
  const lk = lead === "left" ? bend : bend * 0.4; // the swinging side lifts more
  const rk = lead === "left" ? bend * 0.4 : bend;
  return pose(
    sk,
    [
      j("leftUpperArm", { flexion: lf }),
      j("rightUpperArm", { flexion: rf }),
      j("leftLowerArm", { flexion: lk }),
      j("rightLowerArm", { flexion: rk }),
      j("leftUpperLeg", { flexion: lf }),
      j("rightUpperLeg", { flexion: rf }),
      j("leftLowerLeg", { flexion: lk }),
      j("rightLowerLeg", { flexion: rk }),
      j("spine", { flexion: 4 }),
      j("neck", { flexion: 6 }),
      ...tail(0, 2),
    ],
    root(y),
  );
};

/**
 * Gallop — a lateral-pair bound: the left side then the right side reach and
 * drive, with a brief gathered suspension between, the back held near level (no
 * nose-dive). Authored in place; wrap with `travelMotion` to charge forward.
 */
export const horseGallop = (sk: string): IAutoMovieMotion => {
  const gather = pose(
    sk,
    [
      j("leftUpperArm", { flexion: -14 }),
      j("rightUpperArm", { flexion: -14 }),
      j("leftLowerArm", { flexion: 70 }),
      j("rightLowerArm", { flexion: 70 }),
      j("leftUpperLeg", { flexion: -16 }),
      j("rightUpperLeg", { flexion: -16 }),
      j("leftLowerLeg", { flexion: 74 }),
      j("rightLowerLeg", { flexion: 74 }),
      j("spine", { flexion: 8 }),
      j("neck", { flexion: 8 }),
      ...tail(0, -6),
    ],
    root(0.16),
  );
  return {
    id: "gallop",
    skeleton: sk,
    duration: 0.6,
    loop: true,
    keyframes: [
      key(0, gather),
      key(0.16, gaitSide(sk, "left", 46, 30, 0.03)),
      key(0.3, gather),
      key(0.46, gaitSide(sk, "right", 46, 30, 0.03)),
      key(0.6, gather),
    ],
  };
};

/** Gallop that charges forward (~5 m/s), for a follow camera. */
export const horseGallopTravel = (sk: string): IAutoMovieMotion =>
  travelMotion("gallopTravel", horseGallop(sk), 8, { x: 0, y: 0, z: 5 });

/**
 * Rear — the horse pitches up on its hind legs, front legs pawing the air, head
 * tossing as it neighs ("히히힝"), then drops back down. A one-shot beat (negative
 * spine flexion pitches the whole front end up, carrying a saddled rider back
 * with it).
 */
export const horseRear = (sk: string): IAutoMovieMotion => {
  const stand = pose(sk, [...tail(-0.5), j("neck", { flexion: 4 })], root(0));
  const coil = pose(
    sk,
    [
      ...tail(0, 6),
      j("leftUpperLeg", { flexion: 18 }),
      j("rightUpperLeg", { flexion: 18 }),
      j("leftLowerLeg", { flexion: 36 }),
      j("rightLowerLeg", { flexion: 36 }),
      j("spine", { flexion: 8 }),
      j("neck", { flexion: 14 }),
      j("head", { flexion: 10 }),
    ],
    root(-0.04),
  );
  const rearUp = (toss: number): IAutoMoviePose =>
    pose(
      sk,
      [
        // front legs lift and paw, knees tucked
        j("leftUpperArm", { flexion: -72, abduction: 8 }),
        j("rightUpperArm", { flexion: -84, abduction: -8 }),
        j("leftLowerArm", { flexion: 96 }),
        j("rightLowerArm", { flexion: 110 }),
        // hind legs planted, slightly bent under the lifted body
        j("leftUpperLeg", { flexion: 6 }),
        j("rightUpperLeg", { flexion: 6 }),
        j("leftLowerLeg", { flexion: 30 }),
        j("rightLowerLeg", { flexion: 30 }),
        // whole front end pitches UP, neck and head reach up, head tosses
        j("spine", { flexion: -46 }),
        j("chest", { flexion: -28 }),
        j("neck", { flexion: -52 }),
        j("head", { flexion: -18 + toss }),
        ...tail(0, 18),
      ],
      root(0.06, -0.5),
    );
  return {
    id: "rear",
    skeleton: sk,
    duration: 2.6,
    loop: false,
    keyframes: [
      key(0, stand),
      key(0.4, coil),
      key(0.9, rearUp(0)),
      key(1.25, rearUp(16)), // head toss — "히힝"
      key(1.6, rearUp(2)), // "히힝"
      key(1.95, rearUp(14)),
      key(2.3, coil),
      key(2.6, stand),
    ],
  };
};

/** Walk — an even lateral-pair gait: left side, then right side step forward. */
export const horseWalk = (sk: string): IAutoMovieMotion => ({
  id: "walk",
  skeleton: sk,
  duration: 1.0,
  loop: true,
  keyframes: [
    key(0, gaitSide(sk, "left", 16, 22, 0.01)),
    key(0.5, gaitSide(sk, "right", 16, 22, 0.01)),
    key(1.0, gaitSide(sk, "left", 16, 22, 0.01)),
  ],
});

/** Trot — a brisker lateral pace with a touch of suspension between beats. */
export const horseTrot = (sk: string): IAutoMovieMotion => {
  const air = pose(
    sk,
    [
      j("leftUpperArm", { flexion: -8 }),
      j("rightUpperArm", { flexion: -8 }),
      j("leftLowerArm", { flexion: 32 }),
      j("rightLowerArm", { flexion: 32 }),
      j("leftUpperLeg", { flexion: -8 }),
      j("rightUpperLeg", { flexion: -8 }),
      j("leftLowerLeg", { flexion: 32 }),
      j("rightLowerLeg", { flexion: 32 }),
      j("spine", { flexion: 4 }),
      ...tail(0, -2),
    ],
    root(0.09),
  );
  return {
    id: "trot",
    skeleton: sk,
    duration: 0.72,
    loop: true,
    keyframes: [
      key(0, gaitSide(sk, "left", 28, 40, 0.05)),
      key(0.18, air),
      key(0.36, gaitSide(sk, "right", 28, 40, 0.05)),
      key(0.54, air),
      key(0.72, gaitSide(sk, "left", 28, 40, 0.05)),
    ],
  };
};

/** Turn — a prancing pivot, heading swinging left then right, legs marching. */
export const horseTurn = (sk: string): IAutoMovieMotion => {
  const prance = (yaw: number, lift: "left" | "right"): IAutoMoviePose =>
    pose(
      sk,
      [
        j("leftUpperArm", { flexion: lift === "left" ? -40 : -8 }),
        j("leftLowerArm", { flexion: lift === "left" ? 70 : 20 }),
        j("rightUpperArm", { flexion: lift === "right" ? -40 : -8 }),
        j("rightLowerArm", { flexion: lift === "right" ? 70 : 20 }),
        j("leftUpperLeg", { flexion: 8 }),
        j("rightUpperLeg", { flexion: 8 }),
        j("neck", { flexion: -8 }),
        j("head", { flexion: -10, twist: yaw > 0 ? 16 : -16 }),
        ...tail(yaw > 0 ? 0.8 : -0.8),
      ],
      rootYaw(0.02, yaw),
    );
  return {
    id: "turn",
    skeleton: sk,
    duration: 2.2,
    loop: true,
    keyframes: [
      key(0, prance(-28, "left")),
      key(0.55, prance(-8, "right")),
      key(1.1, prance(0, "left")),
      key(1.65, prance(24, "right")),
      key(2.2, prance(-28, "left")),
    ],
  };
};

/** A short gallop-in-place burst that ends back at the gather pose. */
const gallopBurst = (sk: string): IAutoMovieMotion =>
  sequenceMotion("burst", [horseGallop(sk), horseGallop(sk)], false);

/**
 * A ~30 s mounted scenario: settle, walk on, trot up, break into a gallop, rear
 * and neigh, charge again, spin on the spot, trot, a second short rear, gallop,
 * and halt. The saddled rider rides every beat — leaning back through the rears
 * and turning with the spins.
 */
export const horsePerformance = (sk: string): IAutoMovieMotion =>
  sequenceMotion(
    "performance",
    [
      horseIdle(sk), // 2.4  settle
      horseWalk(sk), // 1.2  walk on
      horseWalk(sk), // 1.2
      horseTrot(sk), // 0.72 trot up
      horseTrot(sk), // 0.72
      horseTrot(sk), // 0.72
      gallopBurst(sk), // 1.24 break into gallop
      gallopBurst(sk), // 1.24
      horseRear(sk), // 2.6  rear + neigh
      gallopBurst(sk), // 1.24 charge on
      gallopBurst(sk), // 1.24
      horseTurn(sk), // 2.2  spin on the spot
      horseTrot(sk), // 0.72
      horseTrot(sk), // 0.72
      gallopBurst(sk), // 1.24
      horseRear(sk), // 2.6  second rear + neigh
      gallopBurst(sk), // 1.24
      gallopBurst(sk), // 1.24
      horseTrot(sk), // 0.72
      horseWalk(sk), // 1.2  ease to a walk
      horseIdle(sk), // 2.4  halt
    ],
    true,
  );

/** All horse clips, keyed by id. */
export const HORSE_CLIPS = (sk: string): Record<string, IAutoMovieMotion> => ({
  idle: horseIdle(sk),
  walk: horseWalk(sk),
  trot: horseTrot(sk),
  gallop: horseGallop(sk),
  gallopTravel: horseGallopTravel(sk),
  turn: horseTurn(sk),
  rear: horseRear(sk),
  performance: horsePerformance(sk),
});
