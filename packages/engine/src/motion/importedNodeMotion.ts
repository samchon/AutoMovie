import type {
  AutoMovieHumanoidBone,
  AutoMovieInterpolation,
  IAutoMovieClip,
  IAutoMovieMotion,
  IAutoMovieQuaternion,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { decomposeJointRotation } from "../kinematics/decomposeJointRotation";
import { HUMANOID_JOINT_AXES } from "../kinematics/humanoidJointAxes";
import type { IAutoMovieJointAxes } from "../kinematics/jointToQuaternion";
import { Quaternion } from "../math/Quaternion";
import { channelKey } from "../resolve/channel";
import { sampleClip } from "../resolve/sampleClip";
import {
  HUMANOID_REST_FRAME,
  type IAutoMovieRestFrame,
} from "../rom/restFrame";
import { compareCodeUnits } from "../text/compareCodeUnits";

/**
 * Explicit imported-node to normalized source-bone correspondence.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Uses only an author-selected semantic mapping.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Records the selected mapping as an explicit adoption decision instead of inferring it from node names.
 *
 * @author Samchon
 */
export interface IAutoMovieImportedNodeBoneMapping {
  /**
   * Exact imported node identity.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Identifies the source channel owner.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Preserves the selected source element.
   */
  node: string;
  /**
   * Explicit normalized source-rig role.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Prevents name-similarity mapping.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Supplies the author-selected semantic correspondence consumed by retargeting.
   */
  bone: AutoMovieHumanoidBone;
}

/**
 * Complete deterministic lowering input for one imported node-track clip.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Implements the explicitly selected retarget conversion path.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Defines the source-to-native conversion boundary.
 *
 * @author Samchon
 */
export interface IAutoMovieImportedNodeMotionProps {
  /**
   * Selected imported node-track take.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Consumes the exact selected take, duration, clock, channels, and loop basis.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Retains the take's declared source basis in the adopted motion.
   */
  clip: IAutoMovieClip;
  /**
   * Declared normalized skeleton describing source clinical semantics.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Fixes the source rig and rest basis.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Preserves the imported skeleton and rest basis as part of the chosen source.
   */
  sourceSkeleton: IAutoMovieSkeleton;
  /**
   * Explicit one-to-one node-to-bone mapping.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Refuses an unresolved or ambiguous semantic map.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Makes the accepted source-to-bone mapping part of the explicit adoption input.
   */
  mapping: readonly IAutoMovieImportedNodeBoneMapping[];
  /**
   * Stable id for the native clinical motion.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Lets the caller bind the converted result to its receipt.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Avoids an engine-invented output identity.
   */
  motionId: string;
  /**
   * Optional source-rig clinical axes, falling back to the canonical humanoid
   * table.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Makes the source rotation basis explicit.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Preserves the selected source joint basis through adoption.
   */
  sourceJointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /**
   * Optional source clinical rest frames, falling back to the canonical
   * humanoid table.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Preserves the declared source rest basis used to interpret node rotations.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Carries the selected clinical rest basis into deterministic lowering.
   */
  sourceRestFrames?: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
  >;
}

/**
 * Lower an imported node-track clip into clinical pose keyframes.
 *
 * The output samples the sorted union of authored source key times. Every
 * mapped node must carry exactly one rotation channel, every other source
 * channel must also be explicitly mapped, and all retained tracks must share
 * one representable interpolation law. A mapped hips translation becomes
 * `pose.root`; other translations, scale, weights, cubic-spline tracks, corrupt
 * quaternions, and inferred mappings are refused rather than approximated.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-input-refusal Refuses incomplete, ambiguous, corrupt, or unrepresentable imported motion.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Validates the selected source basis and channels before producing an adopted motion.
 * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-hard-failure Refuses the selected external clip without fabricating fallback motion when its identity, mapping, clock, or channel payload is invalid.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-external-hard-refusal Returns the exact unsupported source boundary as an error instead of substituting a placeholder clip or inferred mapping.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Uses the canonical sampler at every authored key time.
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Applies only the explicit source mapping.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Produces clinical source motion for the declared retarget mapping without silent fallback.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Refuses source clips whose facts cannot survive clinical lowering.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation Preserves one representable authored interpolation law.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Samples the sorted union of authored key times.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-loop-trim Carries the source clip loop declaration without inventing a trim.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Refuses missing mapped rotations instead of inventing sparse defaults.
 * @evidence requirements/motion/timing-and-semantic-events.md#motion-timing-refusal Refuses non-finite or non-increasing source key times instead of inferring a replacement clock.
 * @evidence requirements/motion/validation-and-determinism.md#motion-numeric-stability Rejects non-finite track values and invalid quaternions before canonical sampling.
 * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-native-reinterpretation Lowers explicitly mapped imported node rotations into project-native clinical joint channels without claiming the source clip was already native motion.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies Preserves each selected source node identity in the explicit one-to-one bone mapping used by the lowering pass.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-time-units Retains the source duration, authored key seconds, and loop declaration while rejecting a non-finite or non-increasing clip clock.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-collision-ambiguity Refuses repeated source nodes, repeated target bones, missing nodes, and conflicting root-translation owners instead of selecting one by traversal order.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-structure-semantics Validates clip structure, explicit mapping, skeleton membership, channel shape, finite values, and clinical interpretation before returning native motion.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Keeps authored source seconds as the lowering clock.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Validates and samples the same immutable clip deterministically.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-native-reinterpretation-boundary Records the explicit source-node to clinical-bone reinterpretation in the lowering input rather than inferring native semantics.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-element-dependency-identity Uses stable imported node identities as the source side of every derived clinical channel.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-time-sample-mapping Carries the selected clip's seconds, duration, key boundaries, and loop mode into the native motion clock without a cross-timebase guess.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-identity-ambiguity-refusal Rejects ambiguous element and channel ownership before any source value is reinterpreted.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-hard-refusal-predicate Produces no fallback motion when the explicit identity, mapping, clock, or representable channel boundary fails.
 * @evidence specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-layered-validation Applies structural clip and skeleton checks before the semantic node-to-bone and clinical-value lowering checks.
 *
 * @author Samchon
 */
export const importedNodeClipToAutoMovieMotion = (
  props: IAutoMovieImportedNodeMotionProps,
): IAutoMovieMotion => {
  if (props.motionId.trim().length === 0)
    throw new Error("imported motion id must not be blank");
  if (props.sourceSkeleton.id.trim().length === 0)
    throw new Error("imported motion source skeleton id must not be blank");
  if (props.mapping.length === 0)
    throw new Error(
      "imported motion requires an explicit node-to-bone mapping",
    );

  const skeletonBones = new Set<AutoMovieHumanoidBone>();
  const sourceBones = new Map<
    AutoMovieHumanoidBone,
    IAutoMovieSkeleton["bones"][number]
  >();
  for (const bone of props.sourceSkeleton.bones) {
    if (skeletonBones.has(bone.bone))
      throw new Error(
        `imported motion source skeleton repeats bone "${bone.bone}"`,
      );
    skeletonBones.add(bone.bone);
    sourceBones.set(bone.bone, bone);
    for (const axis of ["x", "y", "z"] as const)
      if (!Number.isFinite(bone.rest.translation[axis]))
        throw new Error(
          `imported motion source bone "${bone.bone}" rest translation.${axis} must be finite`,
        );
    finiteUnitQuaternion(
      [
        bone.rest.rotation.x,
        bone.rest.rotation.y,
        bone.rest.rotation.z,
        bone.rest.rotation.w,
      ],
      `${bone.bone} rest`,
      0,
    );
  }
  const nodeToBone = new Map<string, AutoMovieHumanoidBone>();
  const mappedBones = new Set<AutoMovieHumanoidBone>();
  for (const entry of props.mapping) {
    if (entry.node.trim().length === 0)
      throw new Error("imported motion mapping node must not be blank");
    if (nodeToBone.has(entry.node))
      throw new Error(`imported motion mapping repeats node "${entry.node}"`);
    if (mappedBones.has(entry.bone))
      throw new Error(`imported motion mapping repeats bone "${entry.bone}"`);
    if (!skeletonBones.has(entry.bone))
      throw new Error(
        `imported motion mapping bone "${entry.bone}" is absent from source skeleton "${props.sourceSkeleton.id}"`,
      );
    nodeToBone.set(entry.node, entry.bone);
    mappedBones.add(entry.bone);
  }

  const channelTracks = new Map<string, (typeof props.clip.tracks)[number]>();
  let interpolation: Exclude<AutoMovieInterpolation, "cubicspline"> | null =
    null;
  for (const track of props.clip.tracks) {
    if (track.channel.kind !== "node")
      throw new Error("imported humanoid motion supports only node channels");
    const key = channelKey(track.channel);
    if (channelTracks.has(key))
      throw new Error(`imported motion repeats channel "${key}"`);
    channelTracks.set(key, track);
    const bone = nodeToBone.get(track.channel.node);
    if (bone === undefined)
      throw new Error(
        `imported motion node "${track.channel.node}" has no explicit bone mapping`,
      );
    if (track.channel.path === "scale" || track.channel.path === "weights")
      throw new Error(
        `imported motion ${track.channel.path} channel "${key}" cannot be represented by a clinical pose`,
      );
    if (track.channel.path === "translation" && bone !== "hips")
      throw new Error(
        `imported motion translation channel "${key}" must map to hips`,
      );
    if (track.interpolation === "cubicspline")
      throw new Error(
        `imported motion channel "${key}" uses cubic-spline interpolation that a clinical pose keyframe cannot preserve`,
      );
    if (interpolation !== null && track.interpolation !== interpolation)
      throw new Error(
        "imported motion channels use different interpolation laws that one clinical keyframe cannot preserve",
      );
    interpolation = track.interpolation;
  }
  if (interpolation === null)
    throw new Error("imported motion clip has no mapped channels");

  // Bone identities are already unique, so they alone define the stable order.
  const orderedMapping = [...props.mapping].sort((left, right) =>
    compareCodeUnits(left.bone, right.bone),
  );
  for (const entry of orderedMapping) {
    const rotationKey = channelKey({
      kind: "node",
      node: entry.node,
      path: "rotation",
    });
    if (!channelTracks.has(rotationKey))
      throw new Error(
        `imported motion mapped node "${entry.node}" has no rotation channel`,
      );
  }

  const keyTimes = [
    ...new Set(props.clip.tracks.flatMap((track) => track.times)),
  ].sort((left, right) => left - right);
  if (keyTimes.length < 2)
    throw new Error(
      "imported motion needs at least two distinct authored key times",
    );

  const hips = orderedMapping.find((entry) => entry.bone === "hips");
  const hipsTranslationKey =
    hips === undefined
      ? null
      : channelKey({ kind: "node", node: hips.node, path: "translation" });
  const hasRootTranslation =
    hipsTranslationKey !== null && channelTracks.has(hipsTranslationKey);

  return {
    id: props.motionId,
    skeleton: props.sourceSkeleton.id,
    duration: props.clip.duration,
    loop: props.clip.loop,
    keyframes: keyTimes.map((time) => {
      const sampled = sampleClip(props.clip, time);
      return {
        time,
        pose: {
          skeleton: props.sourceSkeleton.id,
          root: hasRootTranslation
            ? rootTransform(
                sampled.get(hipsTranslationKey!)!.value,
                sourceBones.get("hips")!.rest.translation,
              )
            : null,
          joints: orderedMapping.map((entry) => {
            const value = sampled.get(
              channelKey({
                kind: "node",
                node: entry.node,
                path: "rotation",
              }),
            )!.value;
            const quaternion = finiteUnitQuaternion(value, entry.node, time);
            const rest = sourceBones.get(entry.bone)!.rest.rotation;
            const relative = Quaternion.multiply(
              Quaternion.inverse(rest),
              quaternion,
            );
            const angles = decomposeJointRotation(
              relative,
              props.sourceJointAxes?.[entry.bone] ??
                HUMANOID_JOINT_AXES[entry.bone],
              props.sourceRestFrames?.[entry.bone] ??
                HUMANOID_REST_FRAME[entry.bone],
            );
            return { bone: entry.bone, ...angles };
          }),
        },
        expression: null,
        easing: interpolation,
        bezier: null,
      };
    }),
    gaitCycle: null,
  };
};

const rootTransform = (
  value: readonly number[],
  rest: { x: number; y: number; z: number },
) => ({
  translation: {
    x: value[0]! - rest.x,
    y: value[1]! - rest.y,
    z: value[2]! - rest.z,
  },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const finiteUnitQuaternion = (
  value: readonly number[],
  node: string,
  time: number,
): IAutoMovieQuaternion => {
  if (value.some((component) => !Number.isFinite(component)))
    throw new Error(
      `imported motion node "${node}" quaternion at ${time} must contain only finite components`,
    );
  const quaternion = {
    x: value[0]!,
    y: value[1]!,
    z: value[2]!,
    w: value[3]!,
  };
  const squaredLength =
    quaternion.x * quaternion.x +
    quaternion.y * quaternion.y +
    quaternion.z * quaternion.z +
    quaternion.w * quaternion.w;
  if (Math.abs(squaredLength - 1) > 1e-6)
    throw new Error(
      `imported motion node "${node}" quaternion at ${time} must be unit length`,
    );
  return quaternion;
};
