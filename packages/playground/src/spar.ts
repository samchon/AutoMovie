import { Quaternion } from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";

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
  bone: AutoMovieHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoMovieJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});

/** Tint a fresh stick figure (recolour the "ink" body), keeping eyes/pupils. */
const tint = (
  id: string,
  rgb: [number, number, number],
): { skeleton: IAutoMovieSkeleton; model: IAutoMovieModel } => {
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
// Boxer arm abduction is authored in clinical space; HUMANOID_REST_FRAME in the
// view recovers the mirrored rig signs for each shoulder.
const GUARD: IAutoMovieJointPose[] = [
  j("spine", { flexion: 9 }),
  j("chest", { flexion: 6 }),
  j("leftUpperArm", { flexion: -38, abduction: 32 }),
  j("leftLowerArm", { flexion: -122 }),
  j("rightUpperArm", { flexion: 38, abduction: 32 }),
  j("rightLowerArm", { flexion: 122 }),
  j("leftUpperLeg", { abduction: 9, flexion: -12 }),
  j("rightUpperLeg", { abduction: -9, flexion: 14 }),
  j("leftLowerLeg", { flexion: 14 }),
  j("rightLowerLeg", { flexion: 22 }),
];

const merge = (over: IAutoMovieJointPose[]): IAutoMovieJointPose[] => {
  const m = new Map(GUARD.map((x) => [x.bone, x] as const));
  for (const o of over) m.set(o.bone, o);
  return [...m.values()];
};

// root transforms: a clean fall pitches backward about +X (negative tips the
// crown toward −Z, the way a boxer drops onto his back away from the opponent)
const upright: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const fall = (y: number, z: number, pitchDeg: number): IAutoMovieTransform => ({
  translation: { x: 0, y, z },
  rotation: Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, pitchDeg),
  scale: { x: 1, y: 1, z: 1 },
});

// ── pose vocabulary (each returns the full joint set) ────────────────────────
const P = {
  guard: (): IAutoMovieJointPose[] => merge([]),
  jab: (): IAutoMovieJointPose[] =>
    merge([
      j("leftUpperArm", { flexion: -94, abduction: 96 }),
      j("leftLowerArm", { flexion: -8 }),
      j("spine", { flexion: 9, twist: -12 }),
      j("chest", { flexion: 6, twist: -8 }),
    ]),
  cross: (): IAutoMovieJointPose[] =>
    merge([
      j("rightUpperArm", { flexion: 94, abduction: 96 }),
      j("rightLowerArm", { flexion: 10 }),
      j("spine", { flexion: 9, twist: 26 }),
      j("chest", { flexion: 6, twist: 18 }),
    ]),
  leadHook: (): IAutoMovieJointPose[] =>
    merge([
      j("leftUpperArm", { flexion: -54, abduction: 98 }),
      j("leftLowerArm", { flexion: -94 }),
      j("spine", { flexion: 9, twist: 22 }),
      j("chest", { flexion: 6, twist: 16 }),
    ]),
  rearUpper: (): IAutoMovieJointPose[] =>
    merge([
      j("rightUpperArm", { flexion: 56, abduction: 138 }),
      j("rightLowerArm", { flexion: 126 }),
      j("spine", { flexion: 2, twist: 16 }),
      j("chest", { flexion: 0, twist: 12 }),
    ]),
  slip: (d: number): IAutoMovieJointPose[] =>
    merge([
      j("spine", { flexion: 14, abduction: 18 * d, twist: 8 * d }),
      j("chest", { flexion: 9, abduction: 14 * d }),
      j("leftUpperLeg", { abduction: 9, flexion: -12 }),
      j("rightUpperLeg", { abduction: -9, flexion: -10 }),
      j("leftLowerLeg", { flexion: 26 }),
      j("rightLowerLeg", { flexion: 32 }),
    ]),
  // waist AND knees fold together, the body sinking low under the punch
  weave: (d: number): IAutoMovieJointPose[] =>
    merge([
      j("spine", { flexion: 20, abduction: 26 * d, twist: 12 * d }),
      j("chest", { flexion: 12, abduction: 18 * d }),
      j("leftUpperLeg", { abduction: 11, flexion: -32 }),
      j("rightUpperLeg", { abduction: -11, flexion: -30 }),
      j("leftLowerLeg", { flexion: 60 }),
      j("rightLowerLeg", { flexion: 64 }),
    ]),
  duck: (): IAutoMovieJointPose[] =>
    merge([
      j("spine", { flexion: 28 }),
      j("chest", { flexion: 16 }),
      j("leftUpperLeg", { abduction: 11, flexion: -40 }),
      j("rightUpperLeg", { abduction: -11, flexion: -38 }),
      j("leftLowerLeg", { flexion: 78 }),
      j("rightLowerLeg", { flexion: 82 }),
    ]),
  block: (): IAutoMovieJointPose[] =>
    merge([
      // high tight guard, both gloves up at the temples
      j("leftUpperArm", { flexion: -30, abduction: 50 }),
      j("leftLowerArm", { flexion: -132 }),
      j("rightUpperArm", { flexion: 30, abduction: 50 }),
      j("rightLowerArm", { flexion: 132 }),
      j("spine", { flexion: 12 }),
    ]),
  leanBack: (): IAutoMovieJointPose[] =>
    merge([
      j("spine", { flexion: -16 }),
      j("chest", { flexion: -10 }),
      j("leftUpperLeg", { abduction: 9, flexion: 6 }),
      j("rightUpperLeg", { abduction: -9, flexion: 8 }),
    ]),
  // KO progression for the loser (root carries the fall)
  recoil: (): IAutoMovieJointPose[] =>
    merge([
      j("spine", { flexion: -14, twist: 6 }),
      j("chest", { flexion: -10 }),
      j("head", { flexion: -16 }),
      j("leftLowerArm", { flexion: -96 }),
      j("rightLowerArm", { flexion: 96 }),
    ]),
};

