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
 * A small library of motion clips for the stick figure — the deliberate
 * exercise of autofilm's motion AST against the simplest possible body.
 *
 * Each clip is an {@link IAutoFilmMotion}: sparse keyframes the engine
 * interpolates (per-axis joint angles + an optional whole-body `root`
 * transform) with easing. Together they cover every degree of freedom the
 * motion layer offers — frontal-plane `abduction`, sagittal `flexion`, axial
 * `twist`, asymmetric single-limb articulation, and root translation / rotation
 * that moves the whole character through space.
 *
 * Because the rig is the normalized humanoid, any clip here replays unchanged
 * on a fleshed-out humanoid or an imported VRM.
 *
 * @author Samchon
 */

/** A joint articulation (unset axes default to 0 = rest). */
const j = (
  bone: AutoFilmHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoFilmJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});

/** A whole-body root placement: translation in meters, yaw in degrees about +Y. */
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

/** Jumping jacks — arms sweep overhead and legs splay in the frontal plane. */
export const jumpingJack = (sk: string): IAutoFilmMotion => {
  const closed = pose(sk, [
    j("leftUpperArm", { abduction: -72 }),
    j("rightUpperArm", { abduction: 72 }),
  ]);
  const open = pose(sk, [
    j("leftUpperArm", { abduction: 95 }),
    j("rightUpperArm", { abduction: -95 }),
    j("leftUpperLeg", { abduction: 18 }),
    j("rightUpperLeg", { abduction: -18 }),
  ]);
  return {
    id: "jumpingJack",
    skeleton: sk,
    duration: 1.0,
    loop: true,
    keyframes: [key(0, closed), key(0.5, open), key(1.0, closed)],
  };
};

/** A friendly wave — right arm held overhead, forearm swinging side to side. */
export const wave = (sk: string): IAutoFilmMotion => {
  const stanceArm = j("leftUpperArm", { abduction: -64 });
  const up = (fore: number): IAutoFilmPose =>
    pose(sk, [
      stanceArm,
      j("rightUpperArm", { abduction: -150 }),
      j("rightLowerArm", { abduction: fore }),
      j("leftUpperLeg", { abduction: 6 }),
      j("rightUpperLeg", { abduction: -6 }),
    ]);
  return {
    id: "wave",
    skeleton: sk,
    duration: 0.9,
    loop: true,
    keyframes: [key(0, up(28)), key(0.45, up(-22)), key(0.9, up(28))],
  };
};

/** A walk cycle in place — legs stride fore/aft, arms counter-swing. */
export const walk = (sk: string): IAutoFilmMotion => {
  // Arms hang down-and-out (abduction) and swing fore/aft via `flexion` (the
  // anatomical sagittal axis under HUMANOID_JOINT_AXES); `s` is the swing phase
  // in [−1, 1] (+1 = left arm back, right arm forward — opposing the legs).
  // Mirrored rest makes the same +flexion swing the left arm back and the right
  // arm forward. Specified in EVERY keyframe so they swing smoothly instead of
  // snapping back to the rest T-pose.
  const arms = (s: number): IAutoFilmJointPose[] => [
    j("leftUpperArm", { abduction: -58, flexion: 30 * s }),
    j("rightUpperArm", { abduction: 58, flexion: 30 * s }),
  ];
  // contact: `lead` leg forward (flexion −), `trail` leg back (flexion +).
  const contact = (lead: "left" | "right"): IAutoFilmPose => {
    const s = lead === "left" ? 1 : -1;
    return pose(sk, [
      j("leftUpperLeg", { flexion: -30 * s }),
      j("rightUpperLeg", { flexion: 30 * s }),
      j("leftLowerLeg", { flexion: lead === "left" ? 6 : 34 }),
      j("rightLowerLeg", { flexion: lead === "left" ? 34 : 6 }),
      ...arms(s),
    ]);
  };
  // passing: the swinging leg lifts (knee up) as it crosses under the body.
  const passing = (swing: "left" | "right"): IAutoFilmPose =>
    pose(sk, [
      j("leftUpperLeg", { flexion: swing === "left" ? -16 : -2 }),
      j("rightUpperLeg", { flexion: swing === "right" ? -16 : -2 }),
      j("leftLowerLeg", { flexion: swing === "left" ? 52 : 8 }),
      j("rightLowerLeg", { flexion: swing === "right" ? 52 : 8 }),
      ...arms(0),
    ]);
  return {
    id: "walk",
    skeleton: sk,
    duration: 1.0,
    loop: true,
    keyframes: [
      key(0, contact("left")),
      key(0.25, passing("right")),
      key(0.5, contact("right")),
      key(0.75, passing("left")),
      key(1.0, contact("left")),
    ],
  };
};

