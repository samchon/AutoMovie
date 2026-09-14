import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  portraitCheekShape,
  portraitCheekSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Optional supports and both dental arches reach the resident face assembler.
 *
 * Scenarios:
 * 1. Paired cheeks/orbits, point relief and connected curves share one host.
 * 2. Maxillary and mandibular crowns remain distinct parts with an authored jaw hinge.
 * 3. An observed open mouth stays open when the current expression matches it.
 */
export const test_subject_human_model_supports = (): void => {
  const document = coarseHumanFaceFixture("supported-face");
  const { recipe, bindings } = document.basis;
  recipe.cheek = structuredClone(portraitCheekShape);
  bindings.cheeks = {
    right: portraitCheekSockets[0],
    left: portraitCheekSockets[1],
  };
  const orbit = {
    radius: 8,
    stations: [
      {
        name: "brow",
        anchor: 10,
        forehead: { height: 3, projection: 0 },
        browProjection: 0,
        sulcus: { descent: 3, projection: 0 },
      },
    ],
  };
  recipe.orbits = { right: orbit, left: structuredClone(orbit) };
  recipe.relief = [
    {
      id: "frontal-relief",
      regions: [
        {
          name: "frontal",
          anchor: 10,
          offset: [0, 0, 0],
          radius: [10, 10, 10],
          displacement: [0, 0, 0.01],
        },
      ],
    },
  ];
  recipe.curves = [
    {
      id: "frontal-curve",
      curves: [
        {
          name: "forehead",
          points: [
            {
              anchor: 10,
              offset: [-2, 0, 0],
              radius: [3, 3, 3],
              displacement: [0, 0, 0.01],
            },
            {
              anchor: 10,
              offset: [2, 0, 0],
              radius: [3, 3, 3],
              displacement: [0, 0, 0.01],
            },
          ],
        },
      ],
    },
  ];
  const row = {
    halfWidth: 24,
    depth: 18,
    gap: 0.1,
    crowns: [
      { width: 5, height: 7, depth: 1.5, cervicalWidth: 0.8, edgeRise: 0.3 },
    ],
  };
  bindings.dentition = {
    rightCorner: bindings.mouth.upper[0],
    leftCorner: bindings.mouth.upper[bindings.mouth.upper.length - 1],
    upperLipMiddle:
      bindings.mouth.upper[Math.floor(bindings.mouth.upper.length / 2)],
  };
  bindings.jawHinge = { x: 0, y: 0, z: -40 };
  recipe.dentition = { row, placement: { lift: 1, recess: 5 } };
  recipe.lowerDentition = {
    row: structuredClone(row),
    placement: { drop: 4, recess: 5 },
  };
  document.expression = structuredClone(document.basis.expression);
  const model = buildHumanFace(document, 0);
  TestValidator.predicate(
    "both arches and open oral cavity",
    ["tooth-upper-arch", "tooth-lower-arch", "oral-cavity"].every((id) =>
      model.parts.some((part) => part.id === id),
    ),
  );
  TestValidator.equals(
    "unique assembled identities",
    new Set(model.parts.map((part) => part.id)).size,
    model.parts.length,
  );
  TestValidator.predicate(
    "all material groups resolve",
    model.parts.every(
      (part) =>
        part.material === null ||
        model.materials.some((material) => material.id === part.material),
    ),
  );
};
