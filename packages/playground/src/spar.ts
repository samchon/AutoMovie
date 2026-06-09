import { Quaternion } from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmJointPose,
  IAutoFilmKeyframe,
  IAutoFilmModel,
  IAutoFilmMotion,
  IAutoFilmPose,
  IAutoFilmSkeleton,
  IAutoFilmTransform,
} from "@autofilm/interface";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";

/**
 * Two-boxer **sparring** — two stick figures squaring off and trading crisp,
 * professional combinations (jab, one-two, hook, uppercut) with real defence
 * (slip, weave, duck, block, lean-back), ending when one boxer eats a one-two
 * and is knocked out: head snapping back, legs buckling, toppling to the
 * canvas.
 *
 * Both boxers ride the same stick rig (recoloured red / blue); the two clips
 * share one timeline so an attack and its counter line up frame-for-frame — the
 * "give and take" is authored as a single choreography, not physics. The KO is
 * a root-driven fall (the engine just plays the keyframes).
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

/** Tint a fresh stick figure (recolour the "ink" body), keeping eyes/pupils. */
const tint = (
  id: string,
  rgb: [number, number, number],
): { skeleton: IAutoFilmSkeleton; model: IAutoFilmModel } => {
  const { skeleton, model } = buildStickman(DEFAULT_STICKMAN);
  return {
    skeleton: { ...skeleton, id },
    model: {
      ...model,
      id,
      materials: model.materials.map((m) =>
        m.id === "ink"
          ? {
              ...m,
              baseColor: { r: rgb[0], g: rgb[1], b: rgb[2], a: 1, hex: null },
            }
          : m,
      ),
    },
  };
};

export const buildRedBoxer = () => tint("boxerRed", [0.66, 0.18, 0.18]);
export const buildBlueBoxer = () => tint("boxerBlue", [0.2, 0.34, 0.62]);

// ── shared boxing vocabulary (mirrors the shadowbox guard/strike scheme) ─────
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

const merge = (over: IAutoFilmJointPose[]): IAutoFilmJointPose[] => {
  const m = new Map(GUARD.map((x) => [x.bone, x] as const));
  for (const o of over) m.set(o.bone, o);
  return [...m.values()];
};

// root transforms: a clean fall pitches backward about +X (negative tips the
// crown toward −Z, the way a boxer drops onto his back away from the opponent)
const upright: IAutoFilmTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const fall = (y: number, z: number, pitchDeg: number): IAutoFilmTransform => ({
  translation: { x: 0, y, z },
  rotation: Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, pitchDeg),
  scale: { x: 1, y: 1, z: 1 },
});