/** A hop — the whole body launches up (root translation) with a leg tuck. */
export const hop = (sk: string): IAutoFilmMotion => {
  // Arms specified in every keyframe (no rest-T-pose snap): down at rest, swept
  // back in the crouch, thrown up at the apex.
  const stand = pose(
    sk,
    [
      j("leftUpperArm", { abduction: -62 }),
      j("rightUpperArm", { abduction: 62 }),
    ],
    root(0, 0, 0, 0),
  );
  const crouch = pose(
    sk,
    [
      j("leftUpperLeg", { flexion: -26 }),
      j("rightUpperLeg", { flexion: -26 }),
      j("leftLowerLeg", { flexion: 46 }),
      j("rightLowerLeg", { flexion: 46 }),
      j("leftUpperArm", { abduction: -40, flexion: 38 }),
      j("rightUpperArm", { abduction: 40, flexion: 38 }),
    ],
    root(0, -0.12, 0, 0),
  );
  const apex = pose(
    sk,
    [
      j("leftUpperLeg", { flexion: -12 }),
      j("rightUpperLeg", { flexion: -12 }),
      j("leftLowerLeg", { flexion: 22 }),
      j("rightLowerLeg", { flexion: 22 }),
      j("leftUpperArm", { abduction: 120 }),
      j("rightUpperArm", { abduction: -120 }),
    ],
    root(0, 0.26, 0, 0),
  );
  return {
    id: "hop",
    skeleton: sk,
    duration: 1.0,
    loop: true,
    keyframes: [
      key(0, stand),
      key(0.22, crouch),
      key(0.5, apex),
      key(0.8, crouch),
      key(1.0, stand),
    ],
  };
};

/** A turn — the whole character yaws back and forth about its vertical axis. */
export const turn = (sk: string): IAutoFilmMotion => {
  const at = (yaw: number): IAutoFilmPose =>
    pose(
      sk,
      [
        j("leftUpperArm", { abduction: 35 }),
        j("rightUpperArm", { abduction: -35 }),
      ],
      root(0, 0, 0, yaw),
    );
  return {
    id: "turn",
    skeleton: sk,
    duration: 1.6,
    loop: true,
    keyframes: [key(0, at(-70)), key(0.8, at(70)), key(1.6, at(-70))],
  };
};

/** A run — bigger strides than the walk with an airborne flight phase. */
export const run = (sk: string): IAutoFilmMotion => {
  const lean = [j("spine", { flexion: 14 }), j("chest", { flexion: 8 })];
  const arms = (s: number): IAutoFilmJointPose[] => [
    j("leftUpperArm", { abduction: -45, flexion: 55 * s }),
    j("rightUpperArm", { abduction: 45, flexion: 55 * s }),
  ];
  const contact = (lead: "left" | "right"): IAutoFilmPose => {
    const s = lead === "left" ? 1 : -1;
    return pose(
      sk,
      [
        ...lean,
        j("leftUpperLeg", { flexion: -45 * s }),
        j("rightUpperLeg", { flexion: 45 * s }),
        j("leftLowerLeg", { flexion: lead === "left" ? 20 : 58 }),
        j("rightLowerLeg", { flexion: lead === "left" ? 58 : 20 }),
        ...arms(s),
      ],
      root(0, -0.03, 0, 0),
    );
  };
  const flight = (swing: "left" | "right"): IAutoFilmPose =>
    pose(
      sk,
      [
        ...lean,
        j("leftUpperLeg", { flexion: swing === "left" ? -35 : 10 }),
        j("rightUpperLeg", { flexion: swing === "right" ? -35 : 10 }),
        j("leftLowerLeg", { flexion: swing === "left" ? 85 : 25 }),
        j("rightLowerLeg", { flexion: swing === "right" ? 85 : 25 }),
        ...arms(0),
      ],
      root(0, 0.14, 0, 0),
    );
  return {
    id: "run",
    skeleton: sk,
    duration: 0.6,
    loop: true,
    keyframes: [
      key(0, contact("left")),
      key(0.15, flight("right")),
      key(0.3, contact("right")),
      key(0.45, flight("left")),
      key(0.6, contact("left")),
    ],
  };
};

