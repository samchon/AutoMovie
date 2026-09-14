import { refinePortraitSkinBridge } from "@automovie/human/geometry/refinePortraitSkinBridge";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Reserved skin retains original-surface samples and its outer perimeter.
 * Scenarios:
 * 1. A rectangular two-triangle patch gets two interior height witnesses;
 *    retriangulation joins the two centroids rather than keeping valence-three
 *    fans, keeps positive area and the same four boundary edges.
 * 2. Empty input is empty, one triangle keeps its perimeter, and nonfinite
 *    original-surface depth refuses without changing caller buffers. Invalid
 *    chart/indices refuse; scaling by 1e150 preserves the planar triangulation.
 */
export const test_subject_sampled_skin_bridge = (): void => {
  const points = [
      [0, 0, 0],
      [4, 0, 0],
      [4, 2, 0],
      [0, 2, 0],
    ],
    indices = [0, 1, 2, 0, 2, 3];
  const source = JSON.stringify({ points, indices });
  const result = refinePortraitSkinBridge(points, indices, (x, y) => x + y);
  TestValidator.equals(
    "two original-surface witnesses",
    result.positions.length,
    6,
  );
  for (const p of result.positions.slice(4))
    TestValidator.predicate(
      "height oracle",
      Math.abs(p[2] - p[0] - p[1]) < 1e-12,
    );
  const edges = new Map<string, number>();
  let area = 0;
  for (let i = 0; i < result.indices.length; i += 3) {
    const ids = result.indices.slice(i, i + 3),
      [a, b, c] = ids.map((id) => result.positions[id]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    TestValidator.predicate("positive triangles", cross > 0);
    area += cross / 2;
    for (let e = 0; e < 3; e++) {
      const edge = [ids[e], ids[(e + 1) % 3]].sort((a, b) => a - b).join("/");
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  TestValidator.predicate("area preserved", Math.abs(area - 8) < 1e-12);
  TestValidator.equals(
    "Delaunay joins the interior samples",
    edges.get("4/5"),
    2,
  );
  TestValidator.equals(
    "same four boundary edges",
    [...edges]
      .filter(([, count]) => count === 1)
      .map(([edge]) => edge)
      .sort((a, b) => a.localeCompare(b)),
    ["0/1", "0/3", "1/2", "2/3"],
  );
  TestValidator.equals(
    "caller retained",
    JSON.stringify({ points, indices }),
    source,
  );
  TestValidator.equals(
    "empty annulus",
    refinePortraitSkinBridge([], [], () => 0),
    { positions: [], indices: [] },
  );
  TestValidator.equals(
    "single triangle",
    refinePortraitSkinBridge(points, [0, 1, 2], () => 2).indices.length,
    9,
  );
  TestValidator.predicate(
    "bad depth",
    throwsError(() => refinePortraitSkinBridge(points, indices, () => NaN)),
  );
  TestValidator.equals(
    "large finite chart retains triangulation",
    refinePortraitSkinBridge(
      points.map((p) => p.map((v) => v * 1e150)),
      indices,
      () => 0,
    ).indices,
    result.indices,
  );
  for (const bad of [
    [0, 1],
    [0, 1, 4],
    [0, 1, -1],
    [0, 1, 0.5],
    [0, 2, 1],
    [0, 0, 1],
  ])
    TestValidator.predicate(
      "invalid triangles",
      throwsError(() => refinePortraitSkinBridge(points, bad, () => 0)),
    );
  for (const bad of [[[0, 0]], [[NaN, 0, 0]], [[0, Infinity, 0]]])
    TestValidator.predicate(
      "invalid chart",
      throwsError(() => refinePortraitSkinBridge(bad, [], () => 0)),
    );
  TestValidator.equals(
    "isolated origin",
    refinePortraitSkinBridge([[0, 0, 0]], [], () => 0),
    { positions: [[0, 0, 0]], indices: [] },
  );
  TestValidator.predicate(
    "unrepresentable interior",
    throwsError(
      () =>
        refinePortraitSkinBridge(
          [
            [0, 0, 0],
            [Number.MIN_VALUE, 0, 0],
            [0, Number.MIN_VALUE, 0],
          ],
          [0, 1, 2],
          () => 0,
        ),
      "representable XY",
    ),
  );
};