// ── pose vocabulary (each returns the full joint set) ────────────────────────
const P = {
  guard: (): IAutoFilmJointPose[] => merge([]),
  jab: (): IAutoFilmJointPose[] =>
    merge([
      j("leftUpperArm", { flexion: -94, abduction: 6 }),
      j("leftLowerArm", { flexion: -8 }),
      j("spine", { flexion: 9, twist: -12 }),
      j("chest", { flexion: 6, twist: -8 }),
    ]),
  cross: (): IAutoFilmJointPose[] =>
    merge([
      j("rightUpperArm", { flexion: 94, abduction: -6 }),
      j("rightLowerArm", { flexion: 10 }),
      j("spine", { flexion: 9, twist: 26 }),
      j("chest", { flexion: 6, twist: 18 }),
    ]),
  leadHook: (): IAutoFilmJointPose[] =>
    merge([
      j("leftUpperArm", { flexion: -54, abduction: 8 }),
      j("leftLowerArm", { flexion: -94 }),
      j("spine", { flexion: 9, twist: 22 }),
      j("chest", { flexion: 6, twist: 16 }),
    ]),
  rearUpper: (): IAutoFilmJointPose[] =>
    merge([
      j("rightUpperArm", { flexion: 56, abduction: -48 }),
      j("rightLowerArm", { flexion: 126 }),
      j("spine", { flexion: 2, twist: 16 }),
      j("chest", { flexion: 0, twist: 12 }),
    ]),
  slip: (d: number): IAutoFilmJointPose[] =>
    merge([
      j("spine", { flexion: 12, abduction: 16 * d, twist: 6 * d }),
      j("chest", { flexion: 8, abduction: 12 * d }),
    ]),
  weave: (d: number): IAutoFilmJointPose[] =>
    merge([
      j("spine", { flexion: 16, abduction: 22 * d, twist: 10 * d }),
      j("chest", { flexion: 10, abduction: 16 * d }),
      j("leftUpperLeg", { abduction: 9, flexion: -18 }),
      j("rightUpperLeg", { abduction: -9, flexion: -16 }),
      j("leftLowerLeg", { flexion: 34 }),
      j("rightLowerLeg", { flexion: 40 }),
    ]),
  duck: (): IAutoFilmJointPose[] =>
    merge([
      j("spine", { flexion: 24 }),
      j("chest", { flexion: 14 }),
      j("leftUpperLeg", { abduction: 9, flexion: -24 }),
      j("rightUpperLeg", { abduction: -9, flexion: -22 }),
      j("leftLowerLeg", { flexion: 48 }),
      j("rightLowerLeg", { flexion: 52 }),
    ]),
  block: (): IAutoFilmJointPose[] =>
    merge([
      // high tight guard, both gloves up at the temples
      j("leftUpperArm", { flexion: -30, abduction: -40 }),
      j("leftLowerArm", { flexion: -132 }),
      j("rightUpperArm", { flexion: 30, abduction: 40 }),
      j("rightLowerArm", { flexion: 132 }),
      j("spine", { flexion: 12 }),
    ]),
  leanBack: (): IAutoFilmJointPose[] =>
    merge([
      j("spine", { flexion: -16 }),
      j("chest", { flexion: -10 }),
      j("leftUpperLeg", { abduction: 9, flexion: 6 }),
      j("rightUpperLeg", { abduction: -9, flexion: 8 }),
    ]),
  // KO progression for the loser (root carries the fall)
  recoil: (): IAutoFilmJointPose[] =>
    merge([
      j("spine", { flexion: -14, twist: 6 }),
      j("chest", { flexion: -10 }),
      j("head", { flexion: -16 }),
      j("leftLowerArm", { flexion: -96 }),
      j("rightLowerArm", { flexion: 96 }),
    ]),
};

const koStart: IAutoFilmJointPose[] = merge([
  j("spine", { flexion: -24 }),
  j("chest", { flexion: -14 }),
  j("head", { flexion: -26 }),
  j("leftUpperArm", { flexion: -10, abduction: -84 }),
  j("rightUpperArm", { flexion: 10, abduction: 84 }),
  j("leftLowerArm", { flexion: -40 }),
  j("rightLowerArm", { flexion: 40 }),
  j("leftUpperLeg", { abduction: 12, flexion: -8 }),
  j("rightUpperLeg", { abduction: -12, flexion: -6 }),
  j("leftLowerLeg", { flexion: 30 }),
  j("rightLowerLeg", { flexion: 34 }),
]);
const koMid: IAutoFilmJointPose[] = merge([
  j("spine", { flexion: -30 }),
  j("chest", { flexion: -16 }),
  j("head", { flexion: -30 }),
  j("leftUpperArm", { flexion: -6, abduction: -100 }),
  j("rightUpperArm", { flexion: 6, abduction: 100 }),
  j("leftUpperLeg", { abduction: 14, flexion: 24 }),
  j("rightUpperLeg", { abduction: -14, flexion: 26 }),
  j("leftLowerLeg", { flexion: 76 }),
  j("rightLowerLeg", { flexion: 80 }),
]);
const koDown: IAutoFilmJointPose[] = merge([
  j("spine", { flexion: -18 }),
  j("chest", { flexion: -8 }),
  j("head", { flexion: -20 }),
  j("leftUpperArm", { flexion: -4, abduction: -120 }),
  j("rightUpperArm", { flexion: 4, abduction: 120 }),
  j("leftUpperLeg", { abduction: 18, flexion: 40 }),
  j("rightUpperLeg", { abduction: -18, flexion: 44 }),
  j("leftLowerLeg", { flexion: 60 }),
  j("rightLowerLeg", { flexion: 64 }),
]);

