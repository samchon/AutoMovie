import { validateSpace } from "@automovie/engine";
import { IAutoMovieSpace, IAutoMovieSurface } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const v = (x: number, z: number, y = 0) => ({ x, y, z });

const floor: IAutoMovieSurface = {
  id: "floor",
  kind: "floor",
  polygon: [v(0, 0), v(4, 0), v(4, 4), v(0, 4)],
  anchor: { x: 0, y: 0, z: 0 },
  rampTo: null,
};
const ramp: IAutoMovieSurface = {
  id: "ramp",
  kind: "ramp",
  polygon: [v(4, 0), v(8, 0), v(8, 4), v(4, 4)],
  anchor: { x: 4, y: 0, z: 0 },
  rampTo: { x: 8, y: 2, z: 0 },
};
const valid: IAutoMovieSpace = {
  id: "set",
  surfaces: [floor, ramp],
  walkable: ["floor", "ramp"],
};

const withSurface = (surface: Partial<IAutoMovieSurface>): IAutoMovieSpace => ({
  ...valid,
  surfaces: [floor, { ...ramp, ...surface }],
});

/**
 * A malformed space is broken input, not an artistic choice, so `validateSpace`
 * rejects it with error-severity violations the correction round can act on —
 * before any height query computes over garbage.
 *
 * Scenarios:
 *
 * 1. A well-formed flat + ramp space validates.
 * 2. An empty space id / surface id is a `type` violation.
 * 3. A duplicated surface id is a `type` violation on the duplicate.
 * 4. An unknown surface kind (runtime junk past the closed union) is rejected.
 * 5. A footprint of fewer than three points encloses no area.
 * 6. Collinear footprint points enclose no area (the hull collapses). 6b. A
 *    concave footprint (an L-shape, whose inner corner sits inside its convex
 *    hull) is rejected — the ground query would fill the notch. 6c. A convex
 *    footprint with a collinear point ON an edge is allowed (the vertex stays
 *    on the hull boundary; only strictly-interior vertices fail).
 * 7. A non-finite footprint plan coordinate is a `range` violation (`y` is
 *    documented-ignored and deliberately not checked).
 * 8. A non-finite height anchor is a `range` violation.
 * 9. A ramp whose `rampTo` sits at the anchor's XZ has a degenerate axis.
 * 10. A non-finite `rampTo` is caught by the anchor check (and safely skips the
 *     degeneracy math).
 * 11. A walkable id that resolves to no surface — or is duplicated — is a `type`
 *     violation.
 */
export const test_validation_space = (): void => {
  TestValidator.equals(
    "valid space passes",
    validateSpace({ space: valid }).success,
    true,
  );

  TestValidator.predicate(
    "empty space id",
    hasViolation(
      validateSpace({ space: { ...valid, id: " " } }),
      "type",
      "$input.id",
    ),
  );
  TestValidator.predicate(
    "empty surface id",
    hasViolation(
      validateSpace({ space: withSurface({ id: "" }) }),
      "type",
      ".id",
    ),
  );
  TestValidator.predicate(
    "duplicate surface id",
    hasViolation(
      validateSpace({ space: withSurface({ id: "floor" }) }),
      "type",
      "surfaces[1].id",
    ),
  );
  TestValidator.predicate(
    "unknown surface kind",
    hasViolation(
      validateSpace({
        space: withSurface({ kind: "lava" as IAutoMovieSurface["kind"] }),
      }),
      "type",
      ".kind",
    ),
  );
  TestValidator.predicate(
    "footprint needs three points",
    hasViolation(
      validateSpace({ space: withSurface({ polygon: [v(0, 0), v(1, 0)] }) }),
      "type",
      ".polygon",
    ),
  );
  TestValidator.predicate(
    "collinear footprint rejected",
    hasViolation(
      validateSpace({
        space: withSurface({ polygon: [v(0, 0), v(1, 1), v(2, 2)] }),
      }),
      "type",
      ".polygon",
    ),
  );
  TestValidator.predicate(
    "concave footprint rejected",
    hasViolation(
      validateSpace({
        space: withSurface({
          // An L-shape: the (2,2) inner corner sits inside the convex hull, so
          // surfaceContains would fill the notch — the query must reject it.
          polygon: [v(0, 0), v(4, 0), v(4, 2), v(2, 2), v(2, 4), v(0, 4)],
        }),
      }),
      "type",
      ".polygon",
    ),
  );
  TestValidator.equals(
    "convex footprint with a collinear edge point passes",
    validateSpace({
      space: withSurface({
        // A square with an extra midpoint on the bottom edge — still convex,
        // the midpoint stays on the hull boundary, so it must be accepted.
        polygon: [v(0, 0), v(2, 0), v(4, 0), v(4, 4), v(0, 4)],
      }),
    }).success,
    true,
  );
  TestValidator.predicate(
    "non-finite footprint coordinate",
    hasViolation(
      validateSpace({
        space: withSurface({ polygon: [v(0, 0), v(Number.NaN, 0), v(1, 1)] }),
      }),
      "range",
      ".polygon[1].x",
    ),
  );
  TestValidator.predicate(
    "non-finite anchor",
    hasViolation(
      validateSpace({
        space: withSurface({ anchor: { x: 0, y: Number.NaN, z: 0 } }),
      }),
      "range",
      ".anchor.y",
    ),
  );
  TestValidator.predicate(
    "degenerate ramp axis",
    hasViolation(
      validateSpace({
        space: withSurface({ rampTo: { x: 4, y: 2, z: 0 } }),
      }),
      "range",
      ".rampTo",
    ),
  );
  const junkRamp = validateSpace({
    space: withSurface({ rampTo: { x: Number.NaN, y: 2, z: 0 } }),
  });
  TestValidator.predicate(
    "non-finite rampTo caught",
    hasViolation(junkRamp, "range", ".rampTo.x"),
  );
  TestValidator.predicate(
    "non-finite rampTo skips the degeneracy math",
    junkRamp.success === false && junkRamp.violations.length === 1,
  );
  const junkRampZ = validateSpace({
    space: withSurface({ rampTo: { x: 8, y: 2, z: Number.NaN } }),
  });
  TestValidator.predicate(
    "non-finite rampTo z likewise skips the degeneracy math",
    hasViolation(junkRampZ, "range", ".rampTo.z") &&
      junkRampZ.success === false &&
      junkRampZ.violations.length === 1,
  );
  TestValidator.predicate(
    "unresolved walkable id",
    hasViolation(
      validateSpace({ space: { ...valid, walkable: ["floor", "ghost"] } }),
      "type",
      "walkable[1]",
    ),
  );
  TestValidator.predicate(
    "duplicated walkable id",
    hasViolation(
      validateSpace({ space: { ...valid, walkable: ["floor", "floor"] } }),
      "type",
      "walkable[1]",
    ),
  );
};
