import { createPortraitDirectionalIntersection } from "@automovie/human/geometry/portraitDirectionalContact";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * A directional surface intersection retains the original query projection.
 * Expectations come from a unit triangle in z=2 and a turned copy in x=2,
 * with all coordinates in engine metres and no portrait fixture.
 *
 * Scenarios:
 * 1. Points before, on and behind a plane reach its foremost triangle; the
 *    boundary vertices remain covered and an outside projection returns null.
 * 2. A sideways ray and a nonunit direction use the same distance convention.
 * 3. A nonfinite query, zero direction and malformed mesh refuse, while later
 *    mutations of the caller's positions cannot move an existing query.
 */
export const test_subject_directional_intersection = (): void => {
  const mesh = {
    positions: [0, 0, 2, 1, 0, 2, 0, 1, 2],
    indices: [0, 1, 2],
    normals: null,
    uvs: null,
    skin: null,
  };
  const query = createPortraitDirectionalIntersection(mesh, {
    x: 0,
    y: 0,
    z: 4,
  });
  for (const z of [-5, 2, 7]) {
    const point = { x: 0.25, y: 0.25, z };
    const before = { ...point };
    const hit = query(point);
    TestValidator.predicate(
      "known plane",
      hit !== null &&
        nclose(hit.x, 0.25) &&
        nclose(hit.y, 0.25) &&
        nclose(hit.z, 2),
    );
    TestValidator.equals("point remains owned", point, before);
  }
  TestValidator.equals("boundary vertex", query({ x: 1, y: 0, z: 2 }), {
    x: 1,
    y: 0,
    z: 2,
  });
  TestValidator.equals(
    "outside returns null",
    query({ x: 2, y: 0, z: 2 }),
    null,
  );
  const side = createPortraitDirectionalIntersection(
    { ...mesh, positions: [2, 0, 0, 2, 1, 0, 2, 0, 1] },
    { x: 1, y: 0, z: 0 },
  );
  TestValidator.equals("sideways plane", side({ x: 7, y: 0, z: 0 }), {
    x: 2,
    y: 0,
    z: 0,
  });
  mesh.positions.fill(20);
  TestValidator.equals("owned mesh snapshot", query({ x: 0, y: 0, z: 0 }), {
    x: 0,
    y: 0,
    z: 2,
  });
  TestValidator.predicate(
    "nonfinite query",
    throwsError(() => query({ x: NaN, y: 0, z: 0 }), "point must be finite"),
  );
  TestValidator.predicate(
    "zero direction",
    throwsError(
      () => createPortraitDirectionalIntersection(mesh, { x: 0, y: 0, z: 0 }),
      "nonzero direction",
    ),
  );
  TestValidator.predicate(
    "incomplete mesh",
    throwsError(
      () =>
        createPortraitDirectionalIntersection(
          { ...mesh, positions: [0] },
          { x: 0, y: 0, z: 1 },
        ),
      "complete finite mesh",
    ),
  );
};
