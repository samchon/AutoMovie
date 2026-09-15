import {
  applyPortraitFinalSurfaces,
  createPortraitSkinColour,
  refinePortraitSurfaceSampling,
  subdivideControlMesh,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  skinColourRegion,
  skinColourSquare,
} from "../internal/skinColourFixture";

/**
 * Refine material coordinates before evaluating nonlinear pigment.
 *
 * Scenarios:
 * 1. A compact colour spot misses all four control corners but reaches the
 *    subdivided centre. Early interpolation of white RGB would lose it.
 * 2. Stretching current positions leaves refined reference coordinates and
 *    pigment unchanged; explicit input RGB follows the same Loop masks.
 * 3. Adaptive edge insertion carries affine reference/RGB midpoints, while
 *    final geometry-only proposals leave those attributes unchanged.
 */
export const test_subject_skin_colour_coordinates = (): void => {
  const square = skinColourSquare(),
    reference = square.positions.map((p) => [...p]);
  const sample = createPortraitSkinColour(
    { positions: [[0, 0, 0]], indices: [], viewRay: [0, 0, 1] },
    [
      {
        ...skinColourRegion(),
        radius: [0.5, 0.5, 0.5],
        gain: [0.25, 0.5, 0.75],
        strength: 1,
      },
    ],
  );
  TestValidator.equals(
    "corners miss compact field",
    square.positions.map(sample),
    new Array(4).fill([1, 1, 1]),
  );
  const input = {
    ...square,
    positions: square.positions.map(([x, y, z]) => [x * 3, y + 5, z]),
    reference,
    colors: square.positions.map(() => [1, 1, 1]),
  };
  const before = structuredClone(input),
    refined = subdivideControlMesh(input, 1);
  TestValidator.equals(
    "reference uses the original Loop operator",
    refined.reference,
    subdivideControlMesh(square, 1).positions,
  );
  const centre = refined.reference!.findIndex((p) => p.every((v) => v === 0));
  TestValidator.predicate("resident centre witness", centre >= 0);
  TestValidator.equals(
    "late nonlinear evaluation retains spot",
    sample(refined.reference![centre]),
    [0.25, 0.5, 0.75],
  );
  TestValidator.equals(
    "early RGB would lose spot",
    refined.colors![centre],
    [1, 1, 1],
  );
  TestValidator.equals("caller not changed", input, before);
  const adaptive = refinePortraitSurfaceSampling(
    input,
    [
      {
        center: { x: 0, y: 0, z: 0 },
        radius: { x: 0.02, y: 0.02, z: 0.02 },
        displacement: { x: 0, y: 0, z: 0 },
        stretch: { x: 0, y: 0, z: 0 },
      },
    ],
    3,
  );
  TestValidator.predicate(
    "adaptive samples inserted",
    adaptive.positions.length > input.positions.length,
  );
  TestValidator.predicate(
    "material coordinates do not stretch",
    adaptive.positions.every(
      ([x, y, z], i) =>
        Math.abs(adaptive.reference![i][0] - x / 3) < 1e-12 &&
        Math.abs(adaptive.reference![i][1] - (y - 5)) < 1e-12 &&
        adaptive.reference![i][2] === z,
    ),
  );
  TestValidator.predicate(
    "RGB midpoint identity",
    adaptive.colors!.every((p) => p.every((v) => v === 1)),
  );
  const final = applyPortraitFinalSurfaces(adaptive, [
    { id: "pose", propose: () => [{ vertex: 0, target: [20, 30, 40] }] },
  ]);
  TestValidator.equals(
    "final movement retained",
    final.positions[0],
    [20, 30, 40],
  );
  TestValidator.equals(
    "final reference unchanged",
    final.reference,
    adaptive.reference,
  );
  TestValidator.equals("final RGB unchanged", final.colors, adaptive.colors);
};
