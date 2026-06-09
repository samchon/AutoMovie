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
  // a runner pumps with the elbows held bent ~90° (forearms up), swinging
  // fore/aft from the shoulder — not straight arms windmilling
  const arms = (s: number): IAutoFilmJointPose[] => [
    j("leftUpperArm", { abduction: -42, flexion: 48 * s }),
    j("leftLowerArm", { flexion: -88 }),
    j("rightUpperArm", { abduction: 42, flexion: 48 * s }),
    j("rightLowerArm", { flexion: 88 }),
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

/**
 * Traveling clips — the in-place locomotion cycles baked to actually cross the
 * floor (so a follow camera has something to track). `stroll` is the walk at
 * ~0.6 m/s, `sprint` the run at ~2 m/s, both forward (+Z, the way the figure
 * faces).
 */
export const stroll = (sk: string): IAutoFilmMotion =>
  travelMotion("stroll", walk(sk), 6, { x: 0, y: 0, z: 0.62 });
export const sprint = (sk: string): IAutoFilmMotion =>
  travelMotion("sprint", run(sk), 9, { x: 0, y: 0, z: 2.0 });

// ── shadow boxing — a ~30 s precision kickboxing round ───────────────────────
// A bladed guard stance (hands up, knees soft, slight lean) is the base pose;
// every technique merges its overrides over the guard and snaps back, and the
// beats are stitched with sequenceMotion into one round. Arms use the humanoid
// axes (flexion swings fore/aft, abduction up/down), legs the default sagittal
// flexion. Footwork rides the root (step in/out, lateral), returning to centre
// inside each beat so the fighter stays framed. The aim is a light, crisp,
// real-fighter feel: jabs/crosses/hooks/uppercuts, slips/weaves/ducks, push
// kicks, knees, and high round/axe kicks woven together.
const GUARD: IAutoFilmJointPose[] = [
  j("spine", { flexion: 9 }),
  j("chest", { flexion: 6 }),
  j("leftUpperArm", { flexion: -38, abduction: -58 }),
  j("leftLowerArm", { flexion: -122 }),
  j("rightUpperArm", { flexion: 38, abduction: 58 }),
  j("rightLowerArm", { flexion: 122 }),
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
  // a step: the same pose carried on a translated root (footwork)
  const at = (p: IAutoFilmPose, x: number, z: number): IAutoFilmPose => ({
    ...p,
    root: root(x, 0, z, 0),
  });

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

  // ── hands ──────────────────────────────────────────────────────────────
  const jab = merge([
    j("leftUpperArm", { flexion: -94, abduction: 6 }),
    j("leftLowerArm", { flexion: -8 }),
    j("spine", { flexion: 9, twist: -12 }),
    j("chest", { flexion: 6, twist: -8 }),
  ]);
  const cross = merge([
    j("rightUpperArm", { flexion: 94, abduction: -6 }),
    j("rightLowerArm", { flexion: 10 }),
    j("spine", { flexion: 9, twist: 26 }),
    j("chest", { flexion: 6, twist: 18 }),
    j("rightUpperLeg", { abduction: -9, flexion: 4 }),
  ]);
  const leadHook = merge([
    j("leftUpperArm", { flexion: -54, abduction: 8 }),
    j("leftLowerArm", { flexion: -94 }),
    j("spine", { flexion: 9, twist: 22 }),
    j("chest", { flexion: 6, twist: 16 }),
  ]);
  const rearHook = merge([
    j("rightUpperArm", { flexion: 54, abduction: -8 }),
    j("rightLowerArm", { flexion: 94 }),
    j("spine", { flexion: 9, twist: -18 }),
    j("chest", { flexion: 6, twist: -12 }),
  ]);
  const leadUpper = merge([
    j("leftUpperArm", { flexion: -52, abduction: 42 }),
    j("leftLowerArm", { flexion: -126 }),
    j("spine", { flexion: 4, twist: 12 }),
    j("chest", { flexion: 2, twist: 8 }),
  ]);
  const rearUpper = merge([
    j("rightUpperArm", { flexion: 56, abduction: -48 }),
    j("rightLowerArm", { flexion: 126 }),
    j("spine", { flexion: 2, twist: 16 }),
    j("chest", { flexion: 0, twist: 12 }),
  ]);

  // ── defence ────────────────────────────────────────────────────────────
  const slip = (d: number): IAutoFilmPose =>
    merge([
      j("spine", { flexion: 12, abduction: 16 * d, twist: 6 * d }),
      j("chest", { flexion: 8, abduction: 12 * d }),
    ]);
  // weave: a deep bob to one side, knees bending and the head dropping under
  const weave = (d: number): IAutoFilmPose => ({
    ...merge([
      j("spine", { flexion: 16, abduction: 22 * d, twist: 10 * d }),
      j("chest", { flexion: 10, abduction: 16 * d }),
      j("leftUpperLeg", { abduction: 9, flexion: -18 }),
      j("rightUpperLeg", { abduction: -9, flexion: -16 }),
      j("leftLowerLeg", { flexion: 34 }),
      j("rightLowerLeg", { flexion: 40 }),
    ]),
    root: root(0, -0.1, 0, 0),
  });
  // duck: drop straight down, knees deep, spine folding forward
  const duck = (): IAutoFilmPose => ({
    ...merge([
      j("spine", { flexion: 24 }),
      j("chest", { flexion: 14 }),
      j("leftUpperLeg", { abduction: 9, flexion: -24 }),
      j("rightUpperLeg", { abduction: -9, flexion: -22 }),
      j("leftLowerLeg", { flexion: 48 }),
      j("rightLowerLeg", { flexion: 52 }),
    ]),
    root: root(0, -0.16, 0, 0),
  });

  // ── legs: chamber → strike pairs ─────────────────────────────────────────
  // rear (right) front push kick (teep)
  const chamberFront = merge([
    j("rightUpperLeg", { flexion: -42 }),
    j("rightLowerLeg", { flexion: 86 }),
    j("spine", { flexion: -4 }),
  ]);
  const teep = merge([
    j("rightUpperLeg", { flexion: -86 }),
    j("rightLowerLeg", { flexion: 10 }),
    j("leftLowerLeg", { flexion: 10 }),
    j("spine", { flexion: -16 }),
    j("leftUpperArm", { flexion: -28, abduction: 34 }),
  ]);
  // right knee strike (니킥): drive the knee up, crunch down, hands clinch
  const chamberKnee = merge([
    j("rightUpperLeg", { flexion: -64 }),
    j("rightLowerLeg", { flexion: 104 }),
    j("spine", { flexion: 6 }),
    j("leftUpperArm", { flexion: -28, abduction: -44 }),
    j("leftLowerArm", { flexion: -72 }),
    j("rightUpperArm", { flexion: 28, abduction: 44 }),
    j("rightLowerArm", { flexion: 72 }),
  ]);
  const kneeStrike = merge([
    j("rightUpperLeg", { flexion: -106 }),
    j("rightLowerLeg", { flexion: 128 }),
    j("spine", { flexion: 18 }),
    j("chest", { flexion: 12 }),
    j("leftUpperArm", { flexion: -26, abduction: -48 }),
    j("leftLowerArm", { flexion: -64 }),
    j("rightUpperArm", { flexion: 26, abduction: 48 }),
    j("rightLowerArm", { flexion: 64 }),
  ]);
  // right roundhouse high kick: chamber across, swing high to the side
  const chamberRound = merge([
    j("rightUpperLeg", { flexion: -36, abduction: -34 }),
    j("rightLowerLeg", { flexion: 78 }),
    j("spine", { twist: 14, flexion: 4 }),
  ]);
  const roundhouse = merge([
    j("rightUpperLeg", { flexion: -58, abduction: -46, twist: -34 }),
    j("rightLowerLeg", { flexion: 16 }),
    j("spine", { twist: 34, abduction: -12, flexion: 8 }),
    j("chest", { twist: 20 }),
    j("leftUpperArm", { flexion: -18, abduction: 44 }),
  ]);
  // lead (left) high axe/front kick — straight up high
  const chamberHigh = merge([
    j("leftUpperLeg", { flexion: -64 }),
    j("leftLowerLeg", { flexion: 70 }),
    j("spine", { flexion: -4 }),
  ]);
  const highKick = merge([
    j("leftUpperLeg", { flexion: -120 }),
    j("leftLowerLeg", { flexion: 8 }),
    j("rightLowerLeg", { flexion: 18 }),
    j("spine", { flexion: -8 }),
    j("rightUpperArm", { flexion: 22, abduction: -40 }),
  ]);

  // ── beat builders ────────────────────────────────────────────────────────
  const punch = (
    dur: number,
    p: IAutoFilmPose,
    hit = dur * 0.42,
  ): IAutoFilmMotion =>
    beat(dur, [
      [0, guard],
      [hit, p],
      [dur, guard],
    ]);
  const combo2 = (
    dur: number,
    a: IAutoFilmPose,
    b: IAutoFilmPose,
  ): IAutoFilmMotion =>
    beat(dur, [
      [0, guard],
      [dur * 0.3, a],
      [dur * 0.6, b],
      [dur, guard],
    ]);
  const defend = (dur: number, p: IAutoFilmPose): IAutoFilmMotion =>
    beat(dur, [
      [0, guard],
      [dur * 0.5, p],
      [dur, guard],
    ]);
  const kick = (
    dur: number,
    chamber: IAutoFilmPose,
    strike: IAutoFilmPose,
  ): IAutoFilmMotion =>
    beat(dur, [
      [0, guard],
      [dur * 0.28, chamber],
      [dur * 0.52, strike],
      [dur * 0.76, chamber],
      [dur, guard],
    ]);
  // a strike thrown while stepping in, then footing back to centre
  const stepStrike = (
    dur: number,
    p: IAutoFilmPose,
    x: number,
    z: number,
  ): IAutoFilmMotion =>
    beat(dur, [
      [0, guard],
      [dur * 0.45, at(p, x, z)],
      [dur, guard],
    ]);
  // light footwork: shift the stance out and back
  const stepStep = (dur: number, x: number, z: number): IAutoFilmMotion =>
    beat(dur, [
      [0, guard],
      [dur * 0.5, at(guard, x, z)],
      [dur, guard],
    ]);

  return sequenceMotion(
    "shadowbox",
    [
      beat(0.6, [
        [0, guard],
        [0.6, guard],
      ]), // settle
      // round 1 — find the range behind the jab + footwork
      punch(0.34, jab),
      punch(0.34, jab),
      combo2(0.62, jab, cross),
      defend(0.44, slip(-1)),
      defend(0.44, slip(1)),
      stepStrike(0.42, jab, 0, 0.16),
      stepStep(0.34, 0, -0.16),
      punch(0.42, cross),
      // round 2 — hooks, uppercuts, weaving
      punch(0.3, jab),
      punch(0.42, leadHook),
      punch(0.42, rearHook),
      defend(0.5, weave(-1)),
      defend(0.5, weave(1)),
      punch(0.42, leadUpper),
      punch(0.42, rearUpper),
      defend(0.5, duck()),
      combo2(0.62, cross, leadHook),
      // round 3 — fast footwork flurry
      stepStep(0.3, 0.16, 0),
      punch(0.28, jab),
      punch(0.28, jab),
      combo2(0.66, cross, leadHook),
      punch(0.42, rearUpper),
      stepStep(0.34, -0.16, 0),
      defend(0.42, slip(-1)),
      defend(0.5, weave(1)),
      // round 4 — kicks
      kick(1.0, chamberFront, teep),
      kick(1.2, chamberFront, teep),
      kick(0.85, chamberKnee, kneeStrike),
      kick(0.85, chamberKnee, kneeStrike),
      kick(1.4, chamberRound, roundhouse),
      // round 5 — boxing combination + defence
      punch(0.3, jab),
      combo2(0.7, cross, leadHook),
      punch(0.42, rearHook),
      defend(0.5, weave(-1)),
      punch(0.42, leadUpper),
      punch(0.42, cross),
      defend(0.5, duck()),
      stepStrike(0.42, jab, 0, 0.16),
      stepStep(0.34, 0, -0.16),
      // round 6 — knees + high kicks
      kick(0.8, chamberKnee, kneeStrike),
      kick(0.95, chamberFront, teep),
      kick(1.4, chamberRound, roundhouse),
      kick(1.3, chamberHigh, highKick),
      kick(1.2, chamberFront, teep),
      // round 7 — finishing flurry
      punch(0.28, jab),
      punch(0.28, jab),
      punch(0.4, cross),
      punch(0.42, leadHook),
      punch(0.42, rearHook),
      kick(1.4, chamberRound, roundhouse), // finish
      beat(0.8, [
        [0, guard],
        [0.8, guard],
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
  stroll: stroll(sk),
  sprint: sprint(sk),
});
