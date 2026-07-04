import { DEFAULT_HUMANOID_ROM, aimRotation } from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  AutoMoviePrimitiveShape,
  IAutoMovieBone,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieQuaternion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Proportions of the **stick figure** ("졸라맨") — the deliberately minimal test
 * character. Where {@link IHumanoidParams} fills the rig with capsule "flesh",
 * the stick figure keeps every segment a thin uniform rod and the head a single
 * sphere: the most legible possible body to read a pose or a motion off of.
 *
 * It is rigged on the same {@link AutoMovieHumanoidBone} slots as every other
 * automovie character, so a clip authored on the stick figure replays unchanged
 * on a fully fleshed humanoid (or an imported VRM) later. All lengths are in
 * meters.
 *
 * @author Samchon
 */
export interface IStickmanParams {
  /** Pelvis height off the floor (≈ leg length). */
  hipHeight: number;
  /** Hips → spine segment length. */
  pelvisToSpine: number;
  /** Spine → chest segment length. */
  spineToChest: number;
  /** Chest → neck segment length. */
  chestToNeck: number;
  /** Neck → head segment length. */
  neckLength: number;
  /** Half the distance between the two shoulder sockets. */
  shoulderHalf: number;
  /** Shoulder height above the chest origin. */
  shoulderRise: number;
  /** Half the distance between the two hip sockets. */
  hipHalf: number;
  /** Upper-arm (shoulder → elbow) length. */
  upperArm: number;
  /** Forearm (elbow → wrist) length. */
  lowerArm: number;
  /** Thigh (hip → knee) length. */
  thigh: number;
  /** Shin (knee → ankle) length. */
  shin: number;
  /** Radius of an arm / leg rod — the limb "thickness". */
  rodRadius: number;
  /** Radius of a torso (spine/chest) rod — a touch heftier than the limbs. */
  torsoRadius: number;
  /** Radius of the fist spheres capping the wrists. */
  fistRadius: number;
  /** Head sphere radius. */
  headRadius: number;
}

/**
 * A legible stick figure ≈ 1.72 m tall — no longer hairline-thin: arms/legs and
 * torso carry a believable thickness (the head and fists stay simple spheres)
 * so it reads like a body, not a wire diagram.
 */
export const DEFAULT_STICKMAN: IStickmanParams = {
  hipHeight: 0.92,
  pelvisToSpine: 0.2,
  spineToChest: 0.22,
  chestToNeck: 0.15,
  neckLength: 0.035,
  shoulderHalf: 0.17,
  shoulderRise: 0.14,
  hipHalf: 0.05,
  upperArm: 0.29,
  lowerArm: 0.26,
  thigh: 0.47,
  shin: 0.45,
  rodRadius: 0.045,
  torsoRadius: 0.07,
  fistRadius: 0.055,
  headRadius: 0.12,
};

const v = (x: number, y: number, z: number): IAutoMovieVector3 => ({ x, y, z });

