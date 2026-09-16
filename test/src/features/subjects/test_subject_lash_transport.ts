import { buildPortraitEyelash } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyelashFixture,
  portraitEyelashRingCenter,
} from "../internal/portraitEyelashFixture";
import { nclose, throwsError, vclose } from "../internal/predicates";

/**
 * Lid-relative transport is a rigid turn about the already attached lash root.
 *
 * Scenarios:
 * 1. Parallel directions preserve exact geometry. A ninety-degree downward
 *    turn maps an eight-mm anterior strand to eight mm below its fixed root.
 * 2. Opposite motion turns upwards, unequal radial magnitudes do not stretch
 *    the strand, and rotated normals follow the same hand-derived quarter turn.
 * 3. Nonfinite, zero and antipodal directions refuse. Nearly antipodal and
 *    subnormal nonzero directions stay representable without an arbitrary flip.
 */
export const test_subject_lash_transport = (): void => {
  const root = { x: 12, y: 20, z: 30 },
    profile = portraitEyelashFixture(),
    from = { x: 0, y: 0, z: 2 };
  const build = (to: typeof root, basis = from) =>
    buildPortraitEyelash(root, profile, "left", 0.5, 0, { from: basis, to });
  const rest = buildPortraitEyelash(root, profile, "left", 0.5, 0);
  const down = build({ x: 0, y: -5, z: 0 });
  TestValidator.equals("parallel exact", build({ ...from, z: 8 }), rest);
  TestValidator.equals(
    "subnormal direction",
    build({ ...from, z: 1e-320 }),
    rest,
  );
  TestValidator.predicate(
    "fixed root",
    vclose(portraitEyelashRingCenter(down, 0), root),
  );
  TestValidator.predicate(
    "quarter-turn tip",
    vclose(portraitEyelashRingCenter(down, 12), { ...root, y: root.y - 8 }),
  );
  const up = build({ x: 0, y: 3, z: 0 });
  TestValidator.predicate(
    "opposite motion",
    vclose(portraitEyelashRingCenter(up, 12), { ...root, y: root.y + 8 }),
  );
  for (let i = 0; i < down.normals!.length; i += 3)
    TestValidator.predicate(
      "normal quarter turn",
      vclose(
        {
          x: down.normals![i],
          y: down.normals![i + 1],
          z: down.normals![i + 2],
        },
        {
          x: rest.normals![i],
          y: -rest.normals![i + 2],
          z: rest.normals![i + 1],
        },
        1e-8,
      ),
    );
  const almost = build({ x: 0, y: -1e-9, z: -2 });
  const tip = portraitEyelashRingCenter(almost, 12);
  TestValidator.predicate(
    "nearly antipodal length",
    nclose(Math.hypot(tip.x - root.x, tip.y - root.y, tip.z - root.z), 8),
  );
  for (const bad of [
    { x: 0, y: 0, z: 0 },
    { x: NaN, y: 1, z: 0 },
    { x: 0, y: Infinity, z: 0 },
  ]) {
    TestValidator.predicate(
      "invalid current direction",
      throwsError(() => build(bad), "radial"),
    );
    TestValidator.predicate(
      "invalid observed direction",
      throwsError(() => build(from, bad), "radial"),
    );
  }
  TestValidator.predicate(
    "ambiguous half-turn refuses",
    throwsError(() => build({ x: 0, y: 0, z: -2 }), "Antipodal"),
  );
  TestValidator.equals("profile unchanged", profile, portraitEyelashFixture());
};
