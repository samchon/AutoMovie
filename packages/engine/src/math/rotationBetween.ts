import { IAutoMovieQuaternion, IAutoMovieVector3 } from "@automovie/interface";

import { Quaternion } from "./Quaternion";
import { Vector3 } from "./Vector3";

/**
 * Exact shortest-arc rotation from vector `a` to vector `b`, `atan2`-based
 * (**no near-parallel identity deadzone**), the single shortest-arc primitive
 * the whole engine shares. Both the iterative/world-driver IK path
 * ({@link "../resolve/worldShared".rotationBetween re-export}) and the analytic
 * two-bone path (`kinematics/aimRotation`) route through this one definition,
 * so the two IK families can never disagree on the same geometric operation.
 *
 * The predecessor (`quatFromTo`) snapped `cos > 0.999999` to the identity,
 * which put a ~1.9e-3 m convergence floor under the iterative IK solvers and
 * made the aim/reach path ignore its last ~0.08°. Sub-0.1° corrections are
 * exactly the moves a late solver sweep, a foot plant, or a slow camera track
 * is made of. Here every angle down to numerical zero produces its exact
 * rotation (#643).
 *
 * `atan2(sin, cos)` recovers the angle regardless of `|a|`/`|b|` (the shared
 * magnitude cancels), and the axis is normalized inside `fromAxisAngle`, so the
 * result is correct for any non-zero inputs; callers that also need
 * finite-input validation normalize first (see `aimRotation`). A degenerate
 * input (zero vector, exact parallel) degrades to the identity; exact
 * antiparallel takes a deterministic 180° flip about a perpendicular (the
 * `|a.x| < 0.9` axis split).
 *
 * @author Samchon
 */
export const rotationBetween = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  const cross = Vector3.cross(a, b);
  const sin = Vector3.length(cross);
  const cos = Vector3.dot(a, b);
  if (sin < 1e-12) {
    if (cos >= 0) return Quaternion.identity();
    const perp =
      Math.abs(a.x) < 0.9
        ? Vector3.cross(a, { x: 1, y: 0, z: 0 })
        : Vector3.cross(a, { x: 0, y: 1, z: 0 });
    return Quaternion.fromAxisAngle(perp, 180);
  }
  return Quaternion.fromAxisAngle(
    cross,
    (Math.atan2(sin, cos) * 180) / Math.PI,
  );
};
