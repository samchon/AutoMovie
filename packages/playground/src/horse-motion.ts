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

/** A performance: gallop a few strides in place, then rear up and neigh. */
export const horsePerformance = (sk: string): IAutoFilmMotion =>
  sequenceMotion(
    "performance",
    [horseGallop(sk), horseGallop(sk), horseGallop(sk), horseRear(sk)],
    true,
  );

/** All horse clips, keyed by id. */
export const HORSE_CLIPS = (sk: string): Record<string, IAutoFilmMotion> => ({
  idle: horseIdle(sk),
  gallop: horseGallop(sk),
  gallopTravel: horseGallopTravel(sk),
  rear: horseRear(sk),
  performance: horsePerformance(sk),
});
