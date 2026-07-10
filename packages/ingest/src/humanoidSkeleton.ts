import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import type { Document, Node as GLTFNode } from "@gltf-transform/core";

/**
 * Bone-name aliases → normalized humanoid slots, covering the common rig naming
 * conventions an imported glTF uses: the glTF/Blender standard (`Spine`,
 * `LeftUpLeg`), Mixamo (`mixamorig:LeftArm`), and VRM-ish (`leftUpperArm`).
 * Keys are already {@link normalize}d (lowercased, separators and a `mixamorig`
 * prefix stripped). Fingers/eyes/jaw are out of scope for this first mapping.
 */
const HUMANOID_ALIASES: Record<string, AutoMovieHumanoidBone> = {
  hips: "hips",
  pelvis: "hips",
  spine: "spine",
  spine1: "chest",
  chest: "chest",
  spine2: "upperChest",
  upperchest: "upperChest",
  // UE-mannequin chains (`spine_01..` normalize to `spine01..`): without
  // these the whole spine is unmapped in-chain, making dropped helper
  // offsets the common case for such imports (#1042).
  spine01: "spine",
  spine02: "chest",
  spine03: "upperChest",
  neck: "neck",
  head: "head",
  leftshoulder: "leftShoulder",
  leftclavicle: "leftShoulder",
  leftarm: "leftUpperArm",
  leftupperarm: "leftUpperArm",
  leftforearm: "leftLowerArm",
  leftlowerarm: "leftLowerArm",
  lefthand: "leftHand",
  rightshoulder: "rightShoulder",
  rightclavicle: "rightShoulder",
  rightarm: "rightUpperArm",
  rightupperarm: "rightUpperArm",
  rightforearm: "rightLowerArm",
  rightlowerarm: "rightLowerArm",
  righthand: "rightHand",
  leftupleg: "leftUpperLeg",
  leftupperleg: "leftUpperLeg",
  leftleg: "leftLowerLeg",
  leftlowerleg: "leftLowerLeg",
  leftfoot: "leftFoot",
  lefttoebase: "leftToes",
  lefttoes: "leftToes",
  rightupleg: "rightUpperLeg",
  rightupperleg: "rightUpperLeg",
  rightleg: "rightLowerLeg",
  rightlowerleg: "rightLowerLeg",
  rightfoot: "rightFoot",
  righttoebase: "rightToes",
  righttoes: "rightToes",
};

const normalize = (name: string): string =>
  name
    .toLowerCase()
    .replace(/^mixamorig:?/, "")
    .replace(/[\s_.:|-]/g, "");

/**
 * Retarget an imported glTF's skin onto a normalized humanoid
 * {@link IAutoMovieSkeleton} by matching each skin joint's name to a
 * {@link AutoMovieHumanoidBone} slot — the bridge that turns a real rigged
 * glTF/VRM into a automovie character (poses and motions authored on the slots
 * then replay on it).
 *
 * The skeleton's hierarchy is rebuilt over the mapped joints only: a bone's
 * parent is its nearest _mapped_ ancestor in the glTF node tree, so
 * non-humanoid helper bones between two slots are skipped. Rest transforms
 * compose the joint's local TRS through every skipped helper (#1042) —
 * {@link IAutoMovieBone.rest} is "relative to `parent`", so a helper's offset or
 * roll must survive into the emitted rest or every bone beneath it lands
 * misplaced under FK. A root bone (no mapped ancestor) keeps its own local TRS:
 * armature/scene transforms belong to the imported object, not the skeleton.
 * Returns `null` when there is no skin or no `hips` (the required root) could
 * be identified — the caller then keeps the model as a non-articulated object.
 *
 * @author Samchon
 */
export const humanoidSkeleton = (
  doc: Document,
  skeletonId = "skeleton",
): IAutoMovieSkeleton | null => {
  const skins = doc.getRoot().listSkins();
  if (skins.length === 0) return null;

  // First-wins mapping of joint node → humanoid slot.
  const slotByNode = new Map<GLTFNode, AutoMovieHumanoidBone>();
  const used = new Set<AutoMovieHumanoidBone>();
  for (const joint of skins[0]!.listJoints()) {
    const slot = HUMANOID_ALIASES[normalize(joint.getName())];
    if (slot !== undefined && !used.has(slot)) {
      slotByNode.set(joint, slot);
      used.add(slot);
    }
  }
  if (!used.has("hips")) return null;

  const parentNode = new Map<GLTFNode, GLTFNode>();
  for (const n of doc.getRoot().listNodes())
    for (const child of n.listChildren()) parentNode.set(child, n);

  const bones: IAutoMovieBone[] = [];
  for (const [node, slot] of slotByNode) {
    // Walk to the nearest mapped ancestor, collecting the skipped helpers so
    // their local TRS composes into the emitted rest (#1042).
    const helpers: GLTFNode[] = [];
    let ancestor = parentNode.get(node);
    let parent: AutoMovieHumanoidBone | null = null;
    while (ancestor !== undefined) {
      const mapped = slotByNode.get(ancestor);
      if (mapped !== undefined) {
        parent = mapped;
        break;
      }
      helpers.push(ancestor);
      ancestor = parentNode.get(ancestor);
    }
    let rest = localTransform(node);
    if (parent !== null)
      for (const helper of helpers)
        rest = composeLocal(localTransform(helper), rest);
    bones.push({ bone: slot, parent, rest, constraint: null });
  }
  return { id: skeletonId, bones };
};

const localTransform = (node: GLTFNode): IAutoMovieTransform => {
  const t = node.getTranslation();
  const r = node.getRotation();
  const s = node.getScale();
  return {
    translation: { x: t[0], y: t[1], z: t[2] },
    rotation: { x: r[0], y: r[1], z: r[2], w: r[3] },
    scale: { x: s[0], y: s[1], z: s[2] },
  };
};

/**
 * Compose two local TRS transforms (`parent` applied over `child`): the
 * standard rig decomposition `t' = t_p + R_p·(s_p ∘ t_c)`, `r' = r_p·r_c`, `s'
 * = s_p ∘ s_c`. Exact whenever scales are uniform or the rotation chain does
 * not shear — the shapes real skeleton hierarchies use.
 */
const composeLocal = (
  p: IAutoMovieTransform,
  c: IAutoMovieTransform,
): IAutoMovieTransform => ({
  translation: add(
    p.translation,
    rotate(p.rotation, {
      x: p.scale.x * c.translation.x,
      y: p.scale.y * c.translation.y,
      z: p.scale.z * c.translation.z,
    }),
  ),
  rotation: mulQuat(p.rotation, c.rotation),
  scale: {
    x: p.scale.x * c.scale.x,
    y: p.scale.y * c.scale.y,
    z: p.scale.z * c.scale.z,
  },
});

type IVec3 = IAutoMovieTransform["translation"];
type IQuat = IAutoMovieTransform["rotation"];

const add = (a: IVec3, b: IVec3): IVec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const cross = (a: IVec3, b: IVec3): IVec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Rotate a vector by a unit quaternion: `v' = v + 2q_w(q×v) + 2q×(q×v)`. */
const rotate = (q: IQuat, v: IVec3): IVec3 => {
  const u = { x: q.x, y: q.y, z: q.z };
  const t = cross(u, v);
  const t2 = { x: 2 * t.x, y: 2 * t.y, z: 2 * t.z };
  return add(
    add(v, { x: q.w * t2.x, y: q.w * t2.y, z: q.w * t2.z }),
    cross(u, t2),
  );
};

/** Hamilton product `a·b` (apply `b`, then `a`). */
const mulQuat = (a: IQuat, b: IQuat): IQuat => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