const koStart: IAutoMovieJointPose[] = merge([
  j("spine", { flexion: -24 }),
  j("chest", { flexion: -14 }),
  j("head", { flexion: -26 }),
  j("leftUpperArm", { flexion: -10, abduction: 6 }),
  j("rightUpperArm", { flexion: 10, abduction: 6 }),
  j("leftLowerArm", { flexion: -40 }),
  j("rightLowerArm", { flexion: 40 }),
  j("leftUpperLeg", { abduction: 12, flexion: -8 }),
  j("rightUpperLeg", { abduction: -12, flexion: -6 }),
  j("leftLowerLeg", { flexion: 30 }),
  j("rightLowerLeg", { flexion: 34 }),
]);
const koMid: IAutoMovieJointPose[] = merge([
  j("spine", { flexion: -30 }),
  j("chest", { flexion: -16 }),
  j("head", { flexion: -30 }),
  j("leftUpperArm", { flexion: -6, abduction: -10 }),
  j("rightUpperArm", { flexion: 6, abduction: -10 }),
  j("leftUpperLeg", { abduction: 14, flexion: 24 }),
  j("rightUpperLeg", { abduction: -14, flexion: 26 }),
  j("leftLowerLeg", { flexion: 76 }),
  j("rightLowerLeg", { flexion: 80 }),
]);
const koDown: IAutoMovieJointPose[] = merge([
  j("spine", { flexion: -18 }),
  j("chest", { flexion: -8 }),
  j("head", { flexion: -20 }),
  j("leftUpperArm", { flexion: -4, abduction: -30 }),
  j("rightUpperArm", { flexion: 4, abduction: -30 }),
  j("leftUpperLeg", { abduction: 18, flexion: 40 }),
  j("rightUpperLeg", { abduction: -18, flexion: 44 }),
  j("leftLowerLeg", { flexion: 60 }),
  j("rightLowerLeg", { flexion: 64 }),
]);

// ── the shared choreography ───────────────────────────────────────────────
// Each moment names both boxers' poses at one instant; the clips are built by
// projecting the moment list onto red / blue, each with an optional root (a
// weave/duck sinks the body, a punch can step in, the KO falls).
interface Moment {
  t: number;
  red: IAutoMovieJointPose[];
  blue: IAutoMovieJointPose[];
  redRoot?: IAutoMovieTransform;
  blueRoot?: IAutoMovieTransform;
}

