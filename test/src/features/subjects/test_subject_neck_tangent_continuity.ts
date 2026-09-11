import { TestValidator } from "@nestia/e2e";

import {
  appendPortraitNeck,
  portraitNeckShape,
} from "../../subjects/generated-korean-girl-01/cranium";
import { throwsError } from "../internal/predicates";

/**
 * The neck's initial curve tangent continues the incoming head surface.
 * An oblique four-corner opening isolates this tangent condition from the face.
 *
 * Scenarios:
 * 1. Front and rear corners begin at different heights. Recover the exact
 *    initial cubic derivative from three equally spaced samples; it must point
 *    along the incoming head direction before the curve bends downwards.
 * 2. The lower ring reaches one horizontal crop plane while retaining both
 *    anterior and posterior depth, rather than flattening the neck into a sheet.
 */
export const test_subject_neck_tangent_continuity = (): void => {
  const roots = [
    [30, -60, 20],
    [-30, -60, 20],
    [-30, -30, -60],
    [30, -30, -60],
  ];
  const exterior = [
    [40, -55, 24],
    [-40, -55, 24],
    [-40, -20, -70],
    [40, -20, -70],
  ];
  const cage = {
    positions: roots.map((point) => [...point]),
    indices: [] as number[],
    groups: [] as number[],
  };
  appendPortraitNeck(cage, { boundary: [0, 1, 2, 3], exterior });
  for (let i = 0; i < roots.length; i++) {
    const incoming = roots[i].map((value, axis) => value - exterior[i][axis]);
    // A third-order forward difference is exact for a cubic. The omitted
    // positive denominator scales the tangent without changing its direction.
    const outgoing = roots[i].map(
      (value, axis) =>
        -11 * value +
        18 * cage.positions[roots.length + i][axis] -
        9 * cage.positions[2 * roots.length + i][axis] +
        2 * cage.positions[3 * roots.length + i][axis],
    );
    const cross = [
      incoming[1] * outgoing[2] - incoming[2] * outgoing[1],
      incoming[2] * outgoing[0] - incoming[0] * outgoing[2],
      incoming[0] * outgoing[1] - incoming[1] * outgoing[0],
    ];
    TestValidator.predicate(
      "tangent remains collinear",
      Math.hypot(...cross) < 1e-9,
    );
    TestValidator.predicate(
      "tangent continues forwards",
      incoming.reduce((sum, value, axis) => sum + value * outgoing[axis], 0) >
        0,
    );
  }
  const lower = cage.positions.slice(-roots.length);
  TestValidator.predicate(
    "zero incoming tangent refused",
    throwsError(() =>
      appendPortraitNeck(
        {
          positions: roots.map((point) => [...point]),
          indices: [],
          groups: [],
        },
        { boundary: [0, 1, 2, 3], exterior: roots },
      ),
    ),
  );
  TestValidator.predicate(
    "one crop plane",
    lower.every((point) => point[1] === lower[0][1] && point[1] < -60),
  );
  TestValidator.predicate(
    "neck retains anterior and posterior volume",
    Math.max(...lower.map((point) => point[2])) >
      portraitNeckShape.crop.centre &&
      Math.min(...lower.map((point) => point[2])) <
        portraitNeckShape.crop.centre,
  );
};
