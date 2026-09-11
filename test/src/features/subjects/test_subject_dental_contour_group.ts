import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { portraitMouthShape } from "../../subjects/generated-korean-girl-01/configuration";
import { buildPortraitDentalRow } from "../../subjects/generated-korean-girl-01/dentalRow";
import { buildPortraitMouth } from "../../subjects/generated-korean-girl-01/mouth";
import { nclose } from "../internal/predicates";

/**
 * A paired arch gives the two crowns opposite local mesial directions. The
 * same anatomical contour therefore mirrors across the group's midpoint.
 * Scenarios:
 * 1. Two equal asymmetric crowns on the elliptical group have reflected point
 *    populations; assigning the same mesial direction to both breaks symmetry.
 * 2. The legacy oral-guide path obeys the same rule on a straight symmetric
 *    guide, proving that proximal detail reaches both construction consumers.
 */
export const test_subject_dental_contour_group = (): void => {
  const crown = {
    width: 8,
    height: 10,
    depth: 1.5,
    cervicalWidth: 0.8,
    edgeRise: 0.3,
    contour: {
      mesial: { contactHeight: 0.23, cervicalWidth: 0.9, incisalRise: 0.1 },
      distal: { contactHeight: 0.37, cervicalWidth: 0.7, incisalRise: 0.6 },
    },
  };
  // The signed 0.45-power section amplifies trig-zero roundoff. A 1e-5 mm
  // tolerance bounds that effect on this 8 mm crown, far below the 0.1 mm
  // authored corner asymmetry. Both consumers are compared in millimetres.
  const symmetric = (meshes: IAutoMovieMesh[], scale: number): boolean => {
    const points = meshes.flatMap((mesh) =>
      Array.from({ length: mesh.positions.length / 3 }, (_, i) =>
        mesh.positions.slice(3 * i, 3 * i + 3).map((v) => v * scale),
      ),
    );
    return points.every((p) =>
      points.some(
        (q) =>
          nclose(p[0], -q[0], 1e-5) &&
          nclose(p[1], q[1], 1e-5) &&
          nclose(p[2], q[2], 1e-5),
      ),
    );
  };
  const row = buildPortraitDentalRow({
    halfWidth: 24,
    depth: 18,
    gap: 0.2,
    crowns: [crown, crown],
  });
  TestValidator.predicate(
    "arch owns opposite anatomical directions",
    symmetric([row], 1),
  );
  const unequal = buildPortraitDentalRow({
    halfWidth: 24,
    depth: 18,
    gap: 0.2,
    crowns: [
      crown,
      {
        ...crown,
        contour: { mesial: crown.contour.distal, distal: crown.contour.mesial },
      },
    ],
  });
  TestValidator.predicate(
    "the reflection oracle rejects one reversed contour",
    !symmetric([unequal], 1),
  );
  const source = [
    [-20, 0, 0],
    [0, 0, 0],
    [20, 0, 0],
    [0, -3, 0],
  ];
  const parts = buildPortraitMouth(
    source,
    { outer: [], upper: [0, 1, 2], lower: [0, 3, 2], lipSeed: 0 },
    {
      ...portraitMouthShape,
      dentalOffset: 0,
      dentalRecess: 0,
      toothGap: 0.2,
      crowns: [crown, crown],
    },
  );
  const meshes = parts.slice(1).map((part) => {
    if (part.geometry.type !== "mesh")
      throw new Error("Expected resident crowns.");
    return part.geometry.mesh;
  });
  TestValidator.predicate(
    "oral guide owns the same mesial relationship",
    symmetric(meshes, 1000),
  );
};