// a pure vertical sink (weave/duck drop) and a step toward the opponent (+Z
// local, which for either boxer points at the other once placed)
const sink = (y: number): IAutoMovieTransform => ({
  translation: { x: 0, y, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});
const stepIn = (z: number): IAutoMovieTransform => ({
  translation: { x: 0, y: 0, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

// one exchange: the attacker (`who`) throws `atk`, the defender answers with
// `def`; roots optionally step the attacker in or sink the defender.
interface Ex {
  dur: number;
  who: "R" | "B";
  atk: IAutoMovieJointPose[];
  def: IAutoMovieJointPose[];
  atkRoot?: IAutoMovieTransform;
  defRoot?: IAutoMovieTransform;
}

// a round of crisp give-and-take; repeated (with the lead alternating) to fill
// the bout. Defences that drop (weave/duck/slip) carry a sink so the body
// folds at the knees and waist, not a stiff lean.
const ROUND: Ex[] = [
  {
    dur: 0.55,
    who: "R",
    atk: P.jab(),
    def: P.slip(-1),
    atkRoot: stepIn(0.1),
    defRoot: sink(-0.07),
  },
  { dur: 0.5, who: "R", atk: P.jab(), def: P.slip(1), defRoot: sink(-0.07) },
  {
    dur: 0.64,
    who: "R",
    atk: P.cross(),
    def: P.leanBack(),
    atkRoot: stepIn(0.12),
  },
  { dur: 0.56, who: "B", atk: P.jab(), def: P.slip(-1), defRoot: sink(-0.07) },
  {
    dur: 0.66,
    who: "B",
    atk: P.cross(),
    def: P.weave(-1),
    defRoot: sink(-0.22),
  },
  { dur: 0.6, who: "R", atk: P.leadHook(), def: P.block() },
  {
    dur: 0.64,
    who: "R",
    atk: P.cross(),
    def: P.duck(),
    atkRoot: stepIn(0.12),
    defRoot: sink(-0.3),
  },
  { dur: 0.66, who: "B", atk: P.rearUpper(), def: P.leanBack() },
  { dur: 0.5, who: "R", atk: P.jab(), def: P.slip(1), defRoot: sink(-0.07) },
  { dur: 0.66, who: "R", atk: P.jab(), def: P.weave(1), defRoot: sink(-0.22) },
  { dur: 0.6, who: "B", atk: P.leadHook(), def: P.block() },
  {
    dur: 0.66,
    who: "B",
    atk: P.cross(),
    def: P.duck(),
    atkRoot: stepIn(0.12),
    defRoot: sink(-0.3),
  },
  {
    dur: 0.6,
    who: "R",
    atk: P.leadHook(),
    def: P.weave(-1),
    defRoot: sink(-0.22),
  },
  {
    dur: 0.62,
    who: "R",
    atk: P.cross(),
    def: P.leanBack(),
    atkRoot: stepIn(0.12),
  },
];

const flip = (e: Ex): Ex => ({ ...e, who: e.who === "R" ? "B" : "R" });

const MOMENTS: Moment[] = (() => {
  const out: Moment[] = [{ t: 0, red: P.guard(), blue: P.guard() }];
  // three rounds; the lead alternates each round for variety
  const bout: Ex[] = [...ROUND, ...ROUND.map(flip), ...ROUND];
  let t = 0;
  for (const e of bout) {
    const hit = Math.round((t + e.dur * 0.42) * 1000) / 1000;
    const end = Math.round((t + e.dur) * 1000) / 1000;
    const atkRed = e.who === "R";
    out.push({
      t: hit,
      red: atkRed ? e.atk : e.def,
      blue: atkRed ? e.def : e.atk,
      redRoot: atkRed ? e.atkRoot : e.defRoot,
      blueRoot: atkRed ? e.defRoot : e.atkRoot,
    });
    out.push({ t: end, red: P.guard(), blue: P.guard() });
    t = end;
  }
  // the finish — red steps in behind a one-two and blue is knocked out
  const z = t;
  const at = (dt: number): number => Math.round((z + dt) * 1000) / 1000;
  out.push({
    t: at(0.35),
    red: P.jab(),
    blue: P.recoil(),
    redRoot: stepIn(0.12),
  });
  out.push({
    t: at(0.72),
    red: P.cross(),
    blue: koStart,
    redRoot: stepIn(0.15),
    blueRoot: fall(-0.04, -0.02, -12),
  });
  out.push({
    t: at(1.15),
    red: P.cross(),
    blue: koStart,
    redRoot: stepIn(0.12),
    blueRoot: fall(-0.12, -0.04, -28),
  });
  out.push({
    t: at(1.9),
    red: P.guard(),
    blue: koMid,
    blueRoot: fall(-0.4, -0.09, -62),
  });
  out.push({
    t: at(2.9),
    red: P.guard(),
    blue: koDown,
    blueRoot: fall(-0.62, -0.14, -86),
  });
  out.push({
    t: at(4.2),
    red: P.guard(),
    blue: koDown,
    blueRoot: fall(-0.62, -0.14, -86),
  });
  return out;
})();

const DURATION = MOMENTS[MOMENTS.length - 1]!.t;

const key = (
  time: number,
  joints: IAutoMovieJointPose[],
  skeleton: string,
  rootT: IAutoMovieTransform | null,
): IAutoMovieKeyframe => ({
  time,
  pose: { skeleton, root: rootT, joints } satisfies IAutoMoviePose,
  expression: null,
  easing: "easeInOut",
  bezier: null,
});

export const redClip = (sk: string): IAutoMovieMotion => ({
  id: "spar-red",
  skeleton: sk,
  duration: DURATION,
  loop: false,
  keyframes: MOMENTS.map((m) => key(m.t, m.red, sk, m.redRoot ?? upright)),
});
export const blueClip = (sk: string): IAutoMovieMotion => ({
  id: "spar-blue",
  skeleton: sk,
  duration: DURATION,
  loop: false,
  keyframes: MOMENTS.map((m) => key(m.t, m.blue, sk, m.blueRoot ?? upright)),
});

export const SPAR_DURATION = DURATION;
