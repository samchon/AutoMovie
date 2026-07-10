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
 */
export interface IAutoMovieImportedModelOptions {
  /**
   * Loaded scene or avatar root. Always wrapped in a viewer-owned group, so
   * pose roots never overwrite caller state (a GLTFLoader `gltf.scene`, a VRM0
   * root with three-vrm's baked π yaw).
   */
  object: THREE.Object3D;
  /** Optional normalized humanoid bone map for pose playback. */
  bones?: BoneMapInput;
  /** Optional expression sinks such as a VRM expression manager. */
  expressionTargets?: readonly IAutoMovieExpressionTarget[];
  /** Optional runtime flush after pose and expression are written. */
  afterAutoMovieFrame?: (frame: IAutoMovieViewerFrame) => void;
}

/**
 * Wrap an imported runtime object as an {@link IAutoMovieModelObject}.
 *
 * @author Samchon
 */
export const createImportedModelObject = (
  options: IAutoMovieImportedModelOptions,
): IAutoMovieModelObject => ({
  // ALWAYS wrap (#1047): `applyPose` writes `pose.root` onto the model root's
  // local transform, and adopting a caller's Group directly (GLTFLoader's
  // `gltf.scene`, three-vrm's π-yawed VRM0 root) would stomp caller-owned
  // state — the same asset composed differently on an incidental instanceof.
  object: wrapObject(options.object),
  bones: normalizeBones(options.bones),
  expressionTargets: options.expressionTargets,
  afterAutoMovieFrame: options.afterAutoMovieFrame,
});

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
    for (const [bone, node] of input) if (node != null) bones.set(bone, node);
    return bones;
  }
  for (const [bone, node] of Object.entries(input))
    if (node != null) bones.set(bone as AutoMovieHumanoidBone, node);
  return bones;
};
