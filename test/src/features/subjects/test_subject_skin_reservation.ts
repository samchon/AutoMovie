import { TestValidator } from "@nestia/e2e";

import { reservePortraitSkin } from "../../subjects/reservePortraitSkin";
import { createPortraitReservationHost } from "../internal/portraitReservation";
import { throwsError } from "../internal/predicates";

/**
 * A reserved skin patch grows with the proposed component rather than pulling
 * its old aperture across the surrounding vertices.
 *
 * Scenarios:
 * 1. Radius-two and radius-four seams inside radius-one/three/six host rings
 *    select the independently known next containing ring and leave inputs exact.
 * 2. A seam touching radius three requires the next ring; a shrunken seam still
 *    frees its original IDs by reserving the next ring rather than moving host.
 * 3. Reversed face and boundary winding gives the same selected region. A seam
 *    beyond the complete host and invalid XYZ target populations refuse.
 */
export const test_subject_skin_reservation = (): void => {
  const host = createPortraitReservationHost();
  const before = structuredClone(host),
    inner = [1, 2, 3, 4];
  for (const [radius, boundary, faceCount] of [
    [0.5, [5, 6, 7, 8], 12],
    [2, [5, 6, 7, 8], 12],
    [3, [9, 10, 11, 12], 20],
    [4, [9, 10, 11, 12], 20],
  ] as const) {
    const targets = inner.map((id) =>
      host.positions[id].map((v) => v * radius),
    );
    const reservation = reservePortraitSkin(host, inner, targets);
    TestValidator.equals(
      "first containing ring",
      [...reservation.boundary].sort((a, b) => a - b),
      [...boundary],
    );
    TestValidator.equals(
      "original faces reserved",
      reservation.faces.length,
      faceCount,
    );
  }
  TestValidator.equals("host unchanged", host, before);
  const reversed = {
    ...host,
    indices: host.indices.flatMap((_v, i) =>
      i % 3 ? [] : [host.indices[i], host.indices[i + 2], host.indices[i + 1]],
    ),
  };
  const ring = [...inner].reverse();
  const backward = reservePortraitSkin(
    reversed,
    ring,
    ring.map((id) => host.positions[id].map((v) => v * 2)),
  );
  TestValidator.equals(
    "winding-independent reservation",
    [...backward.boundary].sort((a, b) => a - b),
    [5, 6, 7, 8],
  );
  TestValidator.predicate(
    "no containing ring",
    throwsError(
      () =>
        reservePortraitSkin(
          host,
          inner,
          inner.map((id) => host.positions[id].map((v) => v * 8)),
        ),
      "cannot reserve",
    ),
  );
  for (const targets of [
    [],
    [[0, 0, 0]],
    inner.map(() => [0, 0]),
    inner.map(() => [0, NaN, 0]),
  ])
    TestValidator.predicate(
      "invalid target population",
      throwsError(
        () => reservePortraitSkin(host, inner, targets),
        "finite XYZ",
      ),
    );
};
