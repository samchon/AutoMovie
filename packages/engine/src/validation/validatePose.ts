import {
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieValidation,
} from "@automovie/interface";

import { getConstraint } from "../rom/humanoidRom";
import { validateJointRom } from "../rom/validateJointRom";
import { ViolationCollector } from "./violation";

/**
 * Validate a {@link IAutoMoviePose} against its skeleton.
 *
 * Runs Tier-2 anatomical ROM checks (the differentiator) plus structural
 * sanity: each articulated bone must exist in the skeleton and appear at most
 * once. The effective ROM per bone is the skeleton's per-bone override if
 * present, otherwise the engine's default humanoid table.
 *
 * Pushes into a shared {@link ViolationCollector} when given one (so a motion
 * can aggregate per-keyframe violations under a clip-level path); otherwise
 * collects locally. Returns the collector so callers can chain.
 *
 * @author Samchon
 */
export const validatePose = (props: {
  pose: IAutoMoviePose;
  skeleton: IAutoMovieSkeleton;
  path?: string;
  collector?: ViolationCollector;
}): ViolationCollector => {
  const path = props.path ?? "$input";
  const collector = props.collector ?? new ViolationCollector();
  const byBone = new Map(props.skeleton.bones.map((b) => [b.bone, b]));
  const seen = new Set<string>();

  if (props.pose.skeleton !== props.skeleton.id)
    collector.push(
      "type",
      `${path}.skeleton`,
      `pose skeleton "${props.pose.skeleton}" does not match target skeleton "${props.skeleton.id}"`,
      props.pose.skeleton,
    );
  if (props.pose.root !== null)
    validateRootTransform(props.pose.root, `${path}.root`, collector);

  props.pose.joints.forEach((joint, i) => {
    const jointPath = `${path}.joints[${i}]`;
    const bone = byBone.get(joint.bone);
    if (bone === undefined) {
      collector.push(
        "type",
        `${jointPath}.bone`,
        `bone "${joint.bone}" is not present in the target skeleton`,
        joint.bone,
      );
      return;
    }
    if (seen.has(joint.bone))
      collector.push(
        "type",
        `${jointPath}.bone`,
        `bone "${joint.bone}" is articulated more than once in this pose`,
        joint.bone,
      );
    seen.add(joint.bone);

    const constraint = getConstraint(joint.bone, bone.constraint);
    if (constraint !== null)
      validateJointRom({ joint, constraint, path: jointPath, collector });
  });

  return collector;
};

const validateRootTransform = (
  root: IAutoMovieTransform,
  path: string,
  collector: ViolationCollector,
): void => {
  const finiteFields: ReadonlyArray<readonly [string, number]> = [
    [`${path}.translation.x`, root.translation.x],
    [`${path}.translation.y`, root.translation.y],
    [`${path}.translation.z`, root.translation.z],
    [`${path}.rotation.x`, root.rotation.x],
    [`${path}.rotation.y`, root.rotation.y],
    [`${path}.rotation.z`, root.rotation.z],
    [`${path}.rotation.w`, root.rotation.w],
    [`${path}.scale.x`, root.scale.x],
    [`${path}.scale.y`, root.scale.y],
    [`${path}.scale.z`, root.scale.z],
  ];
  for (const [fieldPath, value] of finiteFields)
    if (!Number.isFinite(value))
      collector.push(
        "range",
        fieldPath,
        `root transform component must be finite, but was ${value}`,
        value,
      );

  const scaleFields: ReadonlyArray<readonly [string, number]> = [
    [`${path}.scale.x`, root.scale.x],
    [`${path}.scale.y`, root.scale.y],
    [`${path}.scale.z`, root.scale.z],
  ];
  for (const [fieldPath, value] of scaleFields)
    if (value <= 0)
      collector.push(
        "range",
        fieldPath,
        `root scale component must be > 0, but was ${value}`,
        value,
      );
};

/** Convenience wrapper returning a finished {@link IAutoMovieValidation}. */
export const validatePoseResult = (
  pose: IAutoMoviePose,
  skeleton: IAutoMovieSkeleton,
): IAutoMovieValidation => validatePose({ pose, skeleton }).toValidation();
