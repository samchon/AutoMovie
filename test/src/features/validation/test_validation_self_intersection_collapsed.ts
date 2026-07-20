import { validateSelfIntersection } from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeMotion } from "../internal/fixtures";
import { hasWarning } from "../internal/predicates";

const restAt = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * A skeleton where two DISTINCT bones (`hips`, `spine`) resolve to the SAME
 * world point: `spine` is parented to `hips` with a zero rest offset, so its FK
 * position coincides with `hips` at the origin. A capsule declared over that
 * pair has a centerline that collapses to a single point: the zero-length
 * segment the shared distance oracle must survive. The `leftUpperArm →
 * leftLowerArm` chain lays a second capsule straight through the origin.
 */
const skeleton: IAutoMovieSkeleton = {
  id: "collapsed",
  bones: [
    { bone: "hips", parent: null, rest: restAt(0, 0, 0), constraint: null },
    { bone: "spine", parent: "hips", rest: restAt(0, 0, 0), constraint: null },
    {
      bone: "leftUpperArm",
      parent: "hips",
      rest: restAt(-1, 0, 0),
      constraint: null,
    },
    {
      bone: "leftLowerArm",
      parent: "leftUpperArm",
      rest: restAt(2, 0, 0),
      constraint: null,
    },
  ],
};

const pose: IAutoMoviePose = {
  skeleton: skeleton.id,
  root: restAt(0, 0, 0),
  joints: [],
};

const key = (time: number): IAutoMovieKeyframe => ({
  time,
  pose,
  expression: null,
  easing: "linear",
  bezier: null,
});

/**
 * The zero-length-centerline regression: a capsule whose two endpoint bones are
 * distinct in the skeleton but coincident in world space collapses to a point.
 * Its centerline distance to a second capsule passing through that point is a
 * true `0`, well inside the summed radii: a real self-intersection.
 *
 * Before the span guard in `closestPointOnSegment`, the four-candidate distance
 * of `segmentSegmentDistance` produced `NaN` for the two collapsed-segment
 * candidates, `Math.min(0, 0, NaN, NaN)` was `NaN`, and `NaN < minimum` was
 * `false`: the overlap slipped through and the frame validated as clean. This
 * test pins that the detection now fires (as a D015 plausibility warning; the
 * span guard is what makes the distance finite so the overlap is seen at all).
 */
export const test_validation_self_intersection_collapsed = (): void => {
  const result = validateSelfIntersection({
    motion: makeMotion([key(0), key(1)], 1),
    skeleton,
    pairs: [
      {
        first: { from: "hips", to: "spine", radius: 0.3 },
        second: { from: "leftUpperArm", to: "leftLowerArm", radius: 0.15 },
      },
    ],
    sampleRate: 1,
  });

  TestValidator.predicate(
    "collapsed-centerline overlap no longer slips through as NaN",
    result.success === true &&
      hasWarning(result, "physics", "$input.pairs[0].samples[0].distance"),
  );
};
