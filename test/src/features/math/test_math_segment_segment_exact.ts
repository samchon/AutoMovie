import {
  closestPointsBetweenSegments,
  segmentSegmentDistance,
} from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const v = (x: number, y: number, z: number): IAutoMovieVector3 => ({ x, y, z });

/**
 * The exact clamped segment-segment solver (Ericson §5.1.9) replaces the old
 * four-endpoint approximation, which reported the true distance only when a
 * closest point happened to be an endpoint. The headline gain is the
 * interior-to-interior crossing: two segments passing through each other as an
 * X measured a full segment-width apart under the approximation while the real
 * distance is zero — the commonest self-intersection (a limb sweeping through a
 * torso), silently missed by a check that forces it as an error.
 *
 * Every hand-computed case below also pins one branch of the solver so the
 * clamp/degeneracy paths stay covered:
 *
 * 1. Both segments collapsed to points (`A ≤ ε && E ≤ ε`).
 * 2. First segment a point, projected onto the second (`A ≤ ε`).
 * 3. Second segment a point, projected onto the first (`E ≤ ε`).
 * 4. Interior X-crossing (non-parallel, `t` in range) → distance 0, both closest
 *    points at the origin — the case the approximation missed.
 * 5. Parallel offset (`denom = 0`) → `s` pinned to 0, exact gap.
 * 6. Colinear separated → `t < 0` clamped, `s` re-solved to 1 (clamp01 upper).
 * 7. Skew far end → `t > 1` clamped to the near end.
 * 8. Reversed colinear → `t > 1` with `s` re-solved below 0 (clamp01 lower).
 */
export const test_math_segment_segment_exact = (): void => {
  // 1. both points: the only pair is the two points themselves.
  {
    const r = closestPointsBetweenSegments(
      v(0, 0, 0),
      v(0, 0, 0),
      v(1, 0, 0),
      v(1, 0, 0),
    );
    TestValidator.predicate("both-points distance", nclose(r.distance, 1));
    TestValidator.predicate("both-points A", vclose(r.pointA, v(0, 0, 0)));
    TestValidator.predicate("both-points B", vclose(r.pointB, v(1, 0, 0)));
  }

  // 2. first segment a point (0,0,0), second [(2,0,0)-(2,0,2)]: closest on the
  // second is its near end (2,0,0), distance 2.
  {
    const r = closestPointsBetweenSegments(
      v(0, 0, 0),
      v(0, 0, 0),
      v(2, 0, 0),
      v(2, 0, 2),
    );
    TestValidator.predicate("seg1-point distance", nclose(r.distance, 2));
    TestValidator.predicate("seg1-point A", vclose(r.pointA, v(0, 0, 0)));
    TestValidator.predicate("seg1-point B", vclose(r.pointB, v(2, 0, 0)));
  }

  // 3. second segment a point (2,0,0), first [(0,0,0)-(0,0,2)]: closest on the
  // first is its near end (0,0,0), distance 2.
  {
    const r = closestPointsBetweenSegments(
      v(0, 0, 0),
      v(0, 0, 2),
      v(2, 0, 0),
      v(2, 0, 0),
    );
    TestValidator.predicate("seg2-point distance", nclose(r.distance, 2));
    TestValidator.predicate("seg2-point A", vclose(r.pointA, v(0, 0, 0)));
    TestValidator.predicate("seg2-point B", vclose(r.pointB, v(2, 0, 0)));
  }

  // 4. interior X-crossing: x-axis [(-1,0,0)-(1,0,0)] and z-axis
  // [(0,0,-1)-(0,0,1)] pierce at the origin. s = t = 0.5, both points (0,0,0),
  // distance 0 — the approximation returned 1 (every endpoint a unit away).
  {
    const r = closestPointsBetweenSegments(
      v(-1, 0, 0),
      v(1, 0, 0),
      v(0, 0, -1),
      v(0, 0, 1),
    );
    TestValidator.predicate("x-cross distance zero", nclose(r.distance, 0));
    TestValidator.predicate(
      "x-cross A at origin",
      vclose(r.pointA, v(0, 0, 0)),
    );
    TestValidator.predicate(
      "x-cross B at origin",
      vclose(r.pointB, v(0, 0, 0)),
    );
    TestValidator.predicate(
      "x-cross distance function agrees",
      nclose(
        segmentSegmentDistance(
          v(-1, 0, 0),
          v(1, 0, 0),
          v(0, 0, -1),
          v(0, 0, 1),
        ),
        0,
      ),
    );
  }

  // 5. parallel offset: two unit x-segments 1 apart in y. denom = 0 → s = 0,
  // t = 0, distance 1.
  {
    const r = closestPointsBetweenSegments(
      v(0, 0, 0),
      v(1, 0, 0),
      v(0, 1, 0),
      v(1, 1, 0),
    );
    TestValidator.predicate("parallel distance", nclose(r.distance, 1));
    TestValidator.predicate("parallel A", vclose(r.pointA, v(0, 0, 0)));
    TestValidator.predicate("parallel B", vclose(r.pointB, v(0, 1, 0)));
  }

  // 6. colinear separated [(0,0,0)-(1,0,0)] and [(2,0,0)-(3,0,0)]: t = -2
  // clamps to 0, s re-solves to 1 (clamp01 upper bound). Facing ends, gap 1.
  {
    const r = closestPointsBetweenSegments(
      v(0, 0, 0),
      v(1, 0, 0),
      v(2, 0, 0),
      v(3, 0, 0),
    );
    TestValidator.predicate("colinear distance", nclose(r.distance, 1));
    TestValidator.predicate("colinear A", vclose(r.pointA, v(1, 0, 0)));
    TestValidator.predicate("colinear B", vclose(r.pointB, v(2, 0, 0)));
  }

  // 7. skew far end: x-segment [(0,0,0)-(1,0,0)] and z-segment
  // [(0.5,1,-2)-(0.5,1,-1)] whose infinite line is closest at z=0, past its far
  // end. t = 2 clamps to 1, s = 0.5. Points (0.5,0,0)-(0.5,1,-1), distance √2.
  {
    const r = closestPointsBetweenSegments(
      v(0, 0, 0),
      v(1, 0, 0),
      v(0.5, 1, -2),
      v(0.5, 1, -1),
    );
    TestValidator.predicate("skew distance", nclose(r.distance, Math.SQRT2));
    TestValidator.predicate("skew A", vclose(r.pointA, v(0.5, 0, 0)));
    TestValidator.predicate("skew B", vclose(r.pointB, v(0.5, 1, -1)));
  }

  // 8. reversed colinear [(2,0,0)-(3,0,0)] and [(0,0,0)-(1,0,0)]: t = 2 clamps
  // to 1, s = (B−C)/A = -1 clamps to 0 (clamp01 lower bound). Facing ends,
  // gap 1.
  {
    const r = closestPointsBetweenSegments(
      v(2, 0, 0),
      v(3, 0, 0),
      v(0, 0, 0),
      v(1, 0, 0),
    );
    TestValidator.predicate("reversed distance", nclose(r.distance, 1));
    TestValidator.predicate("reversed A", vclose(r.pointA, v(2, 0, 0)));
    TestValidator.predicate("reversed B", vclose(r.pointB, v(1, 0, 0)));
  }
};
