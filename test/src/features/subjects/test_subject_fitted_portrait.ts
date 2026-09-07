import { TestValidator } from "@nestia/e2e";

import { buildFittedReferencePortrait } from "../../subjects/generated-korean-girl-01/fittedModel";

/**
 * The fitted target composes shared anatomical skin with attached optical and
 * coarse context parts. This is a coarse numerical assembly, not a likeness test.
 * Scenarios:
 * 1. The target has resident finite metric meshes, mapped material identities,
 *    actual dental crowns and the requested coarse hair.
 */
export const test_subject_fitted_portrait = (): void => {
  const model = buildFittedReferencePortrait(0),
    materials = new Set(model.materials.map((m) => m.id));
  TestValidator.predicate(
    "complete target attachments",
    model.parts.some((p) => p.id.startsWith("tooth-")) &&
      model.parts.some((p) => p.material === "hair") &&
      model.parts.some((p) => p.id.includes("brow-hair")),
  );
  TestValidator.predicate(
    "resident fitted geometry",
    model.parts.every((p) => {
      const g = p.geometry;
      return (
        materials.has(p.material!) &&
        g.type === "mesh" &&
        g.mesh.positions.every(Number.isFinite) &&
        g.mesh.normals!.every(Number.isFinite)
      );
    }),
  );
};
