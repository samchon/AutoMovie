import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Complete face interpretation carries a selected chamber to its actual lining.
 *
 * Scenarios:
 * 1. An explicitly open coarse face with 10 mm vertical room has an internal
 *    maximum above its copied rim, rather than dropping the optional profile.
 */
export const test_subject_human_oral_chamber_model = (): void => {
  const face = coarseHumanFaceFixture("oral-chamber-consumer");
  face.expression = { lipPart: 10 };
  face.detail = {
    mouth: {
      cavityWall: 0.75,
      cavityChamber: {
        horizontalExpansion: 5,
        verticalExpansion: 10,
        transitionDepth: 5,
      },
    },
  };
  const model = buildHumanFace(face, 0),
    cavity = model.parts.find((p) => p.id === "oral-cavity");
  if (cavity?.geometry.type !== "mesh")
    throw new Error("Expected the selected open cavity.");
  const points = cavity.geometry.mesh.positions,
    count = (points.length / 3 - 1) / 24;
  const rimY = points.slice(0, count * 3).filter((_v, i) => i % 3 === 1);
  const insideY = points.slice(count * 3).filter((_v, i) => i % 3 === 1);
  TestValidator.predicate(
    "face consumes chamber",
    Math.max(...insideY) - Math.max(...rimY) > 0.005,
  );
};
