import { createPortraitNasalBodySurface } from "@automovie/human/components/nasalBodySurface";
import { applyPortraitFinalSurfaces } from "@automovie/human/geometry/portraitFinalSurface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Final local sections reach their analytic target without another subdivision
 * pass, while the shared rim, lining and posterior remain independently owned.
 *
 * Scenarios:
 * 1. A radius-five sphere reaches z=5 at its pole and z=4 three mm across.
 *    Full depth support includes its half-reach boundary; at three-quarters
 *    reach the cubic weight is one half, and the outer boundary is identity.
 * 2. Rim and lining vertices never move. A half-width physical join gives a
 *    half displacement; an outside footprint and an empty array are identity.
 * 3. Copied profiles/datums, translation and an oblique recorded ray preserve
 *    head-Z targets. Missing datums and competing complete targets refuse.
 */
export const test_subject_nasal_final_lobules = (): void => {
  const mesh = {
    positions: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
      [0, 0, 0],
      [0, 3, 0],
      [3, 3, 0],
      [0, 3, -5],
      [0, 3, -7.5],
      [0, 3, -10],
      [8, 3, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3, 3, 2, 5],
    groups: [1, 1, 0],
  };
  const lobule = {
    anchor: 4,
    offset: [0, 3, 5],
    radii: [5, 5, 5],
    core: 0.8,
  };
  const datums = mesh.positions.map((p) => [...p]);
  const make = (join = 2) =>
    createPortraitNasalBodySurface(
      { lobules: [lobule] },
      4,
      1,
      [2, 0, 0],
      join,
      10,
      datums,
    );
  const propose = make();
  const result = applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose }]);
  for (const [id, z] of [
    [4, 2],
    [5, 5],
    [6, 4],
    [7, 5],
    [8, -1.25],
  ])
    TestValidator.predicate(
      "analytic section and hand-known depth weights",
      nclose(result.positions[id][2], z),
    );
  for (const id of [0, 1, 2, 3, 9, 10])
    TestValidator.equals(
      "lining, support edge and empty footprint",
      result.positions[id],
      mesh.positions[id],
    );
  TestValidator.equals("topology retained", result.indices, mesh.indices);
  TestValidator.predicate(
    "head-XY unchanged despite oblique recorded ray",
    result.positions.every(
      (p, i) => p[0] === mesh.positions[i][0] && p[1] === mesh.positions[i][1],
    ),
  );
  TestValidator.predicate(
    "half physical join has half target displacement",
    nclose(
      applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose: make(4) }])
        .positions[5][2],
      2.5,
    ),
  );
  TestValidator.equals(
    "empty local targets remain identity without reference datums",
    applyPortraitFinalSurfaces(mesh, [
      {
        id: "nose",
        propose: createPortraitNasalBodySurface(
          { lobules: [] },
          4,
          1,
          [0, 0, 1],
          2,
          10,
        ),
      },
    ]),
    mesh,
  );
  const shift = [4, -3, 7];
  const shifted = {
    ...mesh,
    positions: mesh.positions.map((p) => p.map((v, a) => v + shift[a])),
  };
  const translated = applyPortraitFinalSurfaces(shifted, [
    {
      id: "nose",
      propose: createPortraitNasalBodySurface(
        { lobules: [lobule] },
        4,
        1,
        [0, 0, 1],
        2,
        10,
        shifted.positions,
      ),
    },
  ]);
  TestValidator.predicate(
    "translated reference and surface preserve target",
    translated.positions.every((p, i) =>
      p.every((v, a) => nclose(v, result.positions[i][a] + shift[a])),
    ),
  );
  lobule.offset[2] = 50;
  datums[4][2] = 100;
  TestValidator.equals(
    "targets own profiles and pre-fit datums",
    applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose }]),
    result,
  );
  TestValidator.predicate(
    "nonempty targets need their source datum",
    throwsError(
      () =>
        createPortraitNasalBodySurface(
          { lobules: [lobule] },
          4,
          1,
          [0, 0, 1],
          2,
          10,
        ),
      "finite XYZ datum",
    ),
  );
  TestValidator.predicate(
    "one final target basis",
    throwsError(
      () =>
        createPortraitNasalBodySurface(
          {
            lobules: [],
            section: {
              transverse: [],
              stations: [],
              joinWidth: 1,
              influence: 1,
            },
          },
          4,
          1,
          [0, 0, 1],
          2,
          10,
        ),
      "one final nasal target",
    ),
  );
};