/** A dance — hip sway, a twisting spine, and arms raised on alternating beats. */
export const dance = (sk: string): IAutoFilmMotion => {
  const beat = (d: number): IAutoFilmPose =>
    pose(
      sk,
      [
        j("spine", { twist: 18 * d }),
        j("chest", { twist: 12 * d }),
        j("leftUpperArm", { abduction: d > 0 ? 120 : 30 }),
        j("rightUpperArm", { abduction: d > 0 ? -30 : -120 }),
        j("leftLowerLeg", { flexion: 14 }),
        j("rightLowerLeg", { flexion: 14 }),
      ],
      root(0.06 * d, 0, 0, 14 * d),
    );
  return {
    id: "dance",
    skeleton: sk,
    duration: 1.4,
    loop: true,
    keyframes: [key(0, beat(-1)), key(0.7, beat(1)), key(1.4, beat(-1))],
  };
};

/** A high front kick with the right leg, arms thrown back for balance. */
export const kick = (sk: string): IAutoFilmMotion => {
  const stand = pose(sk, [
    j("leftUpperArm", { abduction: -60 }),
    j("rightUpperArm", { abduction: 60 }),
  ]);
  const windup = pose(sk, [
    j("rightUpperLeg", { flexion: 25 }),
    j("rightLowerLeg", { flexion: 32 }),
    j("spine", { flexion: -8 }),
    j("leftUpperArm", { abduction: -50, flexion: 22 }),
    j("rightUpperArm", { abduction: 50, flexion: 22 }),
  ]);
  const strike = pose(sk, [
    j("rightUpperLeg", { flexion: -88 }),
    j("rightLowerLeg", { flexion: 6 }),
    j("leftLowerLeg", { flexion: 6 }),
    j("spine", { flexion: -14 }),
    j("leftUpperArm", { abduction: -45, flexion: 38 }),
    j("rightUpperArm", { abduction: 45, flexion: 38 }),
  ]);
  return {
    id: "kick",
    skeleton: sk,
    duration: 1.0,
    loop: true,
    keyframes: [
      key(0, stand),
      key(0.25, windup),
      key(0.5, strike),
      key(0.72, windup),
      key(1.0, stand),
    ],
  };
};

/** A stitched routine: walk in, break into a run, jumping jacks, then a kick. */
export const combo = (sk: string): IAutoFilmMotion =>
  sequenceMotion(
    "combo",
    [walk(sk), walk(sk), run(sk), run(sk), jumpingJack(sk), kick(sk)],
    true,
  );

// ── shadow boxing — a ~15 s combination performance ─────────────────────────
// A bladed guard stance (hands up, knees soft, slight lean) is the base; every
// punch/kick merges its overrides over the guard and snaps back, then the beats
// are stitched with sequenceMotion. Arms use the humanoid axes (flexion swings
// fore/aft, abduction up/down), legs the default sagittal flexion.
const GUARD: IAutoFilmJointPose[] = [
  j("spine", { flexion: 9 }),
  j("chest", { flexion: 6 }),
  j("leftUpperArm", { flexion: -46, abduction: 28 }),
  j("leftLowerArm", { flexion: -108 }),
  j("rightUpperArm", { flexion: 46, abduction: -28 }),
  j("rightLowerArm", { flexion: 108 }),
  j("leftUpperLeg", { abduction: 9, flexion: -12 }),
  j("rightUpperLeg", { abduction: -9, flexion: 14 }),
  j("leftLowerLeg", { flexion: 14 }),
  j("rightLowerLeg", { flexion: 22 }),
];

