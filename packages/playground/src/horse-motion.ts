import {
  HORSE_PROFILE,
  Quaternion,
  bindProfileGaits,
  sequenceMotion,
  travelMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieTransform,
} from "@automovie/interface";

/**
 * Motion clips for the stick horse. Core locomotion is generated from
 * `HORSE_PROFILE`; non-gait beats such as idle, rear, and turn stay handwritten
 * until they get their own Profile action shape.
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

const profileClip = (
  sk: string,
  name: "walk" | "trot" | "gallop",
): IAutoMovieMotion => bindProfileGaits(HORSE_PROFILE, sk, 24)[name]!;

/** Tail as a trailing S-curve; `sway` in [-1, 1], `lift` raises the tail. */
const tail = (sway: number, lift = 0): IAutoMovieJointPose[] => [
  j("leftLittleProximal", { abduction: 16 * sway, flexion: 10 + lift }),
  j("leftLittleIntermediate", { abduction: 20 * sway, flexion: 14 + lift }),
  j("leftLittleDistal", { abduction: 24 * sway, flexion: 16 + lift }),
];

/** Idle - standing square, tail swaying, head and neck breathing gently. */
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

/** Walk - the Profile-generated lateral-pair gait. */
export const horseWalk = (sk: string): IAutoMovieMotion =>
  profileClip(sk, "walk");

/** Trot - the Profile-generated brisker lateral pace. */
export const horseTrot = (sk: string): IAutoMovieMotion =>
  profileClip(sk, "trot");

/** Gallop - the Profile-generated lateral-pair bound. */
export const horseGallop = (sk: string): IAutoMovieMotion =>
  profileClip(sk, "gallop");

/** Gallop that charges forward (~5 m/s), for a follow camera. */
export const horseGallopTravel = (sk: string): IAutoMovieMotion =>
  travelMotion("gallopTravel", horseGallop(sk), 8, { x: 0, y: 0, z: 5 });

/**
 * Rear - a one-shot beat that still needs root pitch, so it stays handwritten
 * until Profile actions can express non-cyclic body transforms.
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
        j("leftUpperArm", { flexion: -72, abduction: 8 }),
        j("rightUpperArm", { flexion: -84, abduction: -8 }),
        j("leftLowerArm", { flexion: 96 }),
        j("rightLowerArm", { flexion: 110 }),
        j("leftUpperLeg", { flexion: 6 }),
        j("rightUpperLeg", { flexion: 6 }),
        j("leftLowerLeg", { flexion: 30 }),
        j("rightLowerLeg", { flexion: 30 }),
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
      key(1.25, rearUp(16)),
      key(1.6, rearUp(2)),
      key(1.95, rearUp(14)),
      key(2.3, coil),
      key(2.6, stand),
    ],
  };
};

/** Turn - a prancing pivot, heading swinging left then right, legs marching. */
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
 * A mounted scenario: settle, walk on, trot up, break into a gallop, rear,
 * charge again, spin on the spot, trot, a second short rear, gallop, and halt.
 */
export const horsePerformance = (sk: string): IAutoMovieMotion =>
  sequenceMotion(
    "performance",
    [
      horseIdle(sk),
      horseWalk(sk),
      horseWalk(sk),
      horseTrot(sk),
      horseTrot(sk),
      horseTrot(sk),
      gallopBurst(sk),
      gallopBurst(sk),
      horseRear(sk),
      gallopBurst(sk),
      gallopBurst(sk),
      horseTurn(sk),
      horseTrot(sk),
      horseTrot(sk),
      gallopBurst(sk),
      horseRear(sk),
      gallopBurst(sk),
      gallopBurst(sk),
      horseTrot(sk),
      horseWalk(sk),
      horseIdle(sk),
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
