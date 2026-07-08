import {
  AutoMovieHumanoidBone,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { resolvePose } from "../kinematics";

/**
 * The bones a skeleton's forward kinematics can actually reach — every bone the
 * root-anchored walk in {@link resolvePose} visits. Reachability follows the
 * skeleton's parent links, not any joint angles, so it is pose-independent and
 * this resolves a single empty pose to derive it (the same walk every sampled
 * pose would take, so it can never disagree with what a per-sample
 * {@link resolvePose} returns).
 *
 * This is the set a physics validator must gate a bone against BEFORE reading
 * its resolved world position. A bone can be **declared** in `skeleton.bones`
 * yet be **detached** — its parent chain never reaches a null-parent root — in
 * which case the declared-set membership check passes but `resolvePose` never
 * returns it. Asserting the lookup non-null then throws instead of reporting
 * the malformed rig as a violation, breaking the validator's totality.
 *
 * @author Samchon
 */
export const fkReachableBones = (
  skeleton: IAutoMovieSkeleton,
): Set<AutoMovieHumanoidBone> =>
  new Set(
    resolvePose(
      { skeleton: skeleton.id, root: null, joints: [] },
      skeleton,
    ).map((bone) => bone.bone),
  );
