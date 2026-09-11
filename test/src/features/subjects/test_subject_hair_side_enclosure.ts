import { TestValidator } from "@nestia/e2e";

import { buildPortraitHairProxy } from "../../subjects/generated-korean-girl-01/hairProxy";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Ear clearance owns a lateral expansion, not a taller or deeper hairstyle.
 *
 * Scenarios:
 * 1. A wide side point requires a wider cap while every emitted Y and Z stays
 *    unchanged. Empty and already enclosed side inputs retain the basic mesh.
 * 2. Nonfinite points and a point outside the fixed YZ ellipsoid refuse; an
 *    arbitrarily large but finite lateral requirement also refuses metric overflow.
 */
export const test_subject_hair_side_enclosure = (): void => {
  const baseline = buildPortraitHairProxy()[0].geometry.mesh;
  const side = buildPortraitHairProxy(undefined, undefined, [[110, 25, -32]])[0]
    .geometry.mesh;
  TestValidator.predicate(
    "side point is enclosed",
    Math.max(...side.positions.filter((_v, i) => i % 3 === 0)) > 0.11,
  );
  TestValidator.predicate(
    "height and depth keep their owner",
    side.positions.every(
      (v, i) => i % 3 === 0 || nclose(v, baseline.positions[i], 1e-12),
    ),
  );
  for (const attachments of [[], [[50, 25, -32]]])
    TestValidator.equals(
      "unneeded side expansion is identity",
      buildPortraitHairProxy(undefined, undefined, attachments)[0].geometry
        .mesh,
      baseline,
    );
  for (const attachments of [
    [[NaN, 0, 0]],
    [[0, 0]],
    [[110, 148, -32]],
    [[110, 149, -32]],
    [[1e45, 25, -32]],
  ])
    TestValidator.predicate(
      "invalid side envelope refuses",
      throwsError(
        () => buildPortraitHairProxy(undefined, undefined, attachments),
        "Hair",
      ),
    );
};
