import { separateAutoMovieMeshSequence } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Ordered pair constraints produce finite rigid translations in one pass.
 * Scenarios:
 * 1. Planes at depths 0,-1,1 and gap 0.2 finish at -0.6,-0.4,1.6 on each axis.
 *    Shapes, normals and input buffers remain unchanged apart from translation.
 * 2. A disjoint middle plane cannot hide the first/last constraint. Already
 *    separated, empty and single-member sequences need no travel.
 * 3. Invalid axes, clearances, single-mesh buffers, accumulated travel and final
 *    position overflow refuse rather than returning a partially placed group.
 */
export const test_geometry_mesh_sequence = (): void => {
  const plane = (z: number, x = 0) => ({
    positions: [x - 1, -1, z, x + 1, -1, z, x, 1, z],
    indices: [0, 1, 2],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: null,
    skin: null,
  });
  for (const [axis, depth] of [
    ["x", 0],
    ["y", 1],
    ["z", 2],
  ] as const) {
    const meshes = [0, -1, 1].map((z) => {
      const mesh = plane(z);
      mesh.positions = Array.from({ length: 3 }, (_, i) => {
        const [u, v, d] = mesh.positions.slice(i * 3, i * 3 + 3);
        return axis === "x" ? [d, u, v] : axis === "y" ? [v, d, u] : [u, v, d];
      }).flat();
      return mesh;
    });
    const before = structuredClone(meshes),
      result = separateAutoMovieMeshSequence(meshes, axis, 0.2);
    TestValidator.equals("input ownership", meshes, before);
    for (let j = 0; j < 3; j++) {
      TestValidator.predicate(
        "independent plane placement",
        result[j].positions.every(
          (v, i) =>
            i % 3 !== depth || Math.abs(v - [-0.6, -0.4, 1.6][j]) < 1e-12,
        ),
      );
      TestValidator.equals(
        "rigid normal retention",
        result[j].normals,
        meshes[j].normals,
      );
      TestValidator.predicate(
        "transverse coordinates retained",
        result[j].positions.every(
          (v, i) => i % 3 === depth || v === meshes[j].positions[i],
        ),
      );
      TestValidator.predicate(
        "output owns buffers",
        result[j] !== meshes[j] && result[j].positions !== meshes[j].positions,
      );
    }
  }
  const nonadjacent = separateAutoMovieMeshSequence(
    [plane(0), plane(-20, 10), plane(-1)],
    "z",
    0.2,
  );
  TestValidator.predicate(
    "nonadjacent constraint survives disjoint middle",
    Math.abs(nonadjacent[2].positions[2] - nonadjacent[0].positions[2] - 0.2) <
      1e-12,
  );
  const clear = [plane(0), plane(1)];
  TestValidator.equals(
    "already separated",
    separateAutoMovieMeshSequence(clear, "z"),
    clear,
  );
  TestValidator.equals(
    "one member",
    separateAutoMovieMeshSequence([clear[0]], "z"),
    [clear[0]],
  );
  TestValidator.equals("empty", separateAutoMovieMeshSequence([], "z"), []);
  for (const gap of [-1, Infinity, NaN])
    TestValidator.predicate(
      "invalid gap",
      throwsError(
        () => separateAutoMovieMeshSequence([], "z", gap),
        "clearance",
      ),
    );
  TestValidator.predicate(
    "invalid axis on empty input",
    throwsError(() => separateAutoMovieMeshSequence([], "w" as never), "axis"),
  );
  TestValidator.predicate(
    "invalid singleton is checked",
    throwsError(
      () =>
        separateAutoMovieMeshSequence([{ ...plane(0), positions: [NaN] }], "z"),
      "triangle buffers",
    ),
  );
  TestValidator.predicate(
    "travel overflow",
    throwsError(
      () =>
        separateAutoMovieMeshSequence([plane(0), plane(-1e308)], "z", 1e308),
      "translation",
    ),
  );
  TestValidator.predicate(
    "position overflow",
    throwsError(
      () =>
        separateAutoMovieMeshSequence(
          [plane(0), plane(-1e308), plane(1.7e308, 10)],
          "z",
        ),
      "positions",
    ),
  );
};
