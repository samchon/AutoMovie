import {
  AutoMovieHumanoidBone,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { IAutoMovieSkeletonTopology, reachableBoneNames } from "../kinematics";

/**
 * The bones a skeleton's forward kinematics can actually reach, a thin alias
 * over {@link reachableBoneNames}, kept as the name a physics validator reads.
 * It is the exact set {@link "../kinematics".resolvePose}'s walk visits, so it
 * can never disagree with which bones a sampled pose resolves.
 *
 * A validator gates a bone against this set BEFORE reading its resolved world
 * position: a bone can be **declared** in `skeleton.bones` yet be **detached**
 * (its parent chain never reaches a null-parent root), in which case the
 * declared-set membership check passes but `resolvePose` omits it, and reading
 * the missing lookup would crash. Gating on reachability reports the malformed
 * rig as a violation instead.
 *
 * @evidence requirements/actors/validation.md#actor-input-binding-validation `fkReachableBones` identifies the rig bones whose parent chains actually participate in forward-kinematics binding.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `fkReachableBones` reuses the resolver's traversal set so detached bone references cannot masquerade as valid hierarchy members.
 * @author Samchon
 */
export const fkReachableBones = (
  skeleton: IAutoMovieSkeleton,
  topology?: IAutoMovieSkeletonTopology,
): Set<AutoMovieHumanoidBone> => reachableBoneNames(skeleton, topology);
