import type { Document, Node as GLTFNode } from "@gltf-transform/core";
import {
  IMoticaBone,
  IMoticaSkeleton,
  MoticaHumanoidBone,
} from "@motica/interface";

/**
 * Bone-name aliases → normalized humanoid slots, covering the common rig naming
 * conventions an imported glTF uses: the glTF/Blender standard (`Spine`,
 * `LeftUpLeg`), Mixamo (`mixamorig:LeftArm`), and VRM-ish (`leftUpperArm`).
 * Keys are already {@link normalize}d (lowercased, separators and a `mixamorig`
 * prefix stripped). Fingers/eyes/jaw are out of scope for this first mapping.
 */
const HUMANOID_ALIASES: Record<string, MoticaHumanoidBone> = {
  hips: "hips",
  pelvis: "hips",
  spine: "spine",
  spine1: "chest",
  chest: "chest",
  spine2: "upperChest",
  upperchest: "upperChest",
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
 * {@link IMoticaSkeleton} by matching each skin joint's name to a
 * {@link MoticaHumanoidBone} slot — the bridge that turns a real rigged glTF/VRM
 * into a motica character (poses and motions authored on the slots then replay
 * on it).
 *
 * The skeleton's hierarchy is rebuilt over the mapped joints only: a bone's
 * parent is its nearest _mapped_ ancestor in the glTF node tree, so
 * non-humanoid helper bones between two slots are skipped. Rest transforms come
 * from the joints' local TRS. Returns `null` when there is no skin or no `hips`
 * (the required root) could be identified — the caller then keeps the model as
 * a non-articulated object.
 *
 * @author Samchon
 */
export const humanoidSkeleton = (
  doc: Document,
  skeletonId = "skeleton",
): IMoticaSkeleton | null => {
  const skins = doc.getRoot().listSkins();
  if (skins.length === 0) return null;

  // First-wins mapping of joint node → humanoid slot.
  const slotByNode = new Map<GLTFNode, MoticaHumanoidBone>();
  const used = new Set<MoticaHumanoidBone>();
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

  const bones: IMoticaBone[] = [];
  for (const [node, slot] of slotByNode) {
    let ancestor = parentNode.get(node);
    let parent: MoticaHumanoidBone | null = null;
    while (ancestor !== undefined) {
      const mapped = slotByNode.get(ancestor);
      if (mapped !== undefined) {
        parent = mapped;
        break;
      }
      ancestor = parentNode.get(ancestor);
    }
    const t = node.getTranslation();
    const r = node.getRotation();
    const s = node.getScale();
    bones.push({
      bone: slot,
      parent,
      rest: {
        translation: { x: t[0], y: t[1], z: t[2] },
        rotation: { x: r[0], y: r[1], z: r[2], w: r[3] },
        scale: { x: s[0], y: s[1], z: s[2] },
      },
      constraint: null,
    });
  }
  return { id: skeletonId, bones };
};
