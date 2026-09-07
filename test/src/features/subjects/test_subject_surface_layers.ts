import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitSurfaceLayer,
  applyPortraitSurfaceLayers,
} from "../../subjects/portraitSurface";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Surface anatomy deforms one connected skin while preserving its apertures,
 * unused gaze data and deterministic layer composition.
 *
 * Scenarios:
 * 1. A 5-by-5 planar grid retains its boundary, reaches full displacement at
 *    its centre and half influence one millimetre into a two-millimetre fade.
 * 2. Reordering two layers cannot change output; no layers/no fields are exact
 *    identity and input geometry/connectivity are retained.
 * 3. A disconnected closed tetrahedron remains fully influenced even beside
 *    the open grid boundary. Empty input is valid; invalid fade/identities refuse.
 */
export const test_subject_surface_layers = (): void => {
  const positions: number[][] = [],
    indices: number[] = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) positions.push([x, y, 0]);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const a = y * 5 + x;
      indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
    }
  positions.push([2, 2, 4]);
  const mesh = {
      positions,
      indices,
      groups: new Array(indices.length / 3).fill(0),
    },
    before = structuredClone(mesh);
  const layer = (id: string, amount: number): IPortraitSurfaceLayer => ({
    id,
    fields: () => [
      {
        center: { x: 0.002, y: 0.002, z: 0 },
        radius: { x: 0.1, y: 0.1, z: 0.1 },
        displacement: { x: 0, y: 0, z: amount / 1000 },
        stretch: { x: 0, y: 0, z: 0 },
      },
    ],
  });
  const raised = applyPortraitSurfaceLayers(mesh, [layer("malar", 1)], 2);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++)
      if (x === 0 || y === 0 || x === 4 || y === 4)
        TestValidator.equals(
          "aperture vertices retained",
          raised.positions[5 * y + x],
          mesh.positions[5 * y + x],
        );
  TestValidator.predicate(
    "full central projection",
    nclose(raised.positions[12][2], 1),
  );
  TestValidator.predicate(
    "metric half fade",
    nclose(raised.positions[11][2], 0.5 * (1 - 1 / 10000) ** 3),
  );
  TestValidator.equals(
    "gaze marker retained",
    raised.positions[25],
    positions[25],
  );
  TestValidator.equals(
    "layer order independent",
    applyPortraitSurfaceLayers(mesh, [layer("z", 2), layer("a", 1)], 2),
    applyPortraitSurfaceLayers(mesh, [layer("a", 1), layer("z", 2)], 2),
  );
  TestValidator.predicate(
    "empty layers identity",
    applyPortraitSurfaceLayers(mesh, []) === mesh &&
      applyPortraitSurfaceLayers(mesh, [
        { id: "neutral", fields: () => [] },
      ]) === mesh,
  );
  TestValidator.equals("input geometry retained", mesh, before);
  TestValidator.predicate(
    "topology and materials retained",
    raised.indices === mesh.indices && raised.groups === mesh.groups,
  );
  const tetra = [
      [-0.9, -0.9, -0.9],
      [1.1, -0.9, -0.9],
      [0.1, 1.1, -0.9],
      [0.1, 0.1, 1.1],
    ],
    offset = positions.length;
  const combined = {
    positions: [...positions, ...tetra],
    indices: [
      ...indices,
      ...[0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3].map((id) => id + offset),
    ],
    groups: [...mesh.groups, 0, 0, 0, 0],
  };
  const closed = applyPortraitSurfaceLayers(combined, [layer("volume", 1)], 2);
  TestValidator.predicate(
    "disconnected geometry has independent geodesic support",
    tetra.every(
      (point, i) => closed.positions[offset + i][2] - point[2] > 0.99,
    ),
  );
  TestValidator.equals(
    "empty skin",
    applyPortraitSurfaceLayers({ positions: [], indices: [], groups: [] }, [
      layer("empty", 1),
    ]).positions,
    [],
  );
  for (const fade of [0, -1, NaN])
    TestValidator.predicate(
      "invalid fade refused",
      throwsError(() => applyPortraitSurfaceLayers(mesh, [], fade)),
    );
  TestValidator.predicate(
    "duplicate layer refused",
    throwsError(() =>
      applyPortraitSurfaceLayers(mesh, [layer("a", 1), layer("a", 2)]),
    ),
  );
  TestValidator.predicate(
    "blank layer refused",
    throwsError(() => applyPortraitSurfaceLayers(mesh, [layer(" ", 1)])),
  );
};
