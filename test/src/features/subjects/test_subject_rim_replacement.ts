import { TestValidator } from "@nestia/e2e";

import { replacePortraitRim } from "../../subjects/replacePortraitRim";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A final attachment retains its requested boundary and its unchanged exterior
 * after a bounded displacement solve; disconnected anatomy cannot participate.
 *
 * Scenarios:
 * 1. A four-spoke star has one raised rim and three fixed outer vertices. Its
 *    equally weighted central vertex must rise by one quarter, while an adjacent
 *    disconnected star stays exact. Translating both inputs preserves the result.
 * 2. The exact one-edge reach excludes that edge's far vertex; a larger reach
 *    includes it. Zero reach, neutral targets, an empty rim and an isolated pin
 *    preserve their explicit ownership without mutating the caller's buffers.
 * 3. Duplicate/nonresident pins, mismatched or nonfinite targets and invalid reach
 *    refuse; signed finite displacements and the zero boundary remain accepted.
 */
export const test_subject_rim_replacement = (): void => {
  const star = [
    [0, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [1, 0, 0],
    [0, -1, 0],
  ];
  const positions = [
    ...star,
    ...star.map((p) => [p[0] + 10, p[1], p[2]]),
    [20, 0, 0],
  ];
  const triangles = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1];
  const indices = [...triangles, ...triangles.map((id) => id + 5)];
  const before = JSON.stringify({ positions, indices });
  for (const z of [-1, 1]) {
    const output = replacePortraitRim(
      positions,
      indices,
      [1],
      [[-1, 0, z]],
      1.1,
    );
    TestValidator.predicate(
      "equal four-spoke weights give one quarter",
      nclose(output.positions[0][2], z / 4),
    );
    TestValidator.equals(
      "only the centre belongs to the free collar",
      output.collar,
      [0],
    );
    TestValidator.equals("final pin is exact", output.positions[1], [-1, 0, z]);
    TestValidator.equals(
      "outer and disconnected vertices stay exact",
      output.positions.slice(2),
      positions.slice(2),
    );
    const translation = [7, -3, 11];
    const shifted = replacePortraitRim(
      positions.map((p) => p.map((v, axis) => v + translation[axis])),
      indices,
      [1],
      [[6, -3, 11 + z]],
      1.1,
    );
    TestValidator.predicate(
      "translated final frame keeps the same displacement",
      shifted.positions.every((p, id) =>
        p.every((v, axis) =>
          nclose(v, output.positions[id][axis] + translation[axis]),
        ),
      ),
    );
  }
  for (const reach of [0, 1]) {
    const output = replacePortraitRim(
      positions,
      indices,
      [1],
      [[-1, 0, 1]],
      reach,
    );
    TestValidator.equals(
      "zero and exact boundary reach do not move the centre",
      output.positions[0],
      positions[0],
    );
    TestValidator.equals("no free collar at that reach", output.collar, []);
  }
  TestValidator.equals(
    "neutral replacement is identity",
    replacePortraitRim(positions, indices, [1], [positions[1]], 1.1).positions,
    positions,
  );
  TestValidator.equals(
    "empty boundary is identity",
    replacePortraitRim(positions, indices, [], [], 2).positions,
    positions,
  );
  TestValidator.equals(
    "isolated final pin is still exact",
    replacePortraitRim(positions, indices, [10], [[20, 0, 2]], 3).positions[10],
    [20, 0, 2],
  );
  TestValidator.equals(
    "caller buffers remain unchanged",
    JSON.stringify({ positions, indices }),
    before,
  );
  for (const point of [
    [0, 0, 0],
    [NaN, 0, 0],
    [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
  ]) {
    const invalid = positions.map((p) => [...p]);
    invalid[1] = point;
    TestValidator.predicate(
      "nonpositive or unbounded edges refuse",
      throwsError(
        () => replacePortraitRim(invalid, indices, [1], [[-1, 0, 1]], 1),
        "edge lengths",
      ),
    );
  }
  const large = positions.map((p) => [...p]);
  large[1] = [1e308, 1e308, 1e308];
  TestValidator.equals(
    "large but finite edge length remains accepted",
    replacePortraitRim(large, indices, [1], [[-1, 0, 1]], 1).positions[1],
    [-1, 0, 1],
  );
  for (const reach of [-1, NaN, Infinity])
    TestValidator.predicate(
      "invalid reach refuses",
      throwsError(
        () => replacePortraitRim(positions, indices, [1], [[-1, 0, 1]], reach),
        "final rim",
      ),
    );
  for (const rim of [[1, 1], [-1], [positions.length], [0.5]])
    TestValidator.predicate(
      "invalid identities refuse",
      throwsError(
        () =>
          replacePortraitRim(
            positions,
            indices,
            rim,
            rim.map(() => [0, 0, 1]),
            1,
          ),
        "final rim",
      ),
    );
  for (const targets of [[], [[0, 0]], [[0, 0, NaN]], [[0, 0, Infinity]]])
    TestValidator.predicate(
      "invalid target population refuses",
      throwsError(
        () => replacePortraitRim(positions, indices, [1], targets, 1),
        "final rim",
      ),
    );
};
