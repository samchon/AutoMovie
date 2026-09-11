import { TestValidator } from "@nestia/e2e";

import { portraitSkinAnnulus } from "../../subjects/reservePortraitSkin";
import { createPortraitReservationHost } from "../internal/portraitReservation";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The annulus connects actual 3D identities using the engine's admitted planar
 * triangulation, so different sampling counts do not need a perimeter zipper.
 *
 * Scenarios:
 * 1. Radius-six/radius-one diamonds enclose area 72 minus 2 square mm, despite
 *    nonplanar depths; reversing both loops reverses every triangle's XY sign.
 * 2. A triangular inner ring proves unequal populations; crossing, mismatched
 *    winding, missing vertices and malformed XYZ fail without changing positions.
 */
export const test_subject_skin_annulus = (): void => {
  const { positions } = createPortraitReservationHost();
  positions[1][2] = 10;
  positions[10][2] = -20;
  const before = structuredClone(positions),
    outer = [9, 10, 11, 12],
    inner = [1, 2, 3, 4];
  for (const reverse of [false, true]) {
    const faces = portraitSkinAnnulus(
      positions,
      reverse ? [...outer].reverse() : outer,
      reverse ? [...inner].reverse() : inner,
    );
    const areas: number[] = [];
    for (let i = 0; i < faces.length; i += 3) {
      const [a, b, c] = faces.slice(i, i + 3).map((id) => positions[id]);
      areas.push(
        ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2,
      );
    }
    TestValidator.predicate(
      "complete annular area",
      nclose(
        areas.reduce((a, b) => a + b, 0),
        reverse ? -70 : 70,
      ),
    );
    TestValidator.predicate(
      "consistent projected orientation",
      areas.every((area) => (reverse ? area < 0 : area > 0)),
    );
    TestValidator.predicate(
      "resident identities",
      faces.every((id) => [...inner, ...outer].includes(id)),
    );
  }
  TestValidator.equals("depth and positions retained", positions, before);
  TestValidator.equals(
    "unequal rings",
    portraitSkinAnnulus(positions, outer, [1, 2, 3]).length,
    21,
  );
  TestValidator.predicate(
    "opposite winding",
    throwsError(
      () => portraitSkinAnnulus(positions, outer, [...inner].reverse()),
      "matching projected winding",
    ),
  );
  TestValidator.predicate(
    "crossed loop",
    throwsError(() => portraitSkinAnnulus(positions, [9, 11, 10, 12], inner)),
  );
  for (const points of [
    [],
    positions.map(() => [0, 0]),
    positions.map(() => [0, 0, NaN]),
  ])
    TestValidator.predicate(
      "invalid resident coordinates",
      throwsError(
        () => portraitSkinAnnulus(points, outer, inner),
        "finite resident",
      ),
    );
  TestValidator.equals(
    "failed admission leaves source exact",
    positions,
    before,
  );
};
