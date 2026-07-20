import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMoviePose,
} from "@automovie/interface";

/**
 * Merge several poses, each driving a (usually disjoint) set of bones, e.g. one
 * per body region, into a single pose. Joints **union by bone**: a later pose's
 * joint overrides an earlier one for the same bone, so an explicit override
 * beats a base and disjoint regions simply combine. The **root** is the last
 * non-null one (the travelling region carries it); the skeleton is the first
 * pose's. The input must be non-empty.
 *
 * This is the per-frame composition behind layering: sample each region's clip
 * at a time, merge the poses, and the actor walks (legs) while waving (arms)
 * while looking (head): no bone claimed twice.
 *
 * @author Samchon
 */
export const mergePoses = (poses: IAutoMoviePose[]): IAutoMoviePose => {
  if (poses.length === 0) throw new Error("merge poses must not be empty");

  const joints = new Map<AutoMovieHumanoidBone, IAutoMovieJointPose>();
  let root = poses[0]!.root;
  for (const pose of poses) {
    if (pose.root !== null) root = pose.root;
    for (const joint of pose.joints) joints.set(joint.bone, joint);
  }
  return {
    skeleton: poses[0]!.skeleton,
    root,
    joints: [...joints.values()],
  };
};
