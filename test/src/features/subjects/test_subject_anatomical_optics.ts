import { TestValidator } from "@nestia/e2e";

import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../../subjects/reference-anatomy/model";
import { nclose } from "../internal/predicates";

/**
 * The anatomical prior's globe and lifted iris/pupil caps retain meaningful
 * radial normals at their collapsed poles.
 *
 * Scenarios:
 * 1. Every optical sample follows the radius-sixteen sphere's radial direction;
 *    a translated radius-fifteen twin verifies the shared centre/radius frame.
 * 2. The iris and pupil are translated spherical caps: their XY normal follows
 *    the globe and positive Z completes the unit vector independently of lift.
 */
export const test_subject_anatomical_optics = (): void => {
  for (const shape of [
    { ...anatomicalStudyShape, subdivisionRounds: 0 },
    {
      ...anatomicalStudyShape,
      subdivisionRounds: 0,
      eyeRadius: 15,
      eyeHeight: 29,
      eyeDepth: 34,
    },
  ]) {
    const model = buildAnatomicalStudy(shape);
    const optics = model.parts.filter((part) => part.id.startsWith("study-"));
    TestValidator.equals("complete optical population", optics.length, 6);
    for (const part of optics) {
      if (part.geometry.type !== "mesh")
        throw new Error("Optical geometry must be resident.");
      const mesh = part.geometry.mesh;
      const centre = [
        part.id.endsWith("-0") ? -shape.eyeDistance / 2 : shape.eyeDistance / 2,
        shape.eyeHeight,
        shape.eyeDepth,
      ];
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const expected = mesh.positions
          .slice(i, i + 3)
          .map(
            (value, axis) => (value * 1000 - centre[axis]) / shape.eyeRadius,
          );
        if (!part.id.startsWith("study-globe"))
          expected[2] = Math.sqrt(
            Math.max(0, 1 - expected[0] ** 2 - expected[1] ** 2),
          );
        TestValidator.predicate(
          "analytic optical direction",
          expected.every((value, axis) =>
            nclose(mesh.normals![i + axis], value, 1e-8),
          ),
        );
      }
    }
  }
};
