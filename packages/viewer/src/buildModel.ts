import {
  AutoMovieHumanoidBone,
  IAutoMovieExpression,
  IAutoMovieModel,
  IAutoMoviePose,
  IAutoMovieTransform,
} from "@automovie/interface";
import * as THREE from "three";

import { buildGeometry, buildMaterial, defaultMaterial } from "./geometry";

/** Expression sink supplied by imported runtimes such as VRM managers. */
export interface IAutoMovieExpressionTarget {
  /** Set one normalized expression channel or preset to a weight in `[0, 1]`. */
  setExpressionValue: (name: string, weight: number) => void;
}

/** The deterministic state an {@link AutoMoviePlayer} just wrote this frame. */
export interface IAutoMovieViewerFrame {
  /** Absolute clip time, in seconds. */
  seconds: number;
  /** Non-negative time since the previous player update, in seconds. */
  deltaSeconds: number;
  /** Pose applied to the model after clamping and secondary motion. */
  pose: IAutoMoviePose;
  /** Expression sampled for the same frame, or `null`. */
  expression: IAutoMovieExpression | null;
}

/** A built model: its `three.js` root object and a lookup of its bones. */
export interface IAutoMovieModelObject {
  /** Root group; add this to a scene (or a node group) to display the model. */
  object: THREE.Group;
  /** Bones by humanoid slot, for posing. Empty for a non-rigged object. */
  bones: ReadonlyMap<AutoMovieHumanoidBone, THREE.Object3D>;
  /** Optional expression sinks: morph managers, VRM expression managers, etc. */
  expressionTargets?: readonly IAutoMovieExpressionTarget[];
  /** Optional imported-runtime flush after pose and expression are written. */
  afterAutoMovieFrame?: (frame: IAutoMovieViewerFrame) => void;
}

/** Apply a automovie TRS transform onto a `three.js` object. */
export const applyTransform = (
  obj: THREE.Object3D,
  t: IAutoMovieTransform,
): void => {
  obj.position.set(t.translation.x, t.translation.y, t.translation.z);
  obj.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
  obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
};

/**
 * Build a renderable `three.js` object from an {@link IAutoMovieModel}.
 *
 * Constructs the bone hierarchy, then attaches each part. A rigid part is
 * parented to its `attachedBone` and rides that bone. A mesh with skin data and
 * no rigid attachment becomes a `THREE.SkinnedMesh` bound to the skeleton. If
 * both signals are present, `attachedBone` wins: the part is treated as a rigid
 * prop and its skin payload is ignored by the viewer.
 *
 * The returned `bones` map is what {@link applyPose} drives.
 *
 * @author Samchon
 */
export const buildModel = (model: IAutoMovieModel): IAutoMovieModelObject => {
  const group = new THREE.Group();
  group.name = model.name ?? model.id;

  const bones = new Map<AutoMovieHumanoidBone, THREE.Bone>();
  if (model.skeleton !== null) {
    for (const b of model.skeleton.bones) {
      const bone = new THREE.Bone();
      bone.name = b.bone;
      // Rig rest SCALE is ignored — the engine's pinned convention (#1052):
      // `resolvePose` composes rotation and translation only, and
      // `motionToClip` matches it ("rest scale ignored on both sides").
      // Applying it here would render every descendant at the accumulated
      // scale product while ground contact, collision, and framing measured
      // the unscaled body. Scale stays first-class on scene NODES and object
      // motions (#1049) — this convention is about rig bones only.
      bone.position.set(
        b.rest.translation.x,
        b.rest.translation.y,
        b.rest.translation.z,
      );
      bone.quaternion.set(
        b.rest.rotation.x,
        b.rest.rotation.y,
        b.rest.rotation.z,
        b.rest.rotation.w,
      );
      bones.set(b.bone, bone);
    }
    for (const b of model.skeleton.bones) {
      const bone = bones.get(b.bone)!;
      const parent = b.parent !== null ? bones.get(b.parent) : undefined;
      (parent ?? group).add(bone);
    }
  }

  const materials = new Map(
    model.materials.map((m) => [m.id, buildMaterial(m)] as const),
  );
  for (const part of model.parts) {
    const geo = buildGeometry(part.geometry);
    const mat =
      part.material !== null
        ? (materials.get(part.material) ?? defaultMaterial())
        : defaultMaterial();
    const skin =
      part.attachedBone === null && part.geometry.type === "mesh"
        ? part.geometry.mesh.skin
        : null;
    const mesh =
      skin !== null
        ? new THREE.SkinnedMesh(geo, mat)
        : new THREE.Mesh(geo, mat);
    mesh.name = part.name ?? part.id;
    if (part.transform !== null) applyTransform(mesh, part.transform);

    if (mesh instanceof THREE.SkinnedMesh && skin !== null) {
      const jointBones = skin.joints.map((joint) => {
        const bone = bones.get(joint);
        if (bone === undefined)
          throw new Error(
            `part "${part.id}" skin references missing bone "${joint}"`,
          );
        return bone;
      });
      group.add(mesh);
      group.updateMatrixWorld(true);
      mesh.bind(new THREE.Skeleton(jointBones));
      mesh.normalizeSkinWeights();
    } else {
      const parentBone =
        part.attachedBone !== null ? bones.get(part.attachedBone) : undefined;
      (parentBone ?? group).add(mesh);
    }
  }

  return { object: group, bones };
};
