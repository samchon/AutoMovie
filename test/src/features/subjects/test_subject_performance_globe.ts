import { Vector3 } from "@automovie/engine";
import { buildPortraitPerformanceGlobe } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * A resident globe has a closed outward-oriented spherical surface, including both poles.
 *
 * Scenarios:
 * 1. Minimal and ordinary sampling retain radius, outward nonzero faces, and exactly two uses per edge.
 * 2. Maximum sampling bounds are admitted; nonfinite spheres and adjacent invalid counts refuse.
 */
export const test_subject_performance_globe = (): void => {
  const sphere = { center: { x: 2, y: 3, z: 4 }, radius: 5 };
  for (const [columns, rows] of [
    [3, 2],
    [12, 8],
  ]) {
    const mesh = buildPortraitPerformanceGlobe(sphere, columns, rows);
    const point = (id: number) => ({
      x: mesh.positions[3 * id],
      y: mesh.positions[3 * id + 1],
      z: mesh.positions[3 * id + 2],
    });
    for (let id = 0; id < mesh.positions.length / 3; id++)
      TestValidator.predicate(
        "constant radius",
        nclose(Vector3.length(Vector3.subtract(point(id), sphere.center)), 5),
      );
    const edges = new Map<string, number>();
    for (let i = 0; i < mesh.indices!.length; i += 3) {
      const ids = mesh.indices!.slice(i, i + 3),
        [a, b, c] = ids.map(point);
      const normal = Vector3.cross(
        Vector3.subtract(b, a),
        Vector3.subtract(c, a),
      );
      TestValidator.predicate(
        "outward nondegenerate face",
        Vector3.dot(normal, Vector3.subtract(a, sphere.center)) > 0,
      );
      for (let corner = 0; corner < 3; corner++) {
        const key = [ids[corner], ids[(corner + 1) % 3]]
          .sort((a, b) => a - b)
          .join(":");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    TestValidator.predicate(
      "closed manifold edges",
      [...edges.values()].every((count) => count === 2),
    );
  }
  buildPortraitPerformanceGlobe(sphere, 512, 2);
  buildPortraitPerformanceGlobe(sphere, 3, 512);
  for (const [columns, rows] of [
    [2, 2],
    [3, 1],
    [513, 2],
    [3, 513],
    [3.1, 2],
    [3, 2.1],
    [NaN, 2],
    [3, Infinity],
  ])
    TestValidator.predicate(
      "sampling guard",
      throwsError(() => buildPortraitPerformanceGlobe(sphere, columns, rows)),
    );
  for (const radius of [0, -1, NaN, Infinity])
    TestValidator.predicate(
      "radius guard",
      throwsError(() =>
        buildPortraitPerformanceGlobe({ ...sphere, radius }, 3, 2),
      ),
    );
  TestValidator.predicate(
    "centre guard",
    throwsError(() =>
      buildPortraitPerformanceGlobe(
        { ...sphere, center: { ...sphere.center, x: NaN } },
        3,
        2,
      ),
    ),
  );
};
