import { Quaternion } from "@autofilm/engine";
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

/** The tail as an S-curve, swayed by `d` ∈ [−1, 1]. */
const tail = (d: number): IAutoFilmJointPose[] => [
  j("leftLittleProximal", { abduction: 22 * d, flexion: -18 }),
  j("leftLittleIntermediate", { abduction: 26 * d, flexion: -14 }),
  j("leftLittleDistal", { abduction: 30 * d, flexion: -10 }),
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

/** All cat clips, keyed by id. */
export const CAT_CLIPS = (sk: string): Record<string, IAutoFilmMotion> => ({
  idle: catIdle(sk),
});
