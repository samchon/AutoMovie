import { Quaternion, sequenceMotion } from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmJointPose,
  IAutoFilmKeyframe,
  IAutoFilmMotion,
  IAutoFilmPose,
  IAutoFilmTransform,
} from "@autofilm/interface";

/**
 * Motion clips for the stick cat. The cat rig keeps all four legs pointing down
 * at rest, so the engine's default clinical axes already swing them sagittally
 * (no HUMANOID_JOINT_AXES) — `flexion` strides a leg, `abduction` splays it,
 * and spine `flexion` arches the back. The tail rides the repurposed finger
 * chain.
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

const root = (
  x: number,
  y: number,
  z: number,
  yawDeg: number,
): IAutoFilmTransform => ({
  translation: { x, y, z },
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, yawDeg),
  scale: { x: 1, y: 1, z: 1 },
});

const pose = (
  skeleton: string,
  joints: IAutoFilmJointPose[],
  r: IAutoFilmTransform | null = null,
): IAutoFilmPose => ({ skeleton, root: r, joints });

const key = (time: number, p: IAutoFilmPose): IAutoFilmKeyframe => ({
  time,
  pose: p,
  expression: null,
  easing: "easeInOut",
  bezier: null,
});

/** The tail as an S-curve: `sway` ∈ [−1, 1] side to side, `curl` raises/drops. */
const tail = (sway: number, curl = 0): IAutoFilmJointPose[] => [
  j("leftLittleProximal", { abduction: 22 * sway, flexion: -18 + curl }),
  j("leftLittleIntermediate", { abduction: 26 * sway, flexion: -14 + curl }),
  j("leftLittleDistal", { abduction: 30 * sway, flexion: -10 + curl }),
];

/** Idle — a standing cat with a slowly swaying tail and a breathing head. */
export const catIdle = (sk: string): IAutoFilmMotion => ({
  id: "idle",
  skeleton: sk,
  duration: 2.0,
  loop: true,
  keyframes: [
    key(0, pose(sk, [...tail(-1), j("head", { flexion: 2 })])),
    key(1.0, pose(sk, [...tail(1), j("head", { flexion: -3 })])),
    key(2.0, pose(sk, [...tail(-1), j("head", { flexion: 2 })])),
  ],
});

/** Walk — a diagonal-pair gait (front-left swings with hind-right, then swap). */
export const catWalk = (sk: string): IAutoFilmMotion => {
  // d=+1: front-left + hind-right swing forward (flexion −), the other diagonal
  // pushes back; the forward-swinging legs bend their knee/elbow.
  const step = (d: number): IAutoFilmPose =>
    pose(
      sk,
      [
        j("leftUpperArm", { flexion: -24 * d }),
        j("leftLowerArm", { flexion: d > 0 ? 36 : 14 }),
        j("rightUpperArm", { flexion: 24 * d }),
        j("rightLowerArm", { flexion: d > 0 ? 14 : 36 }),
        j("leftUpperLeg", { flexion: 24 * d }),
        j("leftLowerLeg", { flexion: d > 0 ? 18 : 44 }),
        j("rightUpperLeg", { flexion: -24 * d }),
        j("rightLowerLeg", { flexion: d > 0 ? 44 : 18 }),
        ...tail(0.5 * d),
        j("head", { flexion: -4 }),
      ],
      root(0, -0.004, 0, 0),
    );
  return {
    id: "walk",
    skeleton: sk,
    duration: 0.8,
    loop: true,
    keyframes: [key(0, step(1)), key(0.4, step(-1)), key(0.8, step(1))],
  };
};

