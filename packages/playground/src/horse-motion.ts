import { Quaternion, sequenceMotion, travelMotion } from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmJointPose,
  IAutoFilmKeyframe,
  IAutoFilmMotion,
  IAutoFilmPose,
  IAutoFilmTransform,
} from "@autofilm/interface";

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
  bone: AutoFilmHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoFilmJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});

const root = (y: number, pitch = 0): IAutoFilmTransform => ({
  translation: { x: 0, y, z: 0 },
  rotation: Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, pitch),
  scale: { x: 1, y: 1, z: 1 },
});

/** A root placement with a heading change (yaw about +Y, degrees). */
const rootYaw = (y: number, yawDeg: number): IAutoFilmTransform => ({
  translation: { x: 0, y, z: 0 },
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, yawDeg),
  scale: { x: 1, y: 1, z: 1 },
});

const pose = (
  sk: string,
  joints: IAutoFilmJointPose[],
  r: IAutoFilmTransform | null = null,
): IAutoFilmPose => ({ skeleton: sk, root: r, joints });

const key = (time: number, p: IAutoFilmPose): IAutoFilmKeyframe => ({
  time,
  pose: p,
  expression: null,
  easing: "easeInOut",
  bezier: null,
});

/** Tail as a trailing S-curve; `sway` ∈ [−1,1], `lift` raises the whole tail. */
const tail = (sway: number, lift = 0): IAutoFilmJointPose[] => [
  j("leftLittleProximal", { abduction: 16 * sway, flexion: 10 + lift }),
  j("leftLittleIntermediate", { abduction: 20 * sway, flexion: 14 + lift }),
  j("leftLittleDistal", { abduction: 24 * sway, flexion: 16 + lift }),
];

