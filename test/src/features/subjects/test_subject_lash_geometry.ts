import { buildPortraitEyelash } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyelashFixture,
  portraitEyelashRingCenter,
} from "../internal/portraitEyelashFixture";
import { nclose, vclose } from "../internal/predicates";

/**
 * Lash length is an arc-length control independent of curl and radius.
 *
 * Scenarios:
 * 1. A straight anterior eight-mm centreline retains its root and tapered radii.
 * 2. A quarter circle ends at two radii from its tangent origin; zero and tiny
 *    curls agree, and signed negative curl turns downwards.
 * 3. Side mirroring changes only the fan sign, and growth variation shortens
 *    index zero by the declared fraction without mutating caller input.
 */
export const test_subject_lash_geometry = (): void => {
  const profile = portraitEyelashFixture(),
    origin = { x: 2, y: 3, z: 4 };
  const before = structuredClone(profile);
  const straight = buildPortraitEyelash(origin, profile, "left", 0.5, 0);
  TestValidator.predicate(
    "root centre",
    vclose(portraitEyelashRingCenter(straight, 0), origin),
  );
  TestValidator.predicate(
    "straight endpoint",
    vclose(portraitEyelashRingCenter(straight, 12), { x: 2, y: 3, z: 12 }),
  );
  for (const row of [0, 6, 12]) {
    const center = portraitEyelashRingCenter(straight, row),
      radius = 0.06 * (1 - (0.9 * row) / 12);
    TestValidator.predicate(
      "ring radius",
      Array.from({ length: 8 }, (_, i) => {
        const at = (row * 9 + i) * 3;
        return nclose(
          Math.hypot(
            straight.positions[at] - center.x,
            straight.positions[at + 1] - center.y,
            straight.positions[at + 2] - center.z,
          ),
          radius,
          1e-10,
        );
      }).every(Boolean),
    );
  }
  const quarter = buildPortraitEyelash(
    origin,
    { ...profile, curl: 90 },
    "left",
    0.5,
    0,
  );
  TestValidator.predicate(
    "quarter-circle endpoint",
    vclose(portraitEyelashRingCenter(quarter, 12), {
      x: 2,
      y: 3 + 16 / Math.PI,
      z: 4 + 16 / Math.PI,
    }),
  );
  const tiny = buildPortraitEyelash(
    origin,
    { ...profile, curl: 1e-10 },
    "left",
    0.5,
    0,
  );
  TestValidator.predicate(
    "stable near-zero arc",
    vclose(
      portraitEyelashRingCenter(tiny, 12),
      portraitEyelashRingCenter(straight, 12),
      1e-9,
    ),
  );
  const down = portraitEyelashRingCenter(
    buildPortraitEyelash(origin, { ...profile, curl: -60 }, "left", 0.5, 0),
    12,
  );
  TestValidator.predicate(
    "negative curl",
    nclose(down.y, 3 - 12 / Math.PI) &&
      nclose(down.z, 4 + (12 * Math.sqrt(3)) / Math.PI),
  );
  const left = buildPortraitEyelash(
    { x: 0, y: 0, z: 0 },
    { ...profile, fan: 60, elevation: 20, curl: 45 },
    "left",
    0.7,
    1,
  );
  const right = buildPortraitEyelash(
    { x: 0, y: 0, z: 0 },
    { ...profile, fan: 60, elevation: 20, curl: 45 },
    "right",
    0.7,
    1,
  );
  const a = portraitEyelashRingCenter(left, 12),
    b = portraitEyelashRingCenter(right, 12);
  TestValidator.predicate(
    "side fan",
    a.x > 0 && vclose(b, { x: -a.x, y: a.y, z: a.z }),
  );
  const short = buildPortraitEyelash(
    origin,
    { ...profile, variation: 0.5 },
    "left",
    0.5,
    0,
  );
  TestValidator.predicate(
    "half growth endpoint",
    vclose(portraitEyelashRingCenter(short, 12), { x: 2, y: 3, z: 8 }),
  );
  const corner = buildPortraitEyelash(origin, profile, "left", 0, 0);
  TestValidator.predicate(
    "canthal shortening",
    vclose(portraitEyelashRingCenter(corner, 12), { x: 2, y: 3, z: 7.6 }),
  );
  TestValidator.predicate(
    "finite unit normals",
    quarter.normals !== null &&
      Array.from({ length: quarter.normals.length / 3 }, (_, i) =>
        nclose(Math.hypot(...quarter.normals!.slice(i * 3, i * 3 + 3)), 1),
      ).every(Boolean),
  );
  TestValidator.equals("profile not mutated", profile, before);
};
