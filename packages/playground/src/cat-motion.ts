import {
  CAT_PROFILE,
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
 * Motion clips for the stick cat. Core locomotion is generated from
 * `CAT_PROFILE`; non-gait beats such as idle, sit, stretch, and tail flick stay
 * handwritten until they get their own Profile action shape.
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

const root = (
  x: number,
  y: number,
  z: number,
  yawDeg: number,
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, yawDeg),
  scale: { x: 1, y: 1, z: 1 },
});

const pose = (
  skeleton: string,
  joints: IAutoMovieJointPose[],
  r: IAutoMovieTransform | null = null,
): IAutoMoviePose => ({ skeleton, root: r, joints });

const key = (time: number, p: IAutoMoviePose): IAutoMovieKeyframe => ({
  time,
  pose: p,
  expression: null,
  easing: "easeInOut",
  bezier: null,
});

const profileClip = (
  sk: string,
  name: "walk" | "leap" | "stalk",
): IAutoMovieMotion => bindProfileGaits(CAT_PROFILE, sk, 24)[name]!;

/** The tail as an S-curve: `sway` in [-1, 1], `curl` raises or drops it. */
const tail = (sway: number, curl = 0): IAutoMovieJointPose[] => [
  j("leftLittleProximal", { abduction: 22 * sway, flexion: -18 + curl }),
  j("leftLittleIntermediate", { abduction: 26 * sway, flexion: -14 + curl }),
  j("leftLittleDistal", { abduction: 30 * sway, flexion: -10 + curl }),
];

/** Idle - a standing cat with a slowly swaying tail and a breathing head. */
export const catIdle = (sk: string): IAutoMovieMotion => ({
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

/** Walk - the Profile-generated diagonal-pair gait. */
export const catWalk = (sk: string): IAutoMovieMotion =>
  profileClip(sk, "walk");

/** Leap - the Profile-generated crouch and spring beat. */
export const catLeap = (sk: string): IAutoMovieMotion =>
  profileClip(sk, "leap");

/** Stalk - the Profile-generated slower crouched gait. */
export const catStalk = (sk: string): IAutoMovieMotion =>
  profileClip(sk, "stalk");

/** Sit - hind legs fold under, the front half lifts upright, tail sways. */
export const catSit = (sk: string): IAutoMovieMotion => {
  const sitting = (sway: number): IAutoMoviePose =>
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

/** Stretch - a play-bow: front end down and forward, hindquarters raised. */
export const catStretch = (sk: string): IAutoMovieMotion => {
  const neutral = pose(sk, [...tail(0)]);
  const bow = pose(
    sk,
    [
      // Front legs reach forward, chest drops to the floor.
      j("leftUpperArm", { flexion: -42 }),
      j("rightUpperArm", { flexion: -42 }),
      j("spine", { flexion: 38 }),
      j("chest", { flexion: 26 }),
      j("neck", { flexion: -30 }),
      // Hind legs stay straight with the rump raised.
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

/** Tail flick - body still, the tail whips side to side, head turns to watch. */
export const catTailFlick = (sk: string): IAutoMovieMotion => {
  const flick = (sway: number): IAutoMoviePose =>
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
export const catCombo = (sk: string): IAutoMovieMotion =>
  sequenceMotion(
    "combo",
    [catWalk(sk), catWalk(sk), catLeap(sk), catStretch(sk), catSit(sk)],
    true,
  );

/**
 * Traveling clips - locomotion baked to cross the floor for a follow camera.
 * `prowl` is the walk gait carried forward at ~0.45 m/s; `bound` chains leaps
 * into a forward-traveling pronk.
 */
export const catProwl = (sk: string): IAutoMovieMotion =>
  travelMotion("prowl", catWalk(sk), 8, { x: 0, y: 0, z: 0.45 });
export const catBound = (sk: string): IAutoMovieMotion =>
  travelMotion("bound", catLeap(sk), 5, { x: 0, y: 0, z: 0.95 });

/** All cat clips, keyed by id. */
export const CAT_CLIPS = (sk: string): Record<string, IAutoMovieMotion> => ({
  idle: catIdle(sk),
  walk: catWalk(sk),
  leap: catLeap(sk),
  stalk: catStalk(sk),
  sit: catSit(sk),
  stretch: catStretch(sk),
  tailFlick: catTailFlick(sk),
  combo: catCombo(sk),
  prowl: catProwl(sk),
  bound: catBound(sk),
});
