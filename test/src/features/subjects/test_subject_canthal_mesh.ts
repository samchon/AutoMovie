import {
  Vector3,
  mergeAutoMovieMeshes,
  validateMeshTopology,
} from "@automovie/engine";
import {
  buildPortraitCanthalMesh,
  createPortraitCanthalIntersection,
} from "@automovie/human/geometry/portraitCanthalMesh";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * A sampled optical sphere and canthal supports share one external manifold.
 * The independent octahedron case gives a planar support depth of 0.6 at x=4;
 * convex half-spaces, rather than a snapshot of emitted triangles, check the
 * general construction. All coordinates below are construction millimetres.
 *
 * Scenarios:
 * 1. Opposite external, overlapping, interior and successively hidden anchors
 *    retain an outward closed hull containing both anchors and the original body.
 * 2. The visible spherical region plus tissue exactly forms that manifold,
 *    with finite unit normals and no unused vertices after tissue extraction.
 * 3. Actual triangle queries hit the known plane and both fixed endpoints in
 *    frontal and oblique views; an uncovered ray and invalid anchors refuse.
 */
export const test_subject_canthal_mesh = (): void => {
  const p = (x: number, y: number, z = 0) => ({ x, y, z });
  const sphere = { center: p(0, 0), radius: 3 };
  for (const anchors of [
    [p(-5, 0), p(5, 0)],
    [p(5, 0), p(5, 2)],
    [p(0, 0), p(1, 0)],
    [p(5, 0), p(6, 0)],
  ]) {
    const before = structuredClone({ sphere, anchors });
    const result = buildPortraitCanthalMesh(sphere, anchors, 4, 2);
    const mesh = result.surface;
    const point = (id: number) =>
      p(
        mesh.positions[3 * id],
        mesh.positions[3 * id + 1],
        mesh.positions[3 * id + 2],
      );
    const original = Array.from(
      { length: result.globe.positions.length / 3 },
      (_, i) =>
        p(
          ...(result.globe.positions.slice(3 * i, 3 * i + 3) as [
            number,
            number,
            number,
          ]),
        ),
    );
    for (let i = 0; i < mesh.indices!.length; i += 3) {
      const [a, b, c] = mesh.indices!.slice(i, i + 3).map(point);
      const normal = Vector3.cross(
        Vector3.subtract(b, a),
        Vector3.subtract(c, a),
      );
      TestValidator.predicate(
        "nonzero outward face",
        Vector3.dot(normal, a) > 0,
      );
      TestValidator.predicate(
        "convex hull contains its complete source",
        [...original, ...anchors].every(
          (q) => Vector3.dot(normal, Vector3.subtract(q, a)) <= 1e-9,
        ),
      );
    }
    TestValidator.predicate(
      "closed oriented hull",
      validateMeshTopology({ mesh, expectClosed: true }).success,
    );
    TestValidator.predicate(
      "drawn tissue partition closes once",
      validateMeshTopology({
        mesh: mergeAutoMovieMeshes([result.exposed, result.extension]),
        expectClosed: true,
      }).success,
    );
    TestValidator.predicate(
      "optical body remains radius three",
      original.every((q) => nclose(Vector3.length(q), 3)),
    );
    for (const part of [result.exposed, result.extension, result.surface]) {
      TestValidator.equals(
        "only used vertices survive",
        new Set(part.indices!).size,
        part.positions.length / 3,
      );
      TestValidator.predicate(
        "unit normal field",
        Array.from({ length: part.normals!.length / 3 }, (_, i) =>
          Math.hypot(...part.normals!.slice(i * 3, i * 3 + 3)),
        ).every((length) => nclose(length, 1)),
      );
    }
    TestValidator.equals("input ownership", { sphere, anchors }, before);
  }
  const result = buildPortraitCanthalMesh(sphere, [p(-5, 0), p(5, 0)], 4, 2);
  const query = createPortraitCanthalIntersection(result.surface, p(0, 0, 1));
  TestValidator.predicate(
    "independent planar depth",
    nclose(query(p(4, 0, 20)).z, 0.6),
  );
  TestValidator.predicate(
    "same hit from behind",
    nclose(query(p(4, 0, -20)).z, 0.6),
  );
  TestValidator.predicate(
    "outside projection refuses",
    throwsError(() => query(p(6, 0)), "misses"),
  );
  for (const offset of [0, 10.7, -31.3]) {
    const center = p(offset, 20.1, 30.3);
    const anchors = [p(offset - 5, 20.1, 30.3), p(offset + 5, 20.1, 30.3)];
    const translated = buildPortraitCanthalMesh(
      { center, radius: 3 },
      anchors,
      12,
      8,
    );
    for (const direction of [p(0, 0, 1), p(0.1, 0.2, 1)]) {
      const hit = createPortraitCanthalIntersection(
        translated.surface,
        direction,
      );
      TestValidator.predicate(
        "transformed apex remains covered",
        anchors.every(
          (q) => Vector3.length(Vector3.subtract(hit(q), q)) < 1e-9,
        ),
      );
    }
  }
  for (const anchors of [[p(0, 0)], [p(NaN, 0), p(5, 0)]])
    TestValidator.predicate(
      "anchor admission",
      throwsError(
        () => buildPortraitCanthalMesh(sphere, anchors, 4, 2),
        "two finite anchors",
      ),
    );
};
