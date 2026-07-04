import {
  IAutoMoviePose,
  IAutoMovieSkeleton,
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

/** Convenience wrapper returning a finished {@link IAutoMovieValidation}. */
export const validatePoseResult = (
  pose: IAutoMoviePose,
  skeleton: IAutoMovieSkeleton,
): IAutoMovieValidation => validatePose({ pose, skeleton }).toValidation();
