import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * A numerical face document reaches a resident metric model without any photograph or fitted mesh cache.
 *
 * Scenarios:
 * 1. Coarse tessellation of complete anatomical parts preserves the caller's identity and owns its buffers.
 * 2. Independent pinnae, optics, lips and cranial skin reach the same validated model with a closed neutral mouth.
 */
export const test_subject_human_model = (): void => {
  const document = coarseHumanFaceFixture("authored-unit-person");
  const model = buildHumanFace(document, 0);
  TestValidator.equals("caller identity", model.id, document.id);
  TestValidator.equals(
    "resident generated model",
    [model.origin, model.skeleton, model.asset],
    ["generated", null, null],
  );
  TestValidator.predicate(
    "anatomical parts are present",
    [
      "head",
      "lips",
      "right-sclera",
      "left-sclera",
      "right-pinna",
      "left-pinna",
    ].every((id) => model.parts.some((part) => part.id === id)),
  );
  TestValidator.predicate(
    "neutral closes oral interior",
    !model.parts.some((part) => part.id === "oral-cavity"),
  );
  const coordinates = model.parts.flatMap((part) =>
    part.geometry.type === "mesh" ? part.geometry.mesh.positions : [],
  );
  TestValidator.predicate(
    "finite metric geometry",
    coordinates.length > 0 &&
      coordinates.every(
        (value) => Number.isFinite(value) && Math.abs(value) < 1,
      ),
  );
  const previous = model.materials[0].roughness;
  document.basis.host.positions[0][0] = 999;
  document.name = "changed caller";
  TestValidator.equals(
    "model ownership",
    [model.name, model.materials[0].roughness],
    ["authored-unit-person", previous],
  );
};
