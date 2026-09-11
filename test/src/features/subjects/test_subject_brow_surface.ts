import { TestValidator } from "@nestia/e2e";

import {
  buildPortraitEyebrow,
  portraitEyebrowProfile,
} from "../../subjects/generated-korean-girl-01/eyebrows";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Eyebrow fibres contact the actual skin between their boundary anchors and
 * preserve normal clearance on a sloping surface.
 *
 * Scenarios:
 * 1. On z=0.5x+0.3y, every emitted vertex remains above the declared clearance
 *    measured by signed plane distance, including the bent fibre tips.
 * 2. Translating the host translates the complete output without changing fibre
 *    dimensions; opposite sides retain separate identities and inputs stay intact.
 * 3. Disabled brows emit nothing. Invalid bindings, a zero-length fibre and a
 *    path outside the supporting surface refuse instead of producing buried hair.
 */
export const test_subject_brow_surface = (): void => {
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
  const before = structuredClone(skin),
    binding = { side: "left" as const, lower: [4, 5], upper: [6, 7] };
  const profile = { ...portraitEyebrowProfile, clearance: 0.02, arch: 0 };
  const parts = buildPortraitEyebrow(skin, binding, 3, profile);
  TestValidator.equals("requested fibre count", parts.length, 3);
  const points = parts.flatMap((part) =>
    part.geometry.type === "mesh" ? part.geometry.mesh.positions : [],
  );
  TestValidator.predicate(
    "resident brow geometry",
    points.length > 0 && points.every(Number.isFinite),
  );
  let clear = true;
  for (let i = 0; i < points.length; i += 3) {
    const distance =
      (1000 * (points[i + 2] - 0.5 * points[i] - 0.3 * points[i + 1])) /
      Math.sqrt(1.34);
    clear &&= distance >= profile.clearance - 1e-6;
  }
  TestValidator.predicate("normal clearance on sloping skin", clear);
  const moved = {
    ...skin,
    positions: skin.positions.map((p) => [p[0] + 30, p[1] - 20, p[2] + 5]),
  };
  const translated = buildPortraitEyebrow(moved, binding, 3, profile).flatMap(
    (part) =>
      part.geometry.type === "mesh" ? part.geometry.mesh.positions : [],
  );
  TestValidator.predicate(
    "translation follows the host",
    translated.every((value, i) =>
      nclose(value, points[i] + [0.03, -0.02, 0.005][i % 3], 1e-8),
    ),
  );
  TestValidator.equals("input skin retained", skin, before);
  const right = buildPortraitEyebrow(skin, { ...binding, side: "right" }, 1);
  TestValidator.equals(
    "side-owned identities",
    [parts[0].id, right[0].id],
    ["left-brow-hair-0", "right-brow-hair-0"],
  );
  TestValidator.equals(
    "disabled brow",
    buildPortraitEyebrow(
      { positions: [], indices: [], groups: [] },
      { side: "left", upper: [], lower: [] },
      0,
    ),
    [],
  );
  for (const bad of [
    { ...binding, side: "front" as "left" },
    { ...binding, upper: [6] },
    { ...binding, lower: [4] },
    { ...binding, lower: [-1, 5] },
    { ...binding, upper: [6, 99] },
    { ...binding, upper: [6, 0.5] },
  ])
    TestValidator.predicate(
      "invalid binding refuses",
      throwsError(() => buildPortraitEyebrow(skin, bad, 1), "boundaries"),
    );
  TestValidator.predicate(
    "zero skin path refuses",
    throwsError(
      () =>
        buildPortraitEyebrow(skin, { ...binding, upper: binding.lower }, 1, {
          ...profile,
          outwardBend: 0,
        }),
      "nonzero path",
    ),
  );
  TestValidator.predicate(
    "unsupported surface refuses",
    throwsError(
      () =>
        buildPortraitEyebrow(skin, binding, 1, { ...profile, outwardBend: 50 }),
      "supporting skin",
    ),
  );
};
