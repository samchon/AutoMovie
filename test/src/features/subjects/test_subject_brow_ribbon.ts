import {
  buildPortraitEyebrow,
  portraitEyebrowProfile,
} from "@automovie/human/components/eyebrows";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Skin-following eyebrow ribbons retain a finite surface and reduce strand cost.
 * Scenarios:
 * 1. One strand on a tilted plane has two triangles per interval and stays above
 *    its declared normal clearance, on both anatomical sides.
 * 2. The default tube has sixteen triangles per interval. Invalid representation refuses.
 * 3. A projected guide with a stationary sampled tangent refuses instead of emitting a collapsed strip.
 */
export const test_subject_brow_ribbon = (): void => {
  const point = (x: number, y: number) => [x, y, 0.5 * x + 0.3 * y];
  const skin = {
    positions: [
      point(-10, -10),
      point(10, -10),
      point(10, 10),
      point(-10, 10),
      point(-3, -2),
      point(3, -2),
      point(-3, 2),
      point(3, 2),
    ],
    indices: [0, 1, 2, 0, 2, 3],
    groups: [0, 0],
  };
  for (const side of ["left", "right"] as const) {
    const binding = { side, lower: [4, 5], upper: [6, 7] };
    const profile = {
      ...portraitEyebrowProfile,
      representation: "ribbon" as const,
    };
    const part = buildPortraitEyebrow(skin, binding, 1, profile)[0];
    if (part.geometry.type !== "mesh") throw new Error("Expected ribbon");
    const mesh = part.geometry.mesh;
    TestValidator.equals(
      "two triangles per interval",
      mesh.indices!.length,
      profile.segments * 6,
    );
    TestValidator.predicate(
      "finite normals",
      mesh.normals!.every(Number.isFinite),
    );
    for (let i = 0; i < mesh.normals!.length; i += 3)
      TestValidator.predicate(
        "unit normal length",
        Math.abs(Math.hypot(...mesh.normals!.slice(i, i + 3)) - 1) < 1e-10,
      );
    for (let i = 0; i < mesh.positions.length; i += 3)
      TestValidator.predicate(
        "plane clearance",
        (1000 *
          (mesh.positions[i + 2] -
            0.5 * mesh.positions[i] -
            0.3 * mesh.positions[i + 1])) /
          Math.sqrt(1.34) >=
          profile.clearance - 1e-8,
      );
    const tube = buildPortraitEyebrow(skin, binding, 1)[0];
    if (tube.geometry.type !== "mesh") throw new Error("Expected tube");
    TestValidator.equals(
      "eightfold triangle reduction",
      tube.geometry.mesh.indices!.length,
      mesh.indices!.length * 8,
    );
    TestValidator.predicate(
      "unknown mode refuses",
      throwsError(() =>
        buildPortraitEyebrow(skin, binding, 1, {
          ...profile,
          representation: "unknown" as "ribbon",
        }),
      ),
    );
  }
  const stationary = {
    ...skin,
    positions: [
      ...skin.positions,
      point(0, 0),
      point(0, 0),
      point(-0.001, 0),
      point(-0.001, 0),
    ],
  };
  TestValidator.predicate(
    "stationary projected tangent refuses",
    throwsError(() =>
      buildPortraitEyebrow(
        stationary,
        { side: "left", lower: [8, 9], upper: [10, 11] },
        1,
        {
          ...portraitEyebrowProfile,
          representation: "ribbon",
          rootBand: [0, 0],
          span: 1,
          outwardBend: 1,
          segments: 2,
        },
      ),
    ),
  );
};
