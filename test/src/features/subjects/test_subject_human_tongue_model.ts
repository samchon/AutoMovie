import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { portraitTongueFixture } from "../internal/portraitTongueFixture";

/**
 * The real face builder consumes the optional lingual component and expression.
 *
 * Scenarios:
 * 1. A complete coarse face with jaw opening, dorsal elevation and advancement
 *    contains the separately finished tongue in metres alongside oral skin.
 */
export const test_subject_human_tongue_model = (): void => {
  const document = coarseHumanFaceFixture("tongue-consumer");
  document.basis.bindings.jawHinge = { x: 0, y: 0, z: -45 };
  document.detail = { tongue: portraitTongueFixture() };
  document.expression = {
    jawOpen: 10,
    lipPart: 12,
    tongueRaise: 2,
    tongueAdvance: 3,
  };
  const model = buildHumanFace(document, 0),
    part = model.parts.find((p) => p.id === "tongue");
  if (part?.geometry.type !== "mesh")
    throw new Error("The builder omitted the selected tongue.");
  TestValidator.equals("authored tongue finish", part.material, "lips");
  TestValidator.predicate(
    "finite metric tongue",
    part.geometry.mesh.positions.every(
      (v) => Number.isFinite(v) && Math.abs(v) < 1,
    ),
  );
  TestValidator.predicate(
    "other oral anatomy retained",
    model.parts.some((p) => p.id === "lips") &&
      model.parts.some((p) => p.id === "oral-cavity"),
  );
};
