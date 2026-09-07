import { TestValidator } from "@nestia/e2e";

import {
  measuredPortraitAssembly,
  portraitComponentsFor,
  portraitEyeShape,
  portraitNoseShape,
} from "../../subjects/generated-korean-girl-01/configuration";
import { buildReferencePortrait } from "../../subjects/generated-korean-girl-01/model";

/**
 * The composed face must be resident, finite AutoMovie geometry before export.
 * This is a buffer/assembly test, not a likeness judgment.
 *
 * Scenarios:
 * 1. Construct a coarse preview through every anatomical builder, including the
 *    cheek, nasal, orbital and perioral supports plus the rough hair proxy; confirm
 *    static generated identity and complete material bindings.
 * 2. Every mesh has aligned finite positions/normals, integral resident triangle
 *    indices and no skeletal data. The metre-scale bounds reject unit mistakes.
 */
export const test_subject_portrait_model = (): void => {
  const eye = {
    ...portraitEyeShape,
    browFibres: 6,
    upperLashes: 3,
    sampling: { eyeColumns: 12, eyeRows: 6, irisColumns: 16, irisRows: 4 },
  };
  const model = buildReferencePortrait({
    hairProxy: true,
    components: portraitComponentsFor(eye, eye, portraitNoseShape),
    subdivisionRounds: 1,
    surfaceLayers: measuredPortraitAssembly.surfaceLayers,
  });
  TestValidator.equals(
    "static generated model",
    [model.origin, model.skeleton, model.body, model.asset],
    ["generated", null, null, null],
  );
  const materials = new Set(model.materials.map((m) => m.id));
  TestValidator.predicate(
    "requested rough hair is present",
    model.parts.some((part) => part.material === "hair"),
  );
  let valid = true,
    extent = 0;
  for (const part of model.parts) {
    valid &&=
      part.material !== null &&
      materials.has(part.material) &&
      part.attachedBone === null;
    if (part.geometry.type !== "mesh") {
      valid = false;
      continue;
    }
    const mesh = part.geometry.mesh;
    valid &&=
      mesh.skin === null &&
      mesh.positions.length > 0 &&
      mesh.positions.length % 3 === 0 &&
      mesh.normals?.length === mesh.positions.length &&
      mesh.indices !== null &&
      mesh.indices.length % 3 === 0;
    valid &&=
      mesh.positions.every(Number.isFinite) &&
      mesh.normals!.every(Number.isFinite) &&
      mesh.indices!.every(
        (i) => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3,
      );
    for (const value of mesh.positions)
      extent = Math.max(extent, Math.abs(value));
  }
  TestValidator.equals("resident aligned buffers", valid, true);
  TestValidator.predicate(
    "head is measured in metres",
    extent > 0.05 && extent < 0.3,
  );
};