/** Leap — crouch, spring straight up with legs tucked, land. */
export const catLeap = (sk: string): IAutoFilmMotion => {
  const stand = pose(sk, [...tail(0)], root(0, 0, 0, 0));
  const crouch = pose(
    sk,
    [
      j("leftUpperArm", { flexion: -22 }),
      j("leftLowerArm", { flexion: 52 }),
      j("rightUpperArm", { flexion: -22 }),
      j("rightLowerArm", { flexion: 52 }),
      j("leftUpperLeg", { flexion: -38 }),
      j("leftLowerLeg", { flexion: 92 }),
      j("rightUpperLeg", { flexion: -38 }),
      j("rightLowerLeg", { flexion: 92 }),
      j("neck", { flexion: 22 }),
      j("head", { flexion: 18 }),
      ...tail(0, 8),
    ],
    root(0, -0.13, 0, 0),
  );
  const air = pose(
    sk,
    [
      j("leftUpperArm", { flexion: -34 }),
      j("leftLowerArm", { flexion: 42 }),
      j("rightUpperArm", { flexion: -34 }),
      j("rightLowerArm", { flexion: 42 }),
      j("leftUpperLeg", { flexion: 34 }),
      j("leftLowerLeg", { flexion: 58 }),
      j("rightUpperLeg", { flexion: 34 }),
      j("rightLowerLeg", { flexion: 58 }),
      j("neck", { flexion: -12 }),
      ...tail(0, -22),
    ],
    root(0, 0.24, 0, 0),
  );
  return {
    id: "leap",
    skeleton: sk,
    duration: 1.0,
    loop: true,
    keyframes: [
      key(0, stand),
      key(0.3, crouch),
      key(0.52, air),
      key(0.78, crouch),
      key(1.0, stand),
    ],
  };
};

/** Sit — hind legs fold under, the front half lifts upright, tail sways. */
export const catSit = (sk: string): IAutoFilmMotion => {
  const sitting = (sway: number): IAutoFilmPose =>
    pose(
      sk,
      [
        j("leftUpperLeg", { flexion: 78 }),
        j("leftLowerLeg", { flexion: 128 }),
        j("rightUpperLeg", { flexion: 78 }),
        j("rightLowerLeg", { flexion: 128 }),
        j("spine", { flexion: -32 }),
        j("chest", { flexion: -22 }),
        j("neck", { flexion: -18 }),
        ...tail(sway, 10),
      ],
      root(0, -0.05, 0, 0),
    );
  return {
    id: "sit",
    skeleton: sk,
    duration: 2.2,
    loop: true,
    keyframes: [
      key(0, sitting(-0.6)),
      key(1.1, sitting(0.6)),
      key(2.2, sitting(-0.6)),
    ],
  };
};

/** Stretch — a play-bow: front end down and forward, hindquarters raised. */
export const catStretch = (sk: string): IAutoFilmMotion => {
  const neutral = pose(sk, [...tail(0)]);
  const bow = pose(
    sk,
    [
      // front legs reach forward, chest drops to the floor
      j("leftUpperArm", { flexion: -42 }),
      j("rightUpperArm", { flexion: -42 }),
      j("spine", { flexion: 38 }),
      j("chest", { flexion: 26 }),
      j("neck", { flexion: -30 }),
      // hind legs straight, rump up
      j("leftUpperLeg", { flexion: -10 }),
      j("rightUpperLeg", { flexion: -10 }),
      ...tail(0, -26),
    ],
    root(0, 0.03, 0, 0),
  );
  return {
    id: "stretch",
    skeleton: sk,
    duration: 1.8,
    loop: true,
    keyframes: [key(0, neutral), key(0.8, bow), key(1.8, neutral)],
  };
};

/** Tail flick — body still, the tail whips side to side, head turns to watch. */
export const catTailFlick = (sk: string): IAutoFilmMotion => {
  const flick = (sway: number): IAutoFilmPose =>
    pose(sk, [...tail(sway), j("head", { twist: 18 * sway })]);
  return {
    id: "tailFlick",
    skeleton: sk,
    duration: 0.7,
    loop: true,
    keyframes: [key(0, flick(-1)), key(0.35, flick(1)), key(0.7, flick(-1))],
  };
};

/** A stitched performance: trot a couple of strides, leap, stretch, then sit. */
export const catCombo = (sk: string): IAutoFilmMotion =>
  sequenceMotion(
    "combo",
    [catWalk(sk), catWalk(sk), catLeap(sk), catStretch(sk), catSit(sk)],
    true,
  );

/** All cat clips, keyed by id. */
export const CAT_CLIPS = (sk: string): Record<string, IAutoFilmMotion> => ({
  idle: catIdle(sk),
  walk: catWalk(sk),
  leap: catLeap(sk),
  sit: catSit(sk),
  stretch: catStretch(sk),
  tailFlick: catTailFlick(sk),
  combo: catCombo(sk),
});
