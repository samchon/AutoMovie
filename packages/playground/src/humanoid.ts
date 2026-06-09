import { Quaternion } from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  AutoFilmPrimitiveShape,
  IAutoFilmBone,
  IAutoFilmModel,
  IAutoFilmModelPart,
  IAutoFilmQuaternion,
  IAutoFilmSkeleton,
  IAutoFilmTransform,
  IAutoFilmVector3,
} from "@autofilm/interface";

/**
 * The tunable proportions of the procedural humanoid — the parameters the
 * character editor exposes. Every value is in meters (or a unitless factor for
 * the radii). This is deliberately the "beginner" tier: a handful of gross body
 * measurements, not a per-vertex morph rig. It is enough to make tall/short,
 * lanky/stocky, big/small-headed figures — the variety a character roster needs
 * before any finer sculpting.
 *
 * @author Samchon
 */
export interface IHumanoidParams {
  /** Pelvis height off the floor (≈ leg length). */
  hipHeight: number;
  /** Combined spine length (hips → neck). */
  torsoLength: number;
  /** Neck length (chest top → head). */
  neckLength: number;
  /** Distance between the two shoulder sockets. */
  shoulderWidth: number;
  /** Distance between the two hip sockets. */
  hipWidth: number;
  /** Upper-arm (shoulder → elbow) length. */
  upperArmLength: number;
  /** Forearm (elbow → wrist) length. */
  lowerArmLength: number;
  /** Thigh (hip → knee) length. */
  thighLength: number;
  /** Shin (knee → ankle) length. */
  shinLength: number;
  /** Limb (arm/leg) capsule radius — "stockiness". */
  limbRadius: number;
  /** Head sphere radius. */
  headRadius: number;
}

/** A neutral adult-ish default the editor starts from. */
export const DEFAULT_PARAMS: IHumanoidParams = {
  hipHeight: 0.9,
  torsoLength: 0.6,
  neckLength: 0.1,
  shoulderWidth: 0.36,
  hipWidth: 0.18,
  upperArmLength: 0.28,
  lowerArmLength: 0.25,
  thighLength: 0.45,
  shinLength: 0.43,
  limbRadius: 0.055,
  headRadius: 0.12,
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
): IAutoFilmBone => ({ bone: name, parent, rest, constraint: null });

/** Shortest-arc rotation taking the local +Y axis onto a target direction. */
const yToDir = (dir: IAutoFilmVector3): IAutoFilmQuaternion => {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len === 0) return { x: 0, y: 0, z: 0, w: 1 };
  const n = v(dir.x / len, dir.y / len, dir.z / len);
  const dot = n.y; // dot(+Y, n)
  if (dot > 0.999999) return { x: 0, y: 0, z: 0, w: 1 };
  // Antiparallel: 180° about any axis ⟂ Y — use +Z.
  if (dot < -0.999999) return { x: 0, y: 0, z: 1, w: 0 };
  // axis = cross(+Y, n); angle from dot.
  const axis = v(n.z, 0, -n.x); // cross((0,1,0), n)
  return Quaternion.normalize(
    Quaternion.fromAxisAngle(axis, (Math.acos(dot) * 180) / Math.PI),
  );
};

const capsule = (radius: number, height: number): AutoFilmPrimitiveShape => ({
  type: "capsule",
  radius,
  height: Math.max(0.01, height - 2 * radius),
});

/**
 * A rigid limb segment: a capsule attached to `boneName`, spanning from that
 * bone toward its child along `seg` (a local offset vector), so it rides the
 * bone and bends with articulation.
 */
const segment = (
  id: string,
  boneName: AutoFilmHumanoidBone,
  seg: IAutoFilmVector3,
  radius: number,
  material: string,
): IAutoFilmModelPart => {
  const length = Math.hypot(seg.x, seg.y, seg.z);
  return {
    id,
    name: id,
    geometry: { type: "primitive", shape: capsule(radius, length) },
    material,
    attachedBone: boneName,
    transform: at(v(seg.x / 2, seg.y / 2, seg.z / 2), yToDir(seg)),
  };
};

const blob = (
  id: string,
  boneName: AutoFilmHumanoidBone,
  shape: AutoFilmPrimitiveShape,
  offset: IAutoFilmVector3,
  material: string,
): IAutoFilmModelPart => ({
  id,
  name: id,
  geometry: { type: "primitive", shape },
  material,
  attachedBone: boneName,
  transform: at(offset),
});

