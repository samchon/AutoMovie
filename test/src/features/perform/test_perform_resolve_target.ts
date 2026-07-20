import { resolveTargetPoint } from "@automovie/engine";
import {
  IAutoMovieActionTarget,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const nodes = new Map<string, IAutoMovieVector3>([
  ["a", { x: 1, y: 0, z: 0 }],
  ["b", { x: 3, y: 0, z: 0 }],
]);

const at = (target: IAutoMovieActionTarget): IAutoMovieVector3 | null =>
  resolveTargetPoint(target, nodes);

const isPoint = (
  p: IAutoMovieVector3 | null,
  x: number,
  y: number,
  z: number,
): boolean => p !== null && nclose(p.x, x) && nclose(p.y, y) && nclose(p.z, z);

/**
 * `resolveTargetPoint`: turn a positional action target into a world point.
 *
 * Scenarios:
 *
 * 1. A `node` target resolves to its world position, or null when absent.
 * 2. A `point` target is the literal point.
 * 3. A `group` target is the centroid of its resolvable members (missing members
 *    are dropped); an all-missing group is null.
 * 4. The relative targets (`direction`, `offscreen`) are not positional → null.
 */
export const test_perform_resolve_target = (): void => {
  // 1. node
  TestValidator.predicate(
    "node resolves to its position",
    isPoint(at({ kind: "node", node: "a" }), 1, 0, 0),
  );
  TestValidator.equals(
    "absent node → null",
    at({ kind: "node", node: "z" }),
    null,
  );

  // 2. point
  TestValidator.predicate(
    "point is the literal point",
    isPoint(at({ kind: "point", point: { x: 5, y: 1, z: 5 } }), 5, 1, 5),
  );

  // 3. group centroid, with a missing member dropped
  TestValidator.predicate(
    "group is the centroid of its members",
    isPoint(at({ kind: "group", nodes: ["a", "b"] }), 2, 0, 0),
  );
  TestValidator.predicate(
    "a missing group member is dropped from the centroid",
    isPoint(at({ kind: "group", nodes: ["a", "z"] }), 1, 0, 0),
  );
  TestValidator.equals(
    "an all-missing group → null",
    at({ kind: "group", nodes: ["z"] }),
    null,
  );

  // 4. relative targets are not positional
  TestValidator.equals(
    "direction → null",
    at({ kind: "direction", headingDeg: 90 }),
    null,
  );
  TestValidator.equals(
    "offscreen → null",
    at({ kind: "offscreen", edge: "left" }),
    null,
  );
};
