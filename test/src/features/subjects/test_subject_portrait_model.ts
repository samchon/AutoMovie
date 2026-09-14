import { TestValidator } from "@nestia/e2e";

import { buildReferencePortrait } from "../../subjects/generated-korean-girl-01/model";

/**
 * The composed face must be resident, finite AutoMovie geometry before export.
 * This is a buffer/assembly test, not a likeness judgment.
 *
 * Scenarios:
 * 1. Compose an unrefined host, ears and rough hair proxy; confirm static
 *    generated identity and complete material bindings. Anatomical components
 *    and refined-skin supports have their own attachment scenarios; this unit
 *    owns only model assembly, buffer layout and the metre boundary.
 * 2. Every mesh has aligned finite positions/normals, integral resident triangle
 *    indices and no skeletal data. The metre-scale bounds reject unit mistakes.
 */
export const test_subject_portrait_model = (): void => {
  const model = buildReferencePortrait({
    hairProxy: true,
    components: [],
    // This scenario owns complete part/material wiring and units. Refinement
    // and refined contact are covered by their smaller mechanism scenarios.
    subdivisionRounds: 0,
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