/**
 * Build the procedural humanoid — a normalized VRM skeleton plus a primitive
 * "blockman" skin — from a set of editor proportions.
 *
 * This is autofilm's bootstrap **base 3D model**: fully generated (no external
 * asset), deterministic, and rigged on the same {@link AutoFilmHumanoidBone}
 * slots every imported VRM uses, so a pose or motion authored here replays on a
 * real avatar once ingest lands. The editor calls this on every proportion
 * change to rebuild the figure; the engine's FK then articulates the very same
 * bones.
 *
 * @author Samchon
 */
export const buildHumanoid = (
  p: IHumanoidParams,
): { skeleton: IAutoFilmSkeleton; model: IAutoFilmModel } => {
  const spineLen = p.torsoLength * 0.4;
  const chestLen = p.torsoLength * 0.35;
  const armY = p.torsoLength * 0.25; // shoulder height above chest origin
  const sx = p.shoulderWidth / 2;
  const hx = p.hipWidth / 2;

  const bones: IAutoFilmBone[] = [
    bone("hips", null, at(v(0, p.hipHeight, 0))),
    bone("spine", "hips", at(v(0, spineLen * 0.5, 0))),
    bone("chest", "spine", at(v(0, spineLen, 0))),
    bone("neck", "chest", at(v(0, chestLen, 0))),
    bone("head", "neck", at(v(0, p.neckLength, 0))),
    // arms (root → tip), extending along ±X
    bone("leftUpperArm", "chest", at(v(sx, armY, 0))),
    bone("leftLowerArm", "leftUpperArm", at(v(p.upperArmLength, 0, 0))),
    bone("leftHand", "leftLowerArm", at(v(p.lowerArmLength, 0, 0))),
    bone("rightUpperArm", "chest", at(v(-sx, armY, 0))),
    bone("rightLowerArm", "rightUpperArm", at(v(-p.upperArmLength, 0, 0))),
    bone("rightHand", "rightLowerArm", at(v(-p.lowerArmLength, 0, 0))),
    // legs (root → tip), extending along −Y
    bone("leftUpperLeg", "hips", at(v(hx, 0, 0))),
    bone("leftLowerLeg", "leftUpperLeg", at(v(0, -p.thighLength, 0))),
    bone("leftFoot", "leftLowerLeg", at(v(0, -p.shinLength, 0))),
    bone("rightUpperLeg", "hips", at(v(-hx, 0, 0))),
    bone("rightLowerLeg", "rightUpperLeg", at(v(0, -p.thighLength, 0))),
    bone("rightFoot", "rightLowerLeg", at(v(0, -p.shinLength, 0))),
  ];

  const r = p.limbRadius;
  const foot: AutoFilmPrimitiveShape = {
    type: "box",
    width: r * 1.6,
    height: r * 0.8,
    depth: r * 3,
  };
  const parts: IAutoFilmModelPart[] = [
    blob(
      "torso",
      "chest",
      { type: "capsule", radius: r * 2.2, height: p.torsoLength * 0.5 },
      v(0, chestLen * 0.1, 0),
      "skin",
    ),
    blob(
      "head",
      "head",
      { type: "sphere", radius: p.headRadius },
      v(0, p.headRadius, 0),
      "skin",
    ),
    segment("armUpperL", "leftUpperArm", v(p.upperArmLength, 0, 0), r, "skin"),
    segment("armLowerL", "leftLowerArm", v(p.lowerArmLength, 0, 0), r, "skin"),
    segment(
      "armUpperR",
      "rightUpperArm",
      v(-p.upperArmLength, 0, 0),
      r,
      "skin",
    ),
    segment(
      "armLowerR",
      "rightLowerArm",
      v(-p.lowerArmLength, 0, 0),
      r,
      "skin",
    ),
    segment(
      "legUpperL",
      "leftUpperLeg",
      v(0, -p.thighLength, 0),
      r * 1.2,
      "skin",
    ),
    segment(
      "legLowerL",
      "leftLowerLeg",
      v(0, -p.shinLength, 0),
      r * 1.1,
      "skin",
    ),
    segment(
      "legUpperR",
      "rightUpperLeg",
      v(0, -p.thighLength, 0),
      r * 1.2,
      "skin",
    ),
    segment(
      "legLowerR",
      "rightLowerLeg",
      v(0, -p.shinLength, 0),
      r * 1.1,
      "skin",
    ),
    blob("footL", "leftFoot", foot, v(0, -r * 0.4, r), "skin"),
    blob("footR", "rightFoot", foot, v(0, -r * 0.4, r), "skin"),
  ];

  const skeleton: IAutoFilmSkeleton = { id: "humanoid", bones };
  const model: IAutoFilmModel = {
    id: "humanoid",
    name: "procedural humanoid",
    origin: "generated",
    parts,
    skeleton,
    materials: [
      {
        id: "skin",
        name: "skin",
        baseColor: { r: 0.85, g: 0.68, b: 0.55, a: 1, hex: null },
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
