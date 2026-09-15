import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * A selected enclosure reaches the real complete face's oral mesh.
 *
 * Scenarios:
 * 1. Explicitly retaining the observed open mouth builds a ring-and-pole lining
 *    alongside the shared lips. Omitted current expression would close the mouth
 *    and correctly suppress the cavity, so the arrangement pins its opening.
 */
export const test_subject_human_oral_lining_model = (): void => {
  const face = coarseHumanFaceFixture("oral-lining-consumer");
  face.expression = { lipPart: 10 };
  face.detail = { mouth: { cavityWall: 0.75 } };
  const model = buildHumanFace(face, 0);
  const cavity = model.parts.find((p) => p.id === "oral-cavity");
  if (cavity?.geometry.type !== "mesh")
    throw new Error("Face builder omitted the explicitly open cavity.");
  TestValidator.predicate(
    "ring-plus-pole consumer",
    (cavity.geometry.mesh.positions.length / 3 - 1) % 24 === 0,
  );
  TestValidator.predicate(
    "shared lips retained",
    model.parts.some((p) => p.id === "lips"),
  );
};
