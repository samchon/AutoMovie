import {
  type IPortraitHairShape,
  buildPortraitHairCards,
} from "@automovie/human/components/hairCards";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * The taper begins at an authored longitudinal fraction without changing the
 * root, endpoint, guide or mesh cost of a lock.
 *
 * Scenarios:
 * 1. Omission and explicit zero retain the legacy four-interval straight strip.
 * 2. A midpoint start holds two mm through the midpoint, then reaches one mm
 *    at the tip; three-quarter width is independently calculated as 1.5 mm.
 * 3. The inclusive upper limit and empty population are admitted. Nonfinite
 *    and immediately out-of-range fractions refuse without mutating inputs.
 */
export const test_subject_hair_taper = (): void => {
  const shape: IPortraitHairShape = {
    material: "hair",
    cards: [
      {
        guide: [
          [0, 0, 0],
          [0, 10, 0],
        ],
        across: [
          [1, 0, 0],
          [1, 0, 0],
        ],
        width: 2,
      },
    ],
    segments: 4,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 0,
    fibres: 2,
    coverage: 1,
  };
  const before = structuredClone(shape);
  const original = buildPortraitHairCards(shape);
  TestValidator.equals(
    "legacy zero",
    buildPortraitHairCards({ ...shape, taperStart: 0 }),
    original,
  );
  const result = buildPortraitHairCards({ ...shape, taperStart: 0.5 })[0]
    .geometry;
  if (result.type !== "mesh" || original[0].geometry.type !== "mesh")
    throw new Error("Expected resident mesh");
  const widths = [2, 2, 2, 1.5, 1];
  for (let row = 0; row < widths.length; row++) {
    const offset = row * 6;
    // A clamped-end Catmull-Rom segment is collinear but not uniform-speed.
    const t = row / 4;
    const y = 0.01 * (0.5 * t + 1.5 * t * t - t * t * t);
    TestValidator.predicate(
      "hand-calculated width",
      nclose(
        result.mesh.positions[offset + 3] - result.mesh.positions[offset],
        widths[row] / 1000,
        1e-12,
      ),
    );
    TestValidator.predicate(
      "unchanged centreline",
      nclose(result.mesh.positions[offset + 1], y, 1e-12) &&
        result.mesh.positions[offset + 2] === 0,
    );
  }
  TestValidator.equals(
    "same topology",
    result.mesh.indices,
    original[0].geometry.mesh.indices,
  );
  TestValidator.equals(
    "same texture coordinates",
    result.mesh.uvs,
    original[0].geometry.mesh.uvs,
  );
  TestValidator.equals(
    "inclusive upper limit",
    buildPortraitHairCards({ ...shape, taperStart: 0.95 }).length,
    1,
  );
  TestValidator.equals(
    "empty population",
    buildPortraitHairCards({ ...shape, taperStart: 0.5, cards: [] }),
    [],
  );
  for (const taperStart of [-0.001, 0.951, NaN, Infinity])
    TestValidator.predicate(
      "invalid taper start",
      throwsError(() => buildPortraitHairCards({ ...shape, taperStart })),
    );
  TestValidator.equals("caller unchanged", shape, before);
};
