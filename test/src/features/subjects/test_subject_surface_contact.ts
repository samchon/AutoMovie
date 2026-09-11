import { measureAutoMovieMeshClearance } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { portraitDirectionalSurfaceTargets } from "../../subjects/portraitDirectionalContact";
import { throwsError } from "../internal/predicates";

/**
 * Shared triangle targets clear an interior support that vertex rays miss.
 * Scenarios:
 * 1. A small raised triangle lies inside a larger front face. All three corners
 *    advance by the independent one-unit deficit plus clearance.
 * 2. A shared corner takes the largest incident deficit; a clear and an empty
 *    support produces no target. Invalid clearance and output overflow refuse.
 */
export const test_subject_surface_contact = (): void => {
  const front = {
    positions: [-2, -2, 0, 2, -2, 0, 0, 2, 0],
    indices: null,
    normals: null,
    uvs: null,
    skin: null,
  };
  const back = {
    ...front,
    positions: [-0.2, -0.2, 1, 0.2, -0.2, 1, 0, 0.2, 1],
  };
  const targets = portraitDirectionalSurfaceTargets(
    front,
    back,
    { x: 0, y: 0, z: 1 },
    0.1,
  );
  TestValidator.equals(
    "all face corners own the interior deficit",
    targets.length,
    3,
  );
  for (const { target } of targets)
    TestValidator.predicate(
      "hand plane target",
      Math.abs(target.z - 1.1) < 1e-12,
    );
  const after = { ...front, positions: [...front.positions] };
  for (const { vertex, target } of targets)
    after.positions.splice(vertex * 3, 3, target.x, target.y, target.z);
  TestValidator.predicate(
    "complete face clears support",
    measureAutoMovieMeshClearance(after, back, "z")[0].minimum >= 0.1 - 1e-12,
  );
  TestValidator.equals(
    "already clear",
    portraitDirectionalSurfaceTargets(after, back, { x: 0, y: 0, z: 1 }),
    [],
  );
  TestValidator.equals(
    "no support",
    portraitDirectionalSurfaceTargets(
      front,
      { ...back, positions: [] },
      { x: 0, y: 0, z: 1 },
    ),
    [],
  );
  const shared = {
    ...front,
    indices: [0, 1, 2, 0, 2, 3],
    positions: [-2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2, 0],
  };
  const wedge = { ...back, positions: [-1, -1, 1, 1, -1, 1, 0, 1, 2] };
  const moved = portraitDirectionalSurfaceTargets(shared, wedge, {
    x: 0,
    y: 0,
    z: 1,
  });
  TestValidator.equals(
    "one target per shared vertex",
    new Set(moved.map((t) => t.vertex)).size,
    moved.length,
  );
  TestValidator.predicate(
    "shared maximum",
    moved.find((t) => t.vertex === 2)!.target.z >= 2 - 1e-12,
  );
  TestValidator.predicate(
    "invalid gap refuses",
    throwsError(() =>
      portraitDirectionalSurfaceTargets(front, back, { x: 0, y: 0, z: 1 }, -1),
    ),
  );
  const deep = {
    ...front,
    positions: front.positions.map((v, i) => (i % 3 === 2 ? -1e308 : v)),
  };
  const flat = {
    ...back,
    positions: back.positions.map((v, i) => (i % 3 === 2 ? 0 : v)),
  };
  TestValidator.predicate(
    "surface target overflow refuses",
    throwsError(
      () =>
        portraitDirectionalSurfaceTargets(
          deep,
          flat,
          { x: 0, y: 0, z: 1 },
          1e308,
        ),
      "finite coordinate",
    ),
  );
};