export const shadowbox = (sk: string): IAutoFilmMotion => {
  const merge = (over: IAutoFilmJointPose[]): IAutoFilmPose => {
    const m = new Map(GUARD.map((x) => [x.bone, x] as const));
    for (const o of over) m.set(o.bone, o);
    return pose(sk, [...m.values()]);
  };
  const guard = merge([]);

  // each beat returns to guard; durations sum to ~15 s
  const beat = (
    dur: number,
    frames: [number, IAutoFilmPose][],
  ): IAutoFilmMotion => ({
    id: "beat",
    skeleton: sk,
    duration: dur,
    loop: false,
    keyframes: frames.map(([t, p]) => key(t, p)),
  });

  const jab = merge([
    j("leftUpperArm", { flexion: -92, abduction: 8 }),
    j("leftLowerArm", { flexion: -12 }),
    j("spine", { flexion: 9, twist: -10 }),
    j("chest", { flexion: 6, twist: -8 }),
  ]);
  const cross = merge([
    j("rightUpperArm", { flexion: 92, abduction: -8 }),
    j("rightLowerArm", { flexion: 14 }),
    j("spine", { flexion: 9, twist: 24 }),
    j("chest", { flexion: 6, twist: 16 }),
    j("rightUpperLeg", { abduction: -9, flexion: 2 }),
  ]);
  const leftHook = merge([
    j("leftUpperArm", { flexion: -56, abduction: 6 }),
    j("leftLowerArm", { flexion: -96 }),
    j("spine", { flexion: 9, twist: 20 }),
    j("chest", { flexion: 6, twist: 14 }),
  ]);
  const uppercut = merge([
    j("rightUpperArm", { flexion: 58, abduction: -52 }),
    j("rightLowerArm", { flexion: 128 }),
    j("spine", { flexion: 2, twist: 16 }),
    j("chest", { flexion: 0, twist: 12 }),
  ]);
  const slip = (d: number): IAutoFilmPose =>
    merge([
      j("spine", { flexion: 12, abduction: 16 * d, twist: 6 * d }),
      j("chest", { flexion: 8, abduction: 12 * d }),
    ]);
  // right front kick: chamber the knee, then snap the shin out and up
  const chamberK = merge([
    j("rightUpperLeg", { flexion: -42 }),
    j("rightLowerLeg", { flexion: 86 }),
    j("spine", { flexion: -4 }),
  ]);
  const frontKick = merge([
    j("rightUpperLeg", { flexion: -88 }),
    j("rightLowerLeg", { flexion: 8 }),
    j("leftLowerLeg", { flexion: 8 }),
    j("spine", { flexion: -14 }),
    j("leftUpperArm", { flexion: -30, abduction: 36 }),
  ]);
  // right roundhouse: chamber across, swing high to the side
  const chamberR = merge([
    j("rightUpperLeg", { flexion: -36, abduction: -34 }),
    j("rightLowerLeg", { flexion: 78 }),
    j("spine", { twist: 14, flexion: 4 }),
  ]);
  const roundhouse = merge([
    j("rightUpperLeg", { flexion: -52, abduction: -40, twist: -30 }),
    j("rightLowerLeg", { flexion: 18 }),
    j("spine", { twist: 30, abduction: -10, flexion: 6 }),
    j("chest", { twist: 18 }),
    j("leftUpperArm", { flexion: -20, abduction: 40 }),
  ]);

  return sequenceMotion(
    "shadowbox",
    [
      beat(0.7, [
        [0, guard],
        [0.7, guard],
      ]), // settle
      beat(0.45, [
        [0, guard],
        [0.18, jab],
        [0.45, guard],
      ]), // jab
      beat(0.45, [
        [0, guard],
        [0.18, jab],
        [0.45, guard],
      ]), // double jab
      beat(0.6, [
        [0, guard],
        [0.28, cross],
        [0.6, guard],
      ]), // cross
      beat(0.6, [
        [0, guard],
        [0.3, leftHook],
        [0.6, guard],
      ]), // hook
      beat(1.0, [
        [0, guard],
        [0.5, slip(-1)],
        [1.0, guard],
      ]), // slip
      beat(0.5, [
        [0, guard],
        [0.2, jab],
        [0.5, guard],
      ]), // jab
      beat(0.65, [
        [0, guard],
        [0.3, cross],
        [0.65, guard],
      ]), // cross
      beat(1.4, [
        [0, guard],
        [0.4, chamberK],
        [0.7, frontKick],
        [1.0, chamberK],
        [1.4, guard],
      ]), // front kick
      beat(1.0, [
        [0, guard],
        [0.5, slip(1)],
        [1.0, guard],
      ]), // slip other way
      beat(0.6, [
        [0, guard],
        [0.28, uppercut],
        [0.6, guard],
      ]), // uppercut
      beat(0.5, [
        [0, guard],
        [0.2, jab],
        [0.5, guard],
      ]), // jab
      beat(0.65, [
        [0, guard],
        [0.3, cross],
        [0.65, guard],
      ]), // cross
      beat(1.6, [
        [0, guard],
        [0.45, chamberR],
        [0.78, roundhouse],
        [1.1, chamberR],
        [1.6, guard],
      ]), // roundhouse high kick
      beat(0.45, [
        [0, guard],
        [0.18, jab],
        [0.45, guard],
      ]), // jab
      beat(0.6, [
        [0, guard],
        [0.28, cross],
        [0.6, guard],
      ]), // cross
      beat(0.5, [
        [0, guard],
        [0.22, leftHook],
        [0.5, guard],
      ]), // hook
      beat(0.9, [
        [0, guard],
        [0.9, guard],
      ]), // reset
    ],
    true,
  );
};

/** All clips, keyed by id — the demo's selectable set. */
export const STICKMAN_CLIPS = (
  sk: string,
): Record<string, IAutoFilmMotion> => ({
  jumpingJack: jumpingJack(sk),
  wave: wave(sk),
  walk: walk(sk),
  run: run(sk),
  hop: hop(sk),
  kick: kick(sk),
  dance: dance(sk),
  turn: turn(sk),
  combo: combo(sk),
  shadowbox: shadowbox(sk),
});
