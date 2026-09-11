import { validateMeshTopology } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  assertPortraitDentalCrown,
  buildPortraitDentalCrown,
} from "../../subjects/generated-korean-girl-01/dentalCrown";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Crown profiles preserve enamel dimensions and closed geometry.
 * Scenarios:
 * 1. An 8 by 10 mm crown retains its bounds, finite shading and closed manifold;
 *    its cervical width is 80 percent of the maximum width.
 * 2. Raised cutting-edge corners alter the profile without changing its pitch;
 *    zero dimensions and out-of-range profile factors refuse.
 */
export const test_subject_dental_crown = (): void => {
  const shape = {
    width: 8,
    height: 10,
    depth: 1.5,
    cervicalWidth: 0.8,
    edgeRise: 0.3,
  };
  const mesh = buildPortraitDentalCrown(shape);
  const axis = (i: number) => mesh.positions.filter((_v, j) => j % 3 === i);
  TestValidator.predicate(
    "physical envelope",
    nclose(Math.max(...axis(0)) - Math.min(...axis(0)), 8) &&
      nclose(Math.max(...axis(1)) - Math.min(...axis(1)), 10),
  );
  TestValidator.predicate(
    "closed crown topology",
    validateMeshTopology({ mesh, expectClosed: true }).success,
  );
  TestValidator.predicate(
    "finite crown shading",
    mesh.normals!.every(Number.isFinite),
  );
  const cervical = axis(0).filter((_v, i) =>
    nclose(mesh.positions[i * 3 + 1], 5),
  );
  TestValidator.predicate(
    "narrow cervical outline",
    nclose(Math.max(...cervical) - Math.min(...cervical), 6.4),
  );
  const canine = buildPortraitDentalCrown({ ...shape, edgeRise: 1.4 });
  TestValidator.predicate(
    "cutting-edge form changes",
    canine.positions.some((v, i) => i % 3 === 1 && v > mesh.positions[i] + 0.5),
  );
  assertPortraitDentalCrown({ ...shape, cervicalWidth: 1, edgeRise: 0 });
  for (const patch of [
    { width: 0 },
    { height: 0 },
    { depth: 0 },
    { cervicalWidth: 0 },
    { cervicalWidth: 1.01 },
    { edgeRise: -1 },
    { edgeRise: 5 },
    { width: NaN },
  ])
    TestValidator.predicate(
      "invalid profile refuses",
      throwsError(
        () => buildPortraitDentalCrown({ ...shape, ...patch }),
        "Dental crowns",
      ),
    );
};