const at = (
  t: IAutoMovieVector3,
  r?: IAutoMovieQuaternion,
): IAutoMovieTransform => ({
  translation: t,
  rotation: r ?? { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const bone = (
  name: AutoMovieHumanoidBone,
  parent: AutoMovieHumanoidBone | null,
  rest: IAutoMovieTransform,
): IAutoMovieBone => {
  // each joint carries its anatomical ROM in **clinical** space (abduction 0 =
  // arm down, 90 = horizontal, 180 = overhead — the engine validates/clamps
  // against it, the core differentiator). The per-side rest-frame remap that
  // reconciles clinical to this T-pose rig lives in the render (the player's
  // HUMANOID_REST_FRAME), not baked into the constraint.
  const rom = DEFAULT_HUMANOID_ROM[name] ?? null;
  return {
    bone: name,
    parent,
    rest,
    constraint: rom,
  };
};

/** Shortest-arc rotation taking the local +Y axis onto a target direction. */
const yToDir = (dir: IAutoMovieVector3): IAutoMovieQuaternion =>
  aimRotation({ x: 0, y: 1, z: 0 }, dir);

const capsule = (radius: number, length: number): AutoMoviePrimitiveShape => ({
  type: "capsule",
  radius,
  height: Math.max(0.01, length - 2 * radius),
});

/**
 * A rigid rod: a thin capsule attached to `boneName`, spanning from that bone
 * toward its child along `seg` (a bone-local offset), so it rides the bone and
 * bends at the joint.
 */
const rod = (
  id: string,
  boneName: AutoMovieHumanoidBone,
  seg: IAutoMovieVector3,
  radius: number,
  material: string,
): IAutoMovieModelPart => {
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

/**
 * Build the stick figure — a normalized VRM skeleton clothed in thin rods and a
 * sphere head — from a set of proportions.
 *
 * The rig is a T-pose at rest (arms out along ±X, legs straight down −Y); a
 * pose or motion articulates it from there. Same bone slots, same FK path, same
 * ROM hooks as the fuller {@link buildHumanoid} blockman — just the most
 * stripped-down skin so motion is the only thing on screen.
 *
 * @author Samchon
 */
export const buildStickman = (
  p: IStickmanParams,
): { skeleton: IAutoMovieSkeleton; model: IAutoMovieModel } => {
  const bones: IAutoMovieBone[] = [
    bone("hips", null, at(v(0, p.hipHeight, 0))),
    bone("spine", "hips", at(v(0, p.pelvisToSpine, 0))),
    bone("chest", "spine", at(v(0, p.spineToChest, 0))),
    bone("neck", "chest", at(v(0, p.chestToNeck, 0))),
    bone("head", "neck", at(v(0, p.neckLength, 0))),
    // arms (root → tip), extending along ±X (T-pose)
    bone("leftUpperArm", "chest", at(v(p.shoulderHalf, p.shoulderRise, 0))),
    bone("leftLowerArm", "leftUpperArm", at(v(p.upperArm, 0, 0))),
    bone("leftHand", "leftLowerArm", at(v(p.lowerArm, 0, 0))),
    bone("rightUpperArm", "chest", at(v(-p.shoulderHalf, p.shoulderRise, 0))),
    bone("rightLowerArm", "rightUpperArm", at(v(-p.upperArm, 0, 0))),
    bone("rightHand", "rightLowerArm", at(v(-p.lowerArm, 0, 0))),
    // legs (root → tip), extending along −Y
    bone("leftUpperLeg", "hips", at(v(p.hipHalf, 0, 0))),
    bone("leftLowerLeg", "leftUpperLeg", at(v(0, -p.thigh, 0))),
    bone("leftFoot", "leftLowerLeg", at(v(0, -p.shin, 0))),
    bone("rightUpperLeg", "hips", at(v(-p.hipHalf, 0, 0))),
    bone("rightLowerLeg", "rightUpperLeg", at(v(0, -p.thigh, 0))),
    bone("rightFoot", "rightLowerLeg", at(v(0, -p.shin, 0))),
  ];

  const r = p.rodRadius;
  const tr = p.torsoRadius;
  /** A sphere of arbitrary radius attached at a bone's origin (fists, etc.). */
  const knob = (
    id: string,
    boneName: AutoMovieHumanoidBone,
    radius: number,
    material = "ink",
    offset: IAutoMovieVector3 = v(0, 0, 0),
  ): IAutoMovieModelPart => ({
    id,
    name: id,
    geometry: { type: "primitive", shape: { type: "sphere", radius } },
    material,
    attachedBone: boneName,
    transform: at(offset),
  });
  /** A ball joint: a sphere at a bone's origin, hiding the gap between rods. */
  const ball = (
    id: string,
    boneName: AutoMovieHumanoidBone,
  ): IAutoMovieModelPart => ({
    id,
    name: id,
    geometry: {
      type: "primitive",
      shape: { type: "sphere", radius: r * 1.35 },
    },
    material: "ink",
    attachedBone: boneName,
    transform: at(v(0, 0, 0)),
  });

  const parts: IAutoMovieModelPart[] = [
    // torso column — one rod per spine bone so it bends with the back (thicker
    // than the limbs, tapering up the neck)
    rod("spineRod", "hips", v(0, p.pelvisToSpine, 0), tr, "ink"),
    rod("chestRod", "spine", v(0, p.spineToChest, 0), tr, "ink"),
    rod("neckBase", "chest", v(0, p.chestToNeck, 0), tr * 0.7, "ink"),
    rod("neckRod", "neck", v(0, p.neckLength, 0), tr * 0.55, "ink"),
    {
      id: "head",
      name: "head",
      geometry: {
        type: "primitive",
        shape: { type: "sphere", radius: p.headRadius },
      },
      material: "ink",
      attachedBone: "head",
      transform: at(v(0, p.headRadius, 0)),
    },
    // a face on the front (+Z) of the head so its facing direction is never
    // ambiguous: two big eyes, dark pupils inside them, and a small nose nub
    knob(
      "eyeL",
      "head",
      p.headRadius * 0.34,
      "eye",
      v(p.headRadius * 0.4, p.headRadius * 1.08, p.headRadius * 0.86),
    ),
    knob(
      "eyeR",
      "head",
      p.headRadius * 0.34,
      "eye",
      v(-p.headRadius * 0.4, p.headRadius * 1.08, p.headRadius * 0.86),
    ),
    knob(
      "pupilL",
      "head",
      p.headRadius * 0.15,
      "pupil",
      v(p.headRadius * 0.42, p.headRadius * 1.06, p.headRadius * 1.12),
    ),
    knob(
      "pupilR",
      "head",
      p.headRadius * 0.15,
      "pupil",
      v(-p.headRadius * 0.42, p.headRadius * 1.06, p.headRadius * 1.12),
    ),
    knob(
      "nose",
      "head",
      p.headRadius * 0.2,
      "ink",
      v(0, p.headRadius * 0.8, p.headRadius * 1.12),
    ),
    // clavicles — connect the spine column to each shoulder socket
    rod("clavicleL", "chest", v(p.shoulderHalf, p.shoulderRise, 0), r, "ink"),
    rod("clavicleR", "chest", v(-p.shoulderHalf, p.shoulderRise, 0), r, "ink"),
    // arms
    rod("armUpperL", "leftUpperArm", v(p.upperArm, 0, 0), r, "ink"),
    rod("armLowerL", "leftLowerArm", v(p.lowerArm, 0, 0), r, "ink"),
    rod("armUpperR", "rightUpperArm", v(-p.upperArm, 0, 0), r, "ink"),
    rod("armLowerR", "rightLowerArm", v(-p.lowerArm, 0, 0), r, "ink"),
    // legs
    rod("legUpperL", "leftUpperLeg", v(0, -p.thigh, 0), r, "ink"),
    rod("legLowerL", "leftLowerLeg", v(0, -p.shin, 0), r, "ink"),
    rod("legUpperR", "rightUpperLeg", v(0, -p.thigh, 0), r, "ink"),
    rod("legLowerR", "rightLowerLeg", v(0, -p.shin, 0), r, "ink"),
    // ball joints — pelvis, shoulders, elbows, hips, knees
    ball("jointHip", "hips"),
    ball("jointShoulderL", "leftUpperArm"),
    ball("jointShoulderR", "rightUpperArm"),
    ball("jointElbowL", "leftLowerArm"),
    ball("jointElbowR", "rightLowerArm"),
    ball("jointHipL", "leftUpperLeg"),
    ball("jointHipR", "rightUpperLeg"),
    ball("jointKneeL", "leftLowerLeg"),
    ball("jointKneeR", "rightLowerLeg"),
    // fists — round caps at the wrists (so punches land with a visible hand)
    knob("fistL", "leftHand", p.fistRadius),
    knob("fistR", "rightHand", p.fistRadius),
    // feet — short rods off each ankle pointing forward (+Z) so the figure
    // stands on something instead of tapering to a point
    rod("footL", "leftFoot", v(0, 0, p.headRadius * 1.1), r * 1.1, "ink"),
    rod("footR", "rightFoot", v(0, 0, p.headRadius * 1.1), r * 1.1, "ink"),
  ];

  const skeleton: IAutoMovieSkeleton = { id: "stickman", bones };
  const model: IAutoMovieModel = {
    id: "stickman",
    name: "stick figure",
    origin: "generated",
    parts,
    skeleton,
    materials: [
      {
        id: "ink",
        name: "ink",
        baseColor: { r: 0.09, g: 0.1, b: 0.12, a: 1, hex: null },
        metallic: 0,
        roughness: 0.6,
        emissive: null,
        opacity: 1,
        baseColorTexture: null,
      },
      {
        id: "eye",
        name: "eye",
        baseColor: { r: 0.95, g: 0.96, b: 0.98, a: 1, hex: null },
        metallic: 0,
        roughness: 0.35,
        emissive: null,
        opacity: 1,
        baseColorTexture: null,
      },
      {
        id: "pupil",
        name: "pupil",
        baseColor: { r: 0.05, g: 0.06, b: 0.09, a: 1, hex: null },
        metallic: 0,
        roughness: 0.4,
        emissive: null,
        opacity: 1,
        baseColorTexture: null,
      },
    ],
    asset: null,
  };
  return { skeleton, model };
};
