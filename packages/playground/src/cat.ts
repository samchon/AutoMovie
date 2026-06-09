import { Quaternion } from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  AutoFilmPrimitiveShape,
  IAutoFilmBone,
  IAutoFilmJointConstraint,
  IAutoFilmModel,
  IAutoFilmModelPart,
  IAutoFilmQuaternion,
  IAutoFilmSkeleton,
  IAutoFilmTransform,
  IAutoFilmVector3,
} from "@autofilm/interface";

/**
 * A stick-figure **cat** — a quadruped mapped onto the normalized humanoid
 * skeleton, the counterpart to the human {@link buildStickman}.
 *
 * The rig is reinterpreted, not extended: the spine runs horizontal (hips at
 * the rear, chest at the front), the **arm** slots become the front legs and
 * the **leg** slots the hind legs (all four pointing straight down, so the
 * engine's default clinical axes already swing them sagittally — no axis remap
 * needed), and one finger chain is repurposed as a three-segment articulable
 * **tail**. Cones make the ears; a sphere the head. Each joint carries a
 * cat-tuned ROM ({@link CAT_ROM}) so the rig self-describes its gamut.
 *
 * Everything stays a valid `IAutoFilmModel` on the closed bone enum, so a cat
 * clip is just another motion AST. All lengths are in meters.
 *
 * @author Samchon
 */
export interface ICatParams {
  /** Height of the back (hip/shoulder line) off the floor. */
  backHeight: number;
  /** Hips → chest body length (the horizontal trunk). */
  trunkLength: number;
  /** Half the track width between the left/right legs. */
  legHalf: number;
  /** Upper-leg (shoulder/hip → knee) length, both ends. */
  upperLeg: number;
  /** Lower-leg (knee → paw) length. */
  lowerLeg: number;
  /** Neck length (chest → head), angled up-forward. */
  neckLength: number;
  /** Head sphere radius. */
  headRadius: number;
  /** Radius of every limb / spine rod. */
  rodRadius: number;
}

/** A lithe house-cat ≈ 0.35 m at the shoulder. */
export const DEFAULT_CAT: ICatParams = {
  backHeight: 0.34,
  trunkLength: 0.28,
  legHalf: 0.055,
  upperLeg: 0.16,
  lowerLeg: 0.16,
  neckLength: 0.1,
  headRadius: 0.075,
  rodRadius: 0.017,
};

const range = (min: number, max: number) => ({ min, max });
const con = (
  flexion: { min: number; max: number } | null,
  abduction: { min: number; max: number } | null,
  twist: { min: number; max: number } | null,
): IAutoFilmJointConstraint => ({ flexion, abduction, twist });

const legCon = con(range(-70, 80), range(-20, 35), range(-20, 20));
const kneeCon = con(range(0, 150), null, null);
const pawCon = con(range(-45, 45), null, null);

/** Cat-tuned per-joint ROM (quadruped). Bones omitted are left unconstrained. */
export const CAT_ROM: Partial<
  Record<AutoFilmHumanoidBone, IAutoFilmJointConstraint>
> = {
  spine: con(range(-40, 55), range(-25, 25), range(-30, 30)),
  chest: con(range(-30, 45), range(-20, 20), range(-25, 25)),
  neck: con(range(-60, 70), range(-45, 45), range(-60, 60)),
  head: con(range(-50, 60), range(-45, 45), range(-70, 70)),
  leftUpperArm: legCon,
  rightUpperArm: legCon,
  leftLowerArm: kneeCon,
  rightLowerArm: kneeCon,
  leftHand: pawCon,
  rightHand: pawCon,
  leftUpperLeg: legCon,
  rightUpperLeg: legCon,
  leftLowerLeg: kneeCon,
  rightLowerLeg: kneeCon,
  leftFoot: pawCon,
  rightFoot: pawCon,
  // tail (repurposed finger chain): supple, curls and sways
  leftLittleProximal: con(range(-80, 80), range(-50, 50), null),
  leftLittleIntermediate: con(range(-80, 80), range(-50, 50), null),
  leftLittleDistal: con(range(-80, 80), range(-50, 50), null),
};

