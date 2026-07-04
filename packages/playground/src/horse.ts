import { aimRotation } from "@automovie/engine";
import {
  automovieHumanoidBone,
  automoviePrimitiveShape,
  IautomovieBone,
  IautomovieJointConstraint,
  IautomovieModel,
  IautomovieModelPart,
  IautomovieQuaternion,
  IautomovieSkeleton,
  IautomovieTransform,
  IautomovieVector3,
} from "@automovie/interface";

/**
 * A stick-figure **horse** ??a large quadruped on the normalized humanoid rig,
 * the mount for the {@link buildKnight} rider. Same reinterpretation as the
 * {@link buildCat}: a horizontal spine (hips at the croup, chest at the
 * withers), the **arm** slots are the front legs and the **leg** slots the hind
 * legs (all four down, so the default clinical axes swing them sagittally), and
 * the finger chain is the long tail. It just runs bigger and longer-limbed,
 * with a maned neck and a muzzle.
 *
 * Its `spine` bone is the **saddle**: a rider is fixed to that bone's world
 * frame (see `resolveAttachment`), so the rider pitches with the back as the
 * horse rears. All lengths are in meters.
 *
 * @author Samchon
 */
export interface IHorseParams {
  /** Height of the back line (withers/croup) off the floor. */
  backHeight: number;
  /** Hips ??chest body length (the horizontal barrel). */
  trunkLength: number;
  /** Half the track width between the left/right legs. */
  legHalf: number;
  /** Upper-leg (shoulder/hip ??knee) length. */
  upperLeg: number;
  /** Lower-leg (knee ??hoof) length. */
  lowerLeg: number;
  /** Head sphere radius. */
  headRadius: number;
  /** Radius of a leg rod. */
  rodRadius: number;
  /** Radius of the barrel (spine) rods. */
  trunkRadius: number;
}

/** A riding horse ??1.5 m at the withers. */
export const DEFAULT_HORSE: IHorseParams = {
  backHeight: 1.0,
  trunkLength: 0.92,
  legHalf: 0.17,
  upperLeg: 0.46,
  lowerLeg: 0.46,
  headRadius: 0.15,
  rodRadius: 0.06,
  trunkRadius: 0.13,
};

const range = (min: number, max: number) => ({ min, max });
const con = (
  flexion: { min: number; max: number } | null,
  abduction: { min: number; max: number } | null,
  twist: { min: number; max: number } | null,
): IautomovieJointConstraint => ({ flexion, abduction, twist });

const legCon = con(range(-80, 90), range(-15, 25), range(-15, 15));
const kneeCon = con(range(-10, 150), null, null);
const hoofCon = con(range(-40, 40), null, null);

/** Horse-tuned per-joint ROM. Bones omitted are unconstrained. */
export const HORSE_ROM: Partial<
  Record<automovieHumanoidBone, IautomovieJointConstraint>
> = {
  spine: con(range(-45, 50), range(-20, 20), range(-25, 25)),
  chest: con(range(-35, 40), range(-15, 15), range(-20, 20)),
  neck: con(range(-70, 80), range(-40, 40), range(-40, 40)),
  head: con(range(-60, 60), range(-30, 30), range(-50, 50)),
  leftUpperArm: legCon,
  rightUpperArm: legCon,
  leftLowerArm: kneeCon,
  rightLowerArm: kneeCon,
  leftHand: hoofCon,
  rightHand: hoofCon,
  leftUpperLeg: legCon,
  rightUpperLeg: legCon,
  leftLowerLeg: kneeCon,
  rightLowerLeg: kneeCon,
  leftFoot: hoofCon,
  rightFoot: hoofCon,
  leftLittleProximal: con(range(-70, 70), range(-60, 60), null),
  leftLittleIntermediate: con(range(-70, 70), range(-60, 60), null),
  leftLittleDistal: con(range(-70, 70), range(-60, 60), null),
};

