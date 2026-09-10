import { TestValidator } from "@nestia/e2e";

import { buildPortraitHairProxy } from "../../subjects/generated-korean-girl-01/hairProxy";
import { throwsError } from "../internal/predicates";

/**
 * The coarse cap must adapt to its supplied host instead of retaining another
 * head's dimensions. This numerical envelope check is separate from the actual
 * multi-view inspection of cap panels and the exposed ear.
 * Scenarios:
 * 1. A taller/wider scalp expands the cap; the neutral path and caller data stay
 *    owned, and all sampled buffers remain finite construction-to-metre output.
 * 2. Invalid coordinates and unrepresentable metric envelopes refuse.
 */
export const test_subject_hair_attachment = (): void => {
  const host = [
      [0, 180, -32],
      [-100, 60, -32],
      [100, 60, -32],
    ],
    saved = structuredClone(host);
  const mesh = buildPortraitHairProxy(host)[0].geometry;
  if (mesh.type !== "mesh") throw new Error("Expected resident hair.");
  TestValidator.predicate(
    "cap encloses the supplied crown",
    Math.max(...mesh.mesh.positions.filter((_v, i) => i % 3 === 1)) > 0.18,
  );
  TestValidator.predicate(
    "finite fitted panels",
    mesh.mesh.positions.every(Number.isFinite) &&
      mesh.mesh.normals!.every(Number.isFinite),
  );
  TestValidator.equals("host ownership", host, saved);
  TestValidator.equals(
    "empty host retains authored context",
    buildPortraitHairProxy([]),
    buildPortraitHairProxy(),
  );
  for (const points of [[[NaN, 20, 0]], [[0, 20]], [[1e45, 40, 0]]])
    TestValidator.predicate(
      "invalid host refuses",
      throwsError(() => buildPortraitHairProxy(points), "Hair attachment"),
    );
};
