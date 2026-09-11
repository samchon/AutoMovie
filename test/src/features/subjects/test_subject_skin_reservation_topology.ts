import { TestValidator } from "@nestia/e2e";

import { reservePortraitSkin } from "../../subjects/reservePortraitSkin";
import { throwsError } from "../internal/predicates";

/**
 * Region growth on a closed handle can pinch or acquire several boundaries.
 * Neither state is an admissible skin annulus, even when edge winding is valid.
 *
 * Scenarios:
 * 1. A 3x3 periodic torus reaches a pinched perimeter; a 6x6 torus reaches
 *    multiple disjoint boundary cycles. An oversized triangular seam cannot
 *    fit either and must refuse after finite growth without changing the host.
 */
export const test_subject_skin_reservation_topology = (): void => {
  for (const count of [3, 6]) {
    const positions: number[][] = [],
      indices: number[] = [];
    for (let u = 0; u < count; u++)
      for (let v = 0; v < count; v++) {
        const a = (2 * Math.PI * u) / count,
          b = (2 * Math.PI * v) / count;
        positions.push([
          (3 + Math.cos(b)) * Math.cos(a),
          (3 + Math.cos(b)) * Math.sin(a),
          Math.sin(b),
        ]);
        const i = u * count + v,
          j = ((u + 1) % count) * count + v;
        const k = ((u + 1) % count) * count + ((v + 1) % count),
          l = u * count + ((v + 1) % count);
        indices.push(i, j, k, i, k, l);
      }
    const host = { positions, indices, viewRay: [0, 0, 1] };
    const before = structuredClone(host);
    TestValidator.predicate(
      "closed handle has no containing disk",
      throwsError(
        () =>
          reservePortraitSkin(host, indices.slice(0, 3), [
            [100, 0, 0],
            [0, 100, 0],
            [-100, -100, 0],
          ]),
        "cannot reserve",
      ),
    );
    TestValidator.equals("failed growth is immutable", host, before);
  }
};