const v = (x: number, y: number, z: number): IautomovieVector3 => ({ x, y, z });
const at = (
  t: IautomovieVector3,
  r?: IautomovieQuaternion,
): IautomovieTransform => ({
  translation: t,
  rotation: r ?? { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});
const bone = (
  name: automovieHumanoidBone,
  parent: automovieHumanoidBone | null,
  rest: IautomovieTransform,
): IautomovieBone => ({
  bone: name,
  parent,
  rest,
  constraint: HORSE_ROM[name] ?? null,
});

/** Shortest-arc rotation taking the local +Y axis onto a target direction. */
const yToDir = (dir: IautomovieVector3): IautomovieQuaternion =>
  aimRotation({ x: 0, y: 1, z: 0 }, dir);

const capsule = (radius: number, length: number): automoviePrimitiveShape => ({
  type: "capsule",
  radius,
  height: Math.max(0.01, length - 2 * radius),
});

const rod = (
  id: string,
  boneName: automovieHumanoidBone,
  seg: IautomovieVector3,
  radius: number,
  material = "hide",
): IautomovieModelPart => ({
  id,
  name: id,
  geometry: {
    type: "primitive",
    shape: capsule(radius, Math.hypot(seg.x, seg.y, seg.z)),
  },
  material,
  attachedBone: boneName,
  transform: at(v(seg.x / 2, seg.y / 2, seg.z / 2), yToDir(seg)),
});

/**
 * Build the stick-figure horse ??a big quadruped skeleton, rods, a maned neck,
 * a muzzle, ears, and a long tail ??from a set of proportions. The `spine` bone
 * is the saddle a rider attaches to.
 *
 * @author Samchon
 */
export const buildHorse = (
  p: IHorseParams,
): { skeleton: IautomovieSkeleton; model: IautomovieModel } => {
  const H = p.backHeight;
  const t1 = p.trunkLength * 0.5; // hips?뭩pine and spine?뭖hest
  const lh = p.legHalf;
  const down = (len: number): IautomovieVector3 => v(0, -len, 0);
  // neck rises up-and-forward from the chest; head continues that line
  const neckSeg = v(0, 0.34, 0.26);
  const headSeg = v(0, 0.12, 0.2);

  const bones: IautomovieBone[] = [
    bone("hips", null, at(v(0, H, 0))),
    bone("spine", "hips", at(v(0, 0, t1))),
    bone("chest", "spine", at(v(0, 0, t1))),
    bone("neck", "chest", at(neckSeg)),
    bone("head", "neck", at(headSeg)),
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
    // long tail (repurposed finger chain), trailing down-and-back from the hips
    bone("leftLittleProximal", "hips", at(v(0, 0.04, -0.16))),
    bone(
      "leftLittleIntermediate",
      "leftLittleProximal",
      at(v(0, -0.06, -0.18)),
    ),
    bone("leftLittleDistal", "leftLittleIntermediate", at(v(0, -0.12, -0.16))),
  ];

  const r = p.rodRadius;
  const tr = p.trunkRadius;
  const knob = (
    id: string,
    boneName: automovieHumanoidBone,
    radius: number,
    material: string,
    offset: IautomovieVector3,
  ): IautomovieModelPart => ({
    id,
    name: id,
    geometry: { type: "primitive", shape: { type: "sphere", radius } },
    material,
    attachedBone: boneName,
    transform: at(offset),
  });
  const ball = (
    id: string,
    boneName: automovieHumanoidBone,
    radius = r * 1.2,
  ): IautomovieModelPart => knob(id, boneName, radius, "hide", v(0, 0, 0));
  const cone = (
    id: string,
    boneName: automovieHumanoidBone,
    offset: IautomovieVector3,
    height: number,
    rot: IautomovieQuaternion,
  ): IautomovieModelPart => ({
    id,
    name: id,
    geometry: {
      type: "primitive",
      shape: { type: "cone", radius: height * 0.45, height },
    },
    material: "hide",
    attachedBone: boneName,
    transform: at(offset, rot),
  });

  const parts: IautomovieModelPart[] = [
    // barrel + neck + head stalk
    rod("barrelRear", "hips", v(0, 0, t1), tr),
    rod("barrelFront", "spine", v(0, 0, t1), tr),
    rod("neckRod", "chest", neckSeg, tr * 0.72),
    rod("headStalk", "neck", headSeg, tr * 0.5),
    knob("head", "head", p.headRadius, "hide", v(0, 0.02, 0.04)),
    // muzzle ??a smaller sphere out the front of the head
    knob(
      "muzzle",
      "head",
      p.headRadius * 0.62,
      "hide",
      v(0, -0.04, p.headRadius * 1.05),
    ),
    // ears
    cone(
      "earL",
      "head",
      v(0.06, p.headRadius * 0.95, -0.02),
      0.12,
      yToDir(v(0.2, 1, -0.1)),
    ),
    cone(
      "earR",
      "head",
      v(-0.06, p.headRadius * 0.95, -0.02),
      0.12,
      yToDir(v(-0.2, 1, -0.1)),
    ),
    // eyes with pupils
    knob(
      "eyeL",
      "head",
      p.headRadius * 0.24,
      "eye",
      v(0.1, 0.05, p.headRadius * 0.6),
    ),
    knob(
      "eyeR",
      "head",
      p.headRadius * 0.24,
      "eye",
      v(-0.1, 0.05, p.headRadius * 0.6),
    ),
    knob(
      "pupilL",
      "head",
      p.headRadius * 0.11,
      "pupil",
      v(0.11, 0.05, p.headRadius * 0.78),
    ),
    knob(
      "pupilR",
      "head",
      p.headRadius * 0.11,
      "pupil",
      v(-0.11, 0.05, p.headRadius * 0.78),
    ),
    // mane ??a row of plates riding the neck
    knob(
      "mane1",
      "neck",
      tr * 0.5,
      "mane",
      v(0, neckSeg.y * 0.25, neckSeg.z * 0.25 - 0.06),
    ),
    knob(
      "mane2",
      "neck",
      tr * 0.5,
      "mane",
      v(0, neckSeg.y * 0.55, neckSeg.z * 0.55 - 0.06),
    ),
    knob(
      "mane3",
      "neck",
      tr * 0.45,
      "mane",
      v(0, neckSeg.y * 0.82, neckSeg.z * 0.82 - 0.05),
    ),
    knob(
      "forelock",
      "head",
      p.headRadius * 0.4,
      "mane",
      v(0, p.headRadius * 0.9, -0.04),
    ),
    // front legs
    rod("flUpperL", "leftUpperArm", down(p.upperLeg), r),
    rod("flLowerL", "leftLowerArm", down(p.lowerLeg), r * 0.82),
    rod("flUpperR", "rightUpperArm", down(p.upperLeg), r),
    rod("flLowerR", "rightLowerArm", down(p.lowerLeg), r * 0.82),
    // hind legs
    rod("hlUpperL", "leftUpperLeg", down(p.upperLeg), r),
    rod("hlLowerL", "leftLowerLeg", down(p.lowerLeg), r * 0.82),
    rod("hlUpperR", "rightUpperLeg", down(p.upperLeg), r),
    rod("hlLowerR", "rightLowerLeg", down(p.lowerLeg), r * 0.82),
    // hooves ??dark caps at each lower-leg tip
    knob("hoofFL", "leftHand", r * 0.95, "hoof", v(0, 0, 0)),
    knob("hoofFR", "rightHand", r * 0.95, "hoof", v(0, 0, 0)),
    knob("hoofHL", "leftFoot", r * 0.95, "hoof", v(0, 0, 0)),
    knob("hoofHR", "rightFoot", r * 0.95, "hoof", v(0, 0, 0)),
    // tail ??base rod joins the hips to the first tail segment (mane-coloured)
    rod("tailBase", "hips", v(0, 0.04, -0.16), r * 0.8, "mane"),
    rod("tail1", "leftLittleProximal", v(0, -0.06, -0.18), r * 0.7, "mane"),
    rod("tail2", "leftLittleIntermediate", v(0, -0.12, -0.16), r * 0.6, "mane"),
    rod("tail3", "leftLittleDistal", v(0, -0.12, -0.12), r * 0.5, "mane"),
    // ball joints at the limb roots/knees
    ball("jShoulderL", "leftUpperArm"),
    ball("jShoulderR", "rightUpperArm"),
    ball("jElbowL", "leftLowerArm", r * 0.9),
    ball("jElbowR", "rightLowerArm", r * 0.9),
    ball("jHipL", "leftUpperLeg"),
    ball("jHipR", "rightUpperLeg"),
    ball("jKneeL", "leftLowerLeg", r * 0.9),
    ball("jKneeR", "rightLowerLeg", r * 0.9),
  ];

  const skeleton: IautomovieSkeleton = { id: "horse", bones };
  const model: IautomovieModel = {
    id: "horse",
    name: "stick horse",
    origin: "generated",
    parts,
    skeleton,
    materials: [
      mat("hide", 0.35, 0.24, 0.14),
      mat("mane", 0.12, 0.08, 0.05),
      mat("hoof", 0.08, 0.07, 0.06),
      { ...mat("eye", 0.95, 0.96, 0.98), roughness: 0.3 },
      mat("pupil", 0.04, 0.04, 0.05),
    ],
    asset: null,
  };
  return { skeleton, model };
};

const mat = (id: string, r: number, g: number, b: number) => ({
  id,
  name: id,
  baseColor: { r, g, b, a: 1, hex: null },
  metallic: 0,
  roughness: 0.6,
  emissive: null,
  opacity: 1,
  baseColorTexture: null,
});
