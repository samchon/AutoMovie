import { TestValidator } from "@nestia/e2e";

import { createPortraitDirectionalContact } from "../../subjects/portraitDirectionalContact";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Directional contact uses resident triangles and preserves ray projection.
 *
 * Scenarios:
 * 1. A plane at Z=2 mm admits frontal and diagonal rays with independent contact
 *    arithmetic. Already-clear and missed rays preserve their input identities.
 * 2. A Y-normal plane exercises the alternate frame guide, and a reversed ray
 *    selects the same surface from behind. Caller mutation does not move it.
 * 3. Zero/nonfinite directions, negative clearance, malformed positions and
 *    nonfinite samples refuse rather than producing unbounded contact.
 */
export const test_subject_directional_contact = (): void => {
  const mesh = {
    positions: [-0.01, -0.01, 0.002, 0.01, -0.01, 0.002, 0, 0.01, 0.002],
    indices: [0, 1, 2],
    normals: null,
    uvs: null,
    skin: null,
  };
  const contact = createPortraitDirectionalContact(
    mesh,
    { x: 0, y: 0, z: 1 },
    0.0003,
  );
  const point = { x: 0, y: 0, z: 0 },
    result = contact(point);
  TestValidator.predicate(
    "empty surface supplies no contact",
    createPortraitDirectionalContact(
      { ...mesh, positions: [], indices: [] },
      { x: 0, y: 0, z: 1 },
    )(point) === point,
  );
  TestValidator.predicate(
    "frontal contact clearance",
    nclose(result.x, 0) &&
      nclose(result.y, 0) &&
      nclose(result.z, 0.0023, 1e-12),
  );
  const diagonal = createPortraitDirectionalContact(
    mesh,
    { x: 1, y: 0, z: 1 },
    0.0003,
  )(point);
  TestValidator.predicate(
    "diagonal ray oracle",
    nclose(diagonal.x, 0.002 + 0.0003 / Math.sqrt(2), 1e-12) &&
      nclose(diagonal.z, diagonal.x, 1e-12),
  );
  for (const retained of [
    { x: 0, y: 0, z: 0.003 },
    { x: 0, y: 0, z: 0.0023 },
    { x: 0.02, y: 0, z: 0 },
  ])
    TestValidator.predicate(
      "clear and missed points retain identity",
      contact(retained) === retained,
    );
  const yMesh = {
    ...mesh,
    positions: [-0.01, 0.002, -0.01, 0.01, 0.002, -0.01, 0, 0.002, 0.01],
  };
  TestValidator.predicate(
    "alternate frame guide",
    nclose(
      createPortraitDirectionalContact(yMesh, { x: 0, y: 1, z: 0 })(point).y,
      0.002,
      1e-12,
    ),
  );
  TestValidator.predicate(
    "opposite direction",
    nclose(
      createPortraitDirectionalContact(
        mesh,
        { x: 0, y: 0, z: -1 },
        0.0003,
      )({ x: 0, y: 0, z: 0.004 }).z,
      0.0017,
      1e-12,
    ),
  );
  mesh.positions[2] = 0.004;
  TestValidator.predicate(
    "compiled surface owns positions",
    nclose(contact(point).z, 0.0023, 1e-12),
  );
  for (const direction of [
    { x: 0, y: 0, z: 0 },
    { x: NaN, y: 0, z: 1 },
  ])
    TestValidator.predicate(
      "invalid direction",
      throwsError(() => createPortraitDirectionalContact(mesh, direction)),
    );
  for (const clearance of [-1, Infinity])
    TestValidator.predicate(
      "invalid clearance",
      throwsError(() =>
        createPortraitDirectionalContact(mesh, { x: 0, y: 0, z: 1 }, clearance),
      ),
    );
  for (const positions of [
    [0, 0],
    [NaN, 0, 0],
  ])
    TestValidator.predicate(
      "invalid source positions",
      throwsError(
        () =>
          createPortraitDirectionalContact(
            { ...mesh, positions },
            { x: 0, y: 0, z: 1 },
          ),
        "complete finite",
      ),
    );
  TestValidator.predicate(
    "invalid point",
    throwsError(
      () => contact({ x: Infinity, y: 0, z: 0 }),
      "point must be finite",
    ),
  );
  const overflow = createPortraitDirectionalContact(
    { ...mesh, positions: [-1, -1, 1e308, 1, -1, 1e308, 0, 1, 1e308] },
    { x: 0, y: 0, z: 1 },
    1e308,
  );
  TestValidator.predicate(
    "unrepresentable clearance result",
    throwsError(() => overflow(point), "finite coordinate"),
  );
};