// ── the shared choreography ───────────────────────────────────────────────
// Each moment names both boxers' poses at one instant; the clips are built by
// projecting the moment list onto red / blue. `r`/`b` optionally carry a root
// (the KO fall). Red is the aggressor who lands the finishing one-two.
interface Moment {
  t: number;
  red: IAutoFilmJointPose[];
  blue: IAutoFilmJointPose[];
  redRoot?: IAutoFilmTransform;
  blueRoot?: IAutoFilmTransform;
}

const MOMENTS: Moment[] = [
  { t: 0.0, red: P.guard(), blue: P.guard() },
  { t: 0.5, red: P.jab(), blue: P.slip(-1) }, // red jab, blue slips out
  { t: 1.0, red: P.guard(), blue: P.guard() },
  { t: 1.45, red: P.slip(1), blue: P.jab() }, // blue jab, red slips
  { t: 1.95, red: P.guard(), blue: P.guard() },
  { t: 2.4, red: P.jab(), blue: P.weave(-1) }, // red jab, blue weaves under
  { t: 2.9, red: P.cross(), blue: P.duck() }, // red cross, blue ducks
  { t: 3.45, red: P.leanBack(), blue: P.leadHook() }, // blue hooks, red leans back
  { t: 3.95, red: P.guard(), blue: P.guard() },
  { t: 4.4, red: P.leadHook(), blue: P.block() }, // red hook, blue blocks
  { t: 4.95, red: P.guard(), blue: P.guard() },
  { t: 5.4, red: P.weave(1), blue: P.jab() }, // blue jab, red weaves
  { t: 5.9, red: P.jab(), blue: P.guard() }, // red jab
  { t: 6.35, red: P.cross(), blue: P.slip(-1) }, // red cross, blue slips
  { t: 6.85, red: P.leanBack(), blue: P.rearUpper() }, // blue uppercut, red leans
  { t: 7.4, red: P.guard(), blue: P.guard() },
  { t: 7.85, red: P.jab(), blue: P.guard() },
  { t: 8.3, red: P.leadHook(), blue: P.duck() }, // red hook, blue ducks
  { t: 8.8, red: P.guard(), blue: P.guard() }, // reset, both breathe
  { t: 9.4, red: P.guard(), blue: P.guard() },
  // the finish — red's one-two lands clean
  { t: 9.75, red: P.jab(), blue: P.recoil() }, // 1) jab snaps blue's head
  { t: 10.1, red: P.cross(), blue: koStart, blueRoot: fall(-0.04, -0.02, -12) }, // 2) the KO cross
  { t: 10.5, red: P.cross(), blue: koStart, blueRoot: fall(-0.12, -0.04, -28) },
  { t: 11.1, red: P.guard(), blue: koMid, blueRoot: fall(-0.4, -0.09, -62) }, // toppling
  { t: 11.9, red: P.guard(), blue: koDown, blueRoot: fall(-0.62, -0.14, -86) }, // canvas
  { t: 13.2, red: P.guard(), blue: koDown, blueRoot: fall(-0.62, -0.14, -86) }, // held
];

const key = (
  time: number,
  joints: IAutoFilmJointPose[],
  skeleton: string,
  rootT: IAutoFilmTransform | null,
): IAutoFilmKeyframe => ({
  time,
  pose: { skeleton, root: rootT, joints } satisfies IAutoFilmPose,
  expression: null,
  easing: "easeInOut",
  bezier: null,
});

const DURATION = 13.2;

export const redClip = (sk: string): IAutoFilmMotion => ({
  id: "spar-red",
  skeleton: sk,
  duration: DURATION,
  loop: false,
  keyframes: MOMENTS.map((m) => key(m.t, m.red, sk, m.redRoot ?? upright)),
});
export const blueClip = (sk: string): IAutoFilmMotion => ({
  id: "spar-blue",
  skeleton: sk,
  duration: DURATION,
  loop: false,
  keyframes: MOMENTS.map((m) => key(m.t, m.blue, sk, m.blueRoot ?? upright)),
});

export const SPAR_DURATION = DURATION;
