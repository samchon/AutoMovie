import { AutoMovieHumanoidBone } from "@automovie/interface";
import * as THREE from "three";

import {
  IAutoMovieExpressionTarget,
  IAutoMovieModelObject,
  IAutoMovieViewerFrame,
} from "./buildModel";

type BoneMapInput =
  | ReadonlyMap<AutoMovieHumanoidBone, THREE.Object3D | null | undefined>
  | Partial<Record<AutoMovieHumanoidBone, THREE.Object3D | null | undefined>>;

/**
 * Runtime adapter for an already-loaded `three.js`/VRM/glTF object.
 *
 * The loader stays with the host application. The viewer only needs a root
 * object, a normalized humanoid bone map, and optional expression/frame hooks
 * so {@link AutoMoviePlayer} can drive imported assets through the same path as
 * generated automovie models.
 *
 * @author Samchon
 * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement Adapts this already-loaded object by direct placement without decoding it.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-direct-placement-boundary Implements the direct-placement boundary while preserving caller ownership.
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Wraps imported caller state without transferring or overwriting its ownership.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the runtime ownership side of isolated scene lowering.
 */
export interface IAutoMovieImportedModelOptions {
  /**
   * Loaded scene or avatar root. Always wrapped in a viewer-owned group, so
   * pose roots never overwrite caller state (a GLTFLoader `gltf.scene`, a VRM0
   * root with three-vrm's baked π yaw).
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-scene-graph-preservation Preserves the caller's loaded scene graph under a viewer-owned wrapper.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-external-adoption-alternatives Implements direct adoption without rewriting the imported hierarchy.
   */
  object: THREE.Object3D;
  /**
   * Optional normalized humanoid bone map for pose playback.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Adds normalized semantic bone bindings without changing the source nodes.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Implements semantic enrichment as a separate adopted-rig mapping.
   */
  bones?: BoneMapInput;
  /**
   * Optional expression sinks such as a VRM expression manager.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Adds expression controls as semantic bindings separate from source geometry.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Implements that adopted-rig enrichment without claiming source-native semantics.
   */
  expressionTargets?: readonly IAutoMovieExpressionTarget[];
  /**
   * Optional runtime flush after pose and expression are written.
   *
   * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement Adapts this already-loaded object by direct placement without decoding it.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-direct-placement-boundary Implements the direct-placement boundary while preserving caller ownership.
   */
  afterAutoMovieFrame?: (frame: IAutoMovieViewerFrame) => void;
}

/**
 * Wrap an imported runtime object as an {@link IAutoMovieModelObject}.
 *
 * @author Samchon
 * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement Adapts this already-loaded object by direct placement without decoding it.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-direct-placement-boundary Implements the direct-placement boundary while preserving caller ownership.
 */
export const createImportedModelObject = (
  options: IAutoMovieImportedModelOptions,
): IAutoMovieModelObject => ({
  // ALWAYS wrap (#1047): `applyPose` writes `pose.root` onto the model root's
  // local transform, and adopting a caller's Group directly (GLTFLoader's
  // `gltf.scene`, three-vrm's π-yawed VRM0 root) would stomp caller-owned
  // state, the same asset composed differently on an incidental instanceof.
  object: wrapObject(options.object),
  bones: normalizeBones(options.bones),
  // An imported appearance is one runtime object rather than the authored
  // parts a generated model is built from, so there is nothing here to address
  // by part id. A prop drawing imported bytes therefore cannot hang a joint on
  // a named piece of them; its articulation still turns, and what it turns is
  // whatever the joint's own subtree holds.
  parts: new Map(),
  expressionTargets: options.expressionTargets,
  afterAutoMovieFrame: options.afterAutoMovieFrame,
});

/**
 * Map loaded glTF/VRM nodes onto the normalized bones a compiled proxy owns.
 *
 * Exact VRM names work for the whole humanoid set. Common Blender, Mixamo and
 * Unreal names for the major body chains are normalized through the same
 * aliases accepted by the ingest package. The first loaded node wins for each
 * slot so separate clothing skins cannot replace the body rig accidentally.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Selects deterministic humanoid slots from direct names and known aliases.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Implements the concrete source-node to target-slot retarget mapping candidate.
 */
export const mapImportedHumanoidBones = (
  object: THREE.Object3D,
  slots: readonly AutoMovieHumanoidBone[],
): Map<AutoMovieHumanoidBone, THREE.Object3D> => {
  const requested = new Set(slots);
  const bones = new Map<AutoMovieHumanoidBone, THREE.Object3D>();
  object.traverse((node) => {
    const normalized = normalizeImportedBoneName(node.name);
    const direct = slots.find(
      (slot) => normalizeImportedBoneName(slot) === normalized,
    );
    const slot = direct ?? IMPORTED_HUMANOID_ALIASES[normalized];
    if (slot !== undefined && requested.has(slot) && bones.has(slot) === false)
      bones.set(slot, node);
  });
  return bones;
};

const wrapObject = (object: THREE.Object3D): THREE.Group => {
  const group = new THREE.Group();
  group.name = object.name === "" ? "imported" : `${object.name}:runtime`;
  group.add(object);
  return group;
};

const normalizeBones = (
  input: BoneMapInput | undefined,
): Map<AutoMovieHumanoidBone, THREE.Object3D> => {
  const bones = new Map<AutoMovieHumanoidBone, THREE.Object3D>();
  if (input === undefined) return bones;
  if (input instanceof Map) {
    for (const [bone, node] of input)
      if (node !== null && node !== undefined) bones.set(bone, node);
    return bones;
  }
  for (const [bone, node] of Object.entries(input))
    if (node !== null && node !== undefined)
      bones.set(bone as AutoMovieHumanoidBone, node);
  return bones;
};

const normalizeImportedBoneName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/^mixamorig:?/u, "")
    .replace(/[\s_.:|-]/gu, "");

const IMPORTED_HUMANOID_ALIASES: Readonly<
  Record<string, AutoMovieHumanoidBone>
> = {
  pelvis: "hips",
  spine01: "spine",
  spine1: "chest",
  spine02: "chest",
  spine2: "upperChest",
  spine03: "upperChest",
  leftclavicle: "leftShoulder",
  leftarm: "leftUpperArm",
  leftforearm: "leftLowerArm",
  leftupleg: "leftUpperLeg",
  leftleg: "leftLowerLeg",
  lefttoebase: "leftToes",
  rightclavicle: "rightShoulder",
  rightarm: "rightUpperArm",
  rightforearm: "rightLowerArm",
  rightupleg: "rightUpperLeg",
  rightleg: "rightLowerLeg",
  righttoebase: "rightToes",
};
