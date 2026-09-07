import { TestValidator } from "@nestia/e2e";

import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../../subjects/reference-anatomy/model";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A continuous anatomical reference keeps the optical attachments in its own
 * normalized frame while applying expression and endpoint shape controls.
 * Scenarios:
 * 1. Eye centres remain 64 mm apart at the requested midpoint. All generated
 *    geometry is resident and finite, and the caller's controls remain owned.
 * 2. Opposite valid endpoint/expression weights change the skin. Out-of-range
 *    weights, invalid radii/placement and unrepresentable scale refuse.
 */
export const test_subject_anatomical_basis = (): void => {
  const input = {
    ...anatomicalStudyShape,
    eyeDistance: 64,
    eyeHeight: 25,
    eyeDepth: 37,
  };
  const model = buildAnatomicalStudy(input);
  for (let side = 0; side < 2; side++) {
    const part = model.parts.find((p) => p.id === "study-globe-" + side)!;
    if (part.geometry.type !== "mesh")
      throw new Error("Expected an optical mesh.");
    const positions = part.geometry.mesh.positions;
    const center = [0, 1, 2].map((axis) => {
      const values = positions.filter((_v, i) => i % 3 === axis);
      return (Math.min(...values) + Math.max(...values)) / 2;
    });
    TestValidator.predicate(
      "normalized eye attachment",
      center.every((v, i) =>
        nclose(v, [side === 0 ? -0.032 : 0.032, 0.025, 0.037][i], 1e-8),
      ),
    );
  }
  TestValidator.predicate(
    "finite resident geometry",
    model.parts.every((p) => {
      const geometry = p.geometry;
      return (
        geometry.type === "mesh" &&
        geometry.mesh.positions.every(Number.isFinite) &&
        geometry.mesh.normals!.every(Number.isFinite) &&
        geometry.mesh.indices!.every(
          (i) =>
            Number.isInteger(i) &&
            i >= 0 &&
            i < geometry.mesh.positions.length / 3,
        )
      );
    }),
  );
  const other = buildAnatomicalStudy({
    ...input,
    youth: 1,
    smile: 0,
    jawOpen: 1,
  });
  const skin = model.parts[0].geometry,
    changed = other.parts[0].geometry;
  TestValidator.predicate(
    "endpoint and expression controls change skin",
    skin.type === "mesh" &&
      changed.type === "mesh" &&
      skin.mesh.positions.some(
        (v, i) => Math.abs(v - changed.mesh.positions[i]) > 0.0001,
      ),
  );
  buildAnatomicalStudy({ ...input, youth: 0, smile: 1, jawOpen: 0 });
  for (const patch of [
    { youth: -0.1 },
    { youth: 1.1 },
    { smile: NaN },
    { jawOpen: 1.1 },
    { eyeDistance: 0 },
    { eyeRadius: 0 },
    { eyeRadius: 32 },
    { irisRadius: 0 },
    { pupilRadius: 0 },
    { irisRadius: 12.2 },
    { pupilRadius: 5.7 },
    { eyeHeight: NaN },
    { eyeDepth: Infinity },
  ])
    TestValidator.predicate(
      "invalid study controls refuse",
      throwsError(
        () => buildAnatomicalStudy({ ...input, ...patch }),
        "controls",
      ),
    );
  TestValidator.predicate(
    "coordinate overflow refuses",
    throwsError(
      () => buildAnatomicalStudy({ ...input, eyeDistance: Number.MAX_VALUE }),
      "representable",
    ),
  );
  TestValidator.predicate(
    "metric Float32 overflow refuses",
    throwsError(
      () => buildAnatomicalStudy({ ...input, eyeHeight: 1e45 }),
      "representable",
    ),
  );
  TestValidator.equals("caller controls unchanged", input.eyeDistance, 64);
};
