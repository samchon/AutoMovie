import { applyPortraitSurfaceLayers } from "@automovie/human/geometry/portraitSurface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The real surface assembler deforms newly inserted samples and preserves rims.
 *
 * Scenarios:
 * 1. A coarse 8 mm square has no interior vertex until local 3 mm sampling.
 *    Its inserted centre receives exactly 0.1 mm relief; all rims stay fixed.
 * 2. An empty sampling layer cannot refine another layer's geometry. Layer
 *    permutations retain both geometry and original input coordinates.
 */
export const test_subject_skin_surface_sampling = (): void => {
  const mesh = {
    positions: [
      [-4, -4, 0],
      [4, -4, 0],
      [4, 4, 0],
      [-4, 4, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    groups: [0, 0],
  };
  const before = structuredClone(mesh),
    field = {
      center: { x: 0, y: 0, z: 0 },
      radius: { x: 0.01, y: 0.01, z: 0.01 },
      displacement: { x: 0, y: 0, z: 0.0001 },
      stretch: { x: 0, y: 0, z: 0 },
    };
  const ordinary = { id: "ordinary", fields: () => [field] },
    sampled = { id: "sampled", sampleSpacing: 3, fields: () => [field] },
    empty = { id: "empty", sampleSpacing: 1, fields: () => [] };
  const a = applyPortraitSurfaceLayers(mesh, [sampled, empty]);
  TestValidator.predicate(
    "new interior samples",
    a.positions.length > mesh.positions.length,
  );
  const centre = a.positions.find((p) => nclose(p[0], 0) && nclose(p[1], 0));
  TestValidator.predicate(
    "inserted centre gets relief",
    centre !== undefined && nclose(centre[2], 0.1),
  );
  for (const point of a.positions.filter(
    (p) => Math.abs(p[0]) === 4 || Math.abs(p[1]) === 4,
  ))
    TestValidator.equals("all refined rim samples fixed", point[2], 0);
  const b = applyPortraitSurfaceLayers(mesh, [ordinary, empty]);
  TestValidator.equals(
    "empty layer does not subdivide foreign fields",
    b.indices,
    mesh.indices,
  );
  TestValidator.equals(
    "stable layer order",
    a,
    applyPortraitSurfaceLayers(mesh, [empty, sampled]),
  );
  TestValidator.equals("caller unchanged", mesh, before);
};