const v = (x: number, y: number, z: number): IAutoFilmVector3 => ({ x, y, z });
const at = (
  t: IAutoFilmVector3,
  r?: IAutoFilmQuaternion,
): IAutoFilmTransform => ({
  translation: t,
  rotation: r ?? { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});
const bone = (
  name: AutoFilmHumanoidBone,
  parent: AutoFilmHumanoidBone | null,
  rest: IAutoFilmTransform,
): IAutoFilmBone => ({
  bone: name,
  parent,
  rest,
  constraint: CAT_ROM[name] ?? null,
});

/** Shortest-arc rotation taking the local +Y axis onto a target direction. */
const yToDir = (dir: IAutoFilmVector3): IAutoFilmQuaternion => {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len === 0) return { x: 0, y: 0, z: 0, w: 1 };
  const n = v(dir.x / len, dir.y / len, dir.z / len);
  const dot = n.y;
  if (dot > 0.999999) return { x: 0, y: 0, z: 0, w: 1 };
  if (dot < -0.999999) return { x: 0, y: 0, z: 1, w: 0 };
  const axis = v(n.z, 0, -n.x);
  return Quaternion.normalize(
    Quaternion.fromAxisAngle(axis, (Math.acos(dot) * 180) / Math.PI),
  );
};

const capsule = (radius: number, length: number): AutoFilmPrimitiveShape => ({
  type: "capsule",
  radius,
  height: Math.max(0.01, length - 2 * radius),
});

/** A rigid rod spanning `seg` (a bone-local offset) from `boneName`. */
const rod = (
  id: string,
  boneName: AutoFilmHumanoidBone,
  seg: IAutoFilmVector3,
  radius: number,
): IAutoFilmModelPart => ({
  id,
  name: id,
  geometry: {
    type: "primitive",
    shape: capsule(radius, Math.hypot(seg.x, seg.y, seg.z)),
  },
  material: "fur",
  attachedBone: boneName,
  transform: at(v(seg.x / 2, seg.y / 2, seg.z / 2), yToDir(seg)),
});

/**
 * Build the stick-figure cat — a quadruped skeleton, rods, ears, a tail, and a
 * cat-tuned ROM — from a set of proportions.
 *
 * @author Samchon
 */