/** Idle — standing square, tail swaying, head and neck breathing gently. */
export const horseIdle = (sk: string): IAutoFilmMotion => ({
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
 * Gallop — a rocking four-beat cycle: gather (airborne, legs tucked), front
 * legs reach and land, hind legs push off, repeat. Authored in place; wrap with
 * `travelMotion` to actually charge forward.
 */
export const horseGallop = (sk: string): IAutoFilmMotion => {
  const front = (up: number, knee: number): IAutoFilmJointPose[] => [
    j("leftUpperArm", { flexion: up }),
    j("rightUpperArm", { flexion: up }),
    j("leftLowerArm", { flexion: knee }),
    j("rightLowerArm", { flexion: knee }),
  ];
  const hind = (up: number, hock: number): IAutoFilmJointPose[] => [
    j("leftUpperLeg", { flexion: up }),
    j("rightUpperLeg", { flexion: up }),
    j("leftLowerLeg", { flexion: hock }),
    j("rightLowerLeg", { flexion: hock }),
  ];
  const gather = pose(
    sk,
    [
      ...front(-12, 78),
      ...hind(-22, 86),
      j("spine", { flexion: 14 }),
      j("chest", { flexion: 8 }),
      j("neck", { flexion: 10 }),
      ...tail(0, -6),
    ],
    root(0.16),
  );
  const reach = pose(
    sk,
    [
      ...front(-46, 12),
      ...hind(-34, 64),
      j("spine", { flexion: -6 }),
      j("neck", { flexion: 2 }),
      ...tail(0, -2),
    ],
    root(0.02),
  );
  const push = pose(
    sk,
    [
      ...front(34, 22),
      ...hind(46, 12),
      j("spine", { flexion: -12 }),
      j("chest", { flexion: -6 }),
      j("neck", { flexion: -4 }),
      ...tail(0, 4),
    ],
    root(-0.02),
  );
  return {
    id: "gallop",
    skeleton: sk,
    duration: 0.62,
    loop: true,
    keyframes: [
      key(0, gather),
      key(0.2, reach),
      key(0.42, push),
      key(0.62, gather),
    ],
  };
};

/** Gallop that charges forward (~5 m/s), for a follow camera. */
export const horseGallopTravel = (sk: string): IAutoFilmMotion =>
  travelMotion("gallopTravel", horseGallop(sk), 8, { x: 0, y: 0, z: 5 });

/**
 * Rear — the horse pitches up on its hind legs, front legs pawing the air, head
 * tossing as it neighs ("히히힝"), then drops back down. A one-shot beat (negative
 * spine flexion pitches the whole front end up, carrying a saddled rider back
 * with it).
 */
export const horseRear = (sk: string): IAutoFilmMotion => {
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
  const rearUp = (toss: number): IAutoFilmPose =>
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

/** Walk — a slow, even diagonal-pair gait (in place), head nodding. */
export const horseWalk = (sk: string): IAutoFilmMotion => {
  const step = (d: number): IAutoFilmPose =>
    pose(
      sk,
      [
        j("leftUpperArm", { flexion: -16 * d }),
        j("leftLowerArm", { flexion: d > 0 ? 28 : 14 }),
        j("rightUpperArm", { flexion: 16 * d }),
        j("rightLowerArm", { flexion: d > 0 ? 14 : 28 }),
        j("leftUpperLeg", { flexion: 16 * d }),
        j("leftLowerLeg", { flexion: d > 0 ? 14 : 26 }),
        j("rightUpperLeg", { flexion: -16 * d }),
        j("rightLowerLeg", { flexion: d > 0 ? 26 : 14 }),
        j("neck", { flexion: 6 + 4 * d }),
        j("head", { flexion: -6 }),
        ...tail(0.4 * d),
      ],
      root(0.01 * d),
    );
  return {
    id: "walk",
    skeleton: sk,
    duration: 1.2,
    loop: true,
    keyframes: [key(0, step(1)), key(0.6, step(-1)), key(1.2, step(1))],
  };
};

/** Trot — a brisk two-beat diagonal gait with a touch of suspension. */
export const horseTrot = (sk: string): IAutoFilmMotion => {
  const beat2 = (d: number): IAutoFilmPose =>
    pose(
      sk,
      [
        j("leftUpperArm", { flexion: -30 * d }),
        j("leftLowerArm", { flexion: d > 0 ? 40 : 18 }),
        j("rightUpperArm", { flexion: 30 * d }),
        j("rightLowerArm", { flexion: d > 0 ? 18 : 40 }),
        j("leftUpperLeg", { flexion: 30 * d }),
        j("leftLowerLeg", { flexion: d > 0 ? 18 : 46 }),
        j("rightUpperLeg", { flexion: -30 * d }),
        j("rightLowerLeg", { flexion: d > 0 ? 46 : 18 }),
        j("neck", { flexion: 2 }),
        ...tail(0.6 * d, -2),
      ],
      root(0.05),
    );
  const suspend = pose(
    sk,
    [
      j("leftLowerArm", { flexion: 30 }),
      j("rightLowerArm", { flexion: 30 }),
      j("leftLowerLeg", { flexion: 32 }),
      j("rightLowerLeg", { flexion: 32 }),
      ...tail(0, -4),
    ],
    root(0.1),
  );
  return {
    id: "trot",
    skeleton: sk,
    duration: 0.72,
    loop: true,
    keyframes: [
      key(0, beat2(1)),
      key(0.18, suspend),
      key(0.36, beat2(-1)),
      key(0.54, suspend),
      key(0.72, beat2(1)),
    ],
  };
};

/** Turn — a prancing pivot, heading swinging left then right, legs marching. */
export const horseTurn = (sk: string): IAutoFilmMotion => {
  const prance = (yaw: number, lift: "left" | "right"): IAutoFilmPose =>
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
const gallopBurst = (sk: string): IAutoFilmMotion =>
  sequenceMotion("burst", [horseGallop(sk), horseGallop(sk)], false);

/**
 * A ~30 s mounted scenario: settle, walk on, trot up, break into a gallop, rear
 * and neigh, charge again, spin on the spot, trot, a second short rear, gallop,
 * and halt. The saddled rider rides every beat — leaning back through the rears
 * and turning with the spins.
 */
export const horsePerformance = (sk: string): IAutoFilmMotion =>
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
export const HORSE_CLIPS = (sk: string): Record<string, IAutoFilmMotion> => ({
  idle: horseIdle(sk),
  walk: horseWalk(sk),
  trot: horseTrot(sk),
  gallop: horseGallop(sk),
  gallopTravel: horseGallopTravel(sk),
  turn: horseTurn(sk),
  rear: horseRear(sk),
  performance: horsePerformance(sk),
});
