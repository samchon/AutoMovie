import {
  AutoMovieHumanoidBone,
  IAutoMovieExpression,
  IAutoMovieModel,
  IAutoMoviePose,
  IAutoMovieTransform,
} from "@automovie/interface";
import * as THREE from "three";

import {
  IAutoMovieTextureResolver,
  buildGeometry,
  buildMaterial,
  defaultMaterial,
} from "./geometry";

/**
 * Expression sink supplied by imported runtimes such as VRM managers.
 *
 * @author Samchon
 * @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-channel-ownership Accepts only the resolved expression channels owned by the sampled frame.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention Implements the runtime expression sink for those resolved channels.
 */
export interface IAutoMovieExpressionTarget {
  /**
   * Set one normalized expression channel or preset to a weight in `[0, 1]`.
   *
   * @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-channel-ownership Accepts one resolved expression channel and its normalized weight.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention Applies that channel at the runtime expression boundary.
   */
  setExpressionValue: (name: string, weight: number) => void;
}

/**
 * The deterministic state an {@link AutoMoviePlayer} just wrote this frame.
 *
 * @author Samchon
 * @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Carries the state sampled at one exact playback boundary.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Keeps time, pose, and expression on the same motion-clock sample.
 */
export interface IAutoMovieViewerFrame {
  /**
   * Absolute clip time, in seconds.
   *
   * @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Records the exact absolute playback boundary.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Expresses that boundary on the shared motion clock.
   */
  seconds: number;
  /**
   * Non-negative time since the previous player update, in seconds.
   *
   * @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Records the non-negative interval from the prior playback boundary.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Keeps that interval on the same motion-clock sample.
   */
  deltaSeconds: number;
  /**
   * Pose applied to the model after clamping and secondary motion.
   *
   * @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Carries the pose resolved for this exact playback boundary.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Keeps the pose on the frame's shared motion-clock sample.
   */
  pose: IAutoMoviePose;
  /**
   * Expression sampled for the same frame, or `null`.
   *
   * @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Carries the expression resolved for this exact playback boundary.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Keeps the expression on the frame's shared motion-clock sample.
   */
  expression: IAutoMovieExpression | null;
}

/**
 * A built model: its `three.js` root object and a lookup of its bones.
 *
 * @author Samchon
 * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-hierarchical-transforms Keeps this model surface in the compiled transform hierarchy.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Materializes the same hierarchy for render visibility and culling.
 */
export interface IAutoMovieModelObject {
  /**
   * Root group; add this to a scene (or a node group) to display the model.
   *
   * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-hierarchical-transforms Keeps this model root in the compiled transform hierarchy.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Materializes that hierarchy for render visibility and culling.
   */
  object: THREE.Group;
  /**
   * Bones by humanoid slot, for posing. Empty for a non-rigged object.
   *
   * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-hierarchical-transforms Preserves the compiled bone hierarchy for pose playback.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Materializes that hierarchy as runtime bone objects.
   */
  bones: ReadonlyMap<AutoMovieHumanoidBone, THREE.Object3D>;
  /**
   * Parts by {@link IAutoMovieModelPart.id}, for a caller that has to move one.
   *
   * A prop's articulation joint names the part that rides it, and the only way
   * to make that reference true on screen is to reparent that part under the
   * joint's own object. Found by id rather than by traversing for a name,
   * because a part's `name` is optional and a model may carry two parts sharing
   * one, so a name search would move whichever it reached first.
   *
   * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-hierarchical-transforms Keeps this model surface in the compiled transform hierarchy.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Materializes the same hierarchy for render visibility and culling.
   */
  parts: ReadonlyMap<string, THREE.Object3D>;
  /**
   * Optional expression sinks: morph managers, VRM expression managers, etc.
   *
   * @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-channel-ownership Exposes the expression sinks that own resolved expression channels.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention Materializes those channels at the runtime expression boundary.
   */
  expressionTargets?: readonly IAutoMovieExpressionTarget[];
  /**
   * Optional imported-runtime flush after pose and expression are written.
   *
   * @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Flushes imported runtime state only after the exact frame sample is written.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Keeps the imported runtime on the frame's shared motion-clock sample.
   */
  afterAutoMovieFrame?: (frame: IAutoMovieViewerFrame) => void;
}

/**
 * Apply a automovie TRS transform onto a `three.js` object.
 *
 * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-hierarchical-transforms Keeps this model surface in the compiled transform hierarchy.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Materializes the same hierarchy for render visibility and culling.
 */
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
 * prop and its skin payload is ignored by the viewer. An `attachedBone` the
 * skeleton does not carry throws, the same class as a skin referencing a
 * missing bone (#1106): a silently root-parented prop renders frozen at the
 * origin while everything else looks right.
 *
 * The returned `bones` map is what {@link applyPose} drives.
 *
 * `resolveTexture` is how a declared PBR finish gets its pixels, and it is the
 * host's to supply because this package performs no I/O: the caller decodes the
 * model's bindings first (an `AutoMovieTextureCache` primes them in one pass)
 * and hands over an {@link IAutoMovieTextureResolver} that answers
 * synchronously. Omitting it builds every material with its scalar coefficients
 * and no maps, which is exactly what a model declaring no texture renders and
 * what every pre-texture production still renders. The resolver must answer
 * with a texture object PER BINDING, because {@link buildMaterial} writes that
 * binding's color space, UV transform and sampler onto whatever it is given,
 * and two slots sharing one object would fight over one repeat.
 *
 * @author Samchon
 * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-hierarchical-transforms Keeps this model surface in the compiled transform hierarchy.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Materializes the same hierarchy for render visibility and culling.
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Keeps compiled model identity distinct from viewer-owned runtime objects.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the runtime ownership side of isolated scene lowering.
 */
export const buildModel = (
  model: IAutoMovieModel,
  resolveTexture?: IAutoMovieTextureResolver,
): IAutoMovieModelObject => {
  const group = new THREE.Group();
  group.name = model.name ?? model.id;

  const bones = new Map<AutoMovieHumanoidBone, THREE.Bone>();
  if (model.skeleton !== null) {
    for (const b of model.skeleton.bones) {
      const bone = new THREE.Bone();
      bone.name = b.bone;
      // Rig rest SCALE is ignored, the engine's pinned convention (#1052):
      // `resolvePose` composes rotation and translation only, and
      // `motionToClip` matches it ("rest scale ignored on both sides").
      // Applying it here would render every descendant at the accumulated
      // scale product while ground contact, collision, and framing measured
      // the unscaled body. Scale stays first-class on scene NODES and object
      // motions (#1049). This convention is about rig bones only.
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
    model.materials.map(
      (m) => [m.id, buildMaterial(m, resolveTexture)] as const,
    ),
  );
  const parts = new Map<string, THREE.Object3D>();
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
    parts.set(part.id, mesh);
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
    } else if (part.attachedBone !== null) {
      // An unknown attachedBone must throw like the skin path above (#1106):
      // the silent fallback parented a hand-held prop to the model root,
      // rendering it frozen at the origin while everything else looked right,
      // the silent-skip class #1051 removed from the viewer.
      const parentBone = bones.get(part.attachedBone);
      if (parentBone === undefined)
        throw new Error(
          `part "${part.id}" attachedBone references missing bone "${part.attachedBone}"`,
        );
      parentBone.add(mesh);
    } else {
      group.add(mesh);
    }
  }

  return { object: group, bones, parts };
};