export const buildCat = (
  p: ICatParams,
): { skeleton: IAutoFilmSkeleton; model: IAutoFilmModel } => {
  const H = p.backHeight;
  const t1 = p.trunkLength * 0.5; // hips→spine and spine→chest
  const lh = p.legHalf;
  const down = (len: number): IAutoFilmVector3 => v(0, -len, 0);

  const bones: IAutoFilmBone[] = [
    bone("hips", null, at(v(0, H, 0))),
    bone("spine", "hips", at(v(0, 0, t1))),
    bone("chest", "spine", at(v(0, 0, t1))),
    bone("neck", "chest", at(v(0, 0.05, 0.09))),
    bone("head", "neck", at(v(0, 0.03, 0.08))),
    // front legs (from chest), pointing down
    bone("leftUpperArm", "chest", at(v(lh, 0, 0))),
    bone("leftLowerArm", "leftUpperArm", at(down(p.upperLeg))),
    bone("leftHand", "leftLowerArm", at(down(p.lowerLeg))),
    bone("rightUpperArm", "chest", at(v(-lh, 0, 0))),
    bone("rightLowerArm", "rightUpperArm", at(down(p.upperLeg))),
    bone("rightHand", "rightLowerArm", at(down(p.lowerLeg))),
    // hind legs (from hips), pointing down
    bone("leftUpperLeg", "hips", at(v(lh, 0, 0))),
    bone("leftLowerLeg", "leftUpperLeg", at(down(p.upperLeg))),
    bone("leftFoot", "leftLowerLeg", at(down(p.lowerLeg))),
    bone("rightUpperLeg", "hips", at(v(-lh, 0, 0))),
    bone("rightLowerLeg", "rightUpperLeg", at(down(p.upperLeg))),
    bone("rightFoot", "rightLowerLeg", at(down(p.lowerLeg))),
    // tail (repurposed finger chain), curving up and back from the hips
    bone("leftLittleProximal", "hips", at(v(0, 0.05, -0.1))),
    bone("leftLittleIntermediate", "leftLittleProximal", at(v(0, 0.03, -0.09))),
    bone("leftLittleDistal", "leftLittleIntermediate", at(v(0, 0.015, -0.08))),
  ];

  const r = p.rodRadius;
  const ball = (
    id: string,
    boneName: AutoFilmHumanoidBone,
  ): IAutoFilmModelPart => ({
    id,
    name: id,
    geometry: { type: "primitive", shape: { type: "sphere", radius: r * 1.3 } },
    material: "fur",
    attachedBone: boneName,
    transform: at(v(0, 0, 0)),
  });
  const cone = (
    id: string,
    boneName: AutoFilmHumanoidBone,
    offset: IAutoFilmVector3,
    height: number,
  ): IAutoFilmModelPart => ({
    id,
    name: id,
    geometry: {
      type: "primitive",
      shape: { type: "cone", radius: height * 0.6, height },
    },
    material: "fur",
    attachedBone: boneName,
    transform: at(offset),
  });

  const parts: IAutoFilmModelPart[] = [
    // horizontal spine
    rod("trunkRear", "hips", v(0, 0, t1), r),
    rod("trunkFront", "spine", v(0, 0, t1), r),
    rod("neckRod", "chest", v(0, 0.05, 0.09), r),
    rod("headStalk", "neck", v(0, 0.03, 0.08), r),
    {
      id: "head",
      name: "head",
      geometry: {
        type: "primitive",
        shape: { type: "sphere", radius: p.headRadius },
      },
      material: "fur",
      attachedBone: "head",
      transform: at(v(0, 0.01, 0.03)),
    },
    // ears
    cone("earL", "head", v(0.04, p.headRadius * 0.9, 0.0), 0.05),
    cone("earR", "head", v(-0.04, p.headRadius * 0.9, 0.0), 0.05),
    // front legs
    rod("flUpperL", "leftUpperArm", down(p.upperLeg), r),
    rod("flLowerL", "leftLowerArm", down(p.lowerLeg), r),
    rod("flUpperR", "rightUpperArm", down(p.upperLeg), r),
    rod("flLowerR", "rightLowerArm", down(p.lowerLeg), r),
    // hind legs
    rod("hlUpperL", "leftUpperLeg", down(p.upperLeg), r),
    rod("hlLowerL", "leftLowerLeg", down(p.lowerLeg), r),
    rod("hlUpperR", "rightUpperLeg", down(p.upperLeg), r),
    rod("hlLowerR", "rightLowerLeg", down(p.lowerLeg), r),
    // tail — base rod joins the hips to the first tail segment (no gap)
    rod("tailBase", "hips", v(0, 0.05, -0.1), r * 0.9),
    rod("tail1", "leftLittleProximal", v(0, 0.03, -0.09), r * 0.85),
    rod("tail2", "leftLittleIntermediate", v(0, 0.015, -0.08), r * 0.75),
    rod("tail3", "leftLittleDistal", v(0, 0.005, -0.07), r * 0.65),
    // ball joints
    ball("jShoulderL", "leftUpperArm"),
    ball("jShoulderR", "rightUpperArm"),
    ball("jElbowL", "leftLowerArm"),
    ball("jElbowR", "rightLowerArm"),
    ball("jHipL", "leftUpperLeg"),
    ball("jHipR", "rightUpperLeg"),
    ball("jKneeL", "leftLowerLeg"),
    ball("jKneeR", "rightLowerLeg"),
  ];

  const skeleton: IAutoFilmSkeleton = { id: "cat", bones };
  const model: IAutoFilmModel = {
    id: "cat",
    name: "stick cat",
    origin: "generated",
    parts,
    skeleton,
    materials: [
      {
        id: "fur",
        name: "fur",
        baseColor: { r: 0.14, g: 0.12, b: 0.13, a: 1, hex: null },
        metallic: 0,
        roughness: 0.7,
        emissive: null,
        opacity: 1,
        baseColorTexture: null,
      },
    ],
    asset: null,
  };
  return { skeleton, model };
};
