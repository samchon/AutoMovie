import { createAutoMovieMeshDeformer } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitOrbitalSupportShape,
  createPortraitOrbitalSupport,
} from "../../subjects/generated-korean-girl-01/orbitalSupport";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Upper orbital support owns forehead, brow and sulcus together on actual skin.
 * An inclined plane gives an independent height oracle for every control.
 *
 * Scenarios:
 * 1. Plane z=y/2 puts section centres at (0,+4,+2), (0,0,0), (0,-4,-2).
 *    A coupled field gives zero forehead movement, +0.2 mm brow, -0.1 mm sulcus.
 * 2. Side identity, copied nested inputs and all-zero detail retain their
 *    independent meanings; 32 separated stations are admitted.
 * 3. Invalid dimensions/populations/bindings and off-skin sections refuse.
 */
export const test_subject_orbital_support = (): void => {
  const host = {
    positions: [
      [-20, -20, -10],
      [20, -20, -10],
      [20, 20, 10],
      [-20, 20, 10],
      [0, 0, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    normals: [],
  };
  const shape: IPortraitOrbitalSupportShape = {
    radius: 8,
    stations: [
      {
        name: "middle",
        anchor: 4,
        forehead: { height: 4, projection: 0 },
        browProjection: 0.2,
        sulcus: { descent: 4, projection: -0.1 },
      },
    ],
  };
  const layer = createPortraitOrbitalSupport("left", shape),
    fields = layer.fields(host);
  const mesh = {
    positions: [0, 0.004, 0.002, 0, 0, 0, 0, -0.004, -0.002],
    indices: [],
    normals: null,
    uvs: null,
    skin: null,
  };
  const result = createAutoMovieMeshDeformer(fields)(mesh);
  for (const [i, d] of [0, 0.0002, -0.0001].entries())
    TestValidator.predicate(
      "independent station movement",
      nclose(result.positions[i * 3 + 2] - mesh.positions[i * 3 + 2], d, 1e-12),
    );
  TestValidator.equals(
    "side-qualified group",
    createPortraitOrbitalSupport("right", shape).id,
    "right-orbital-support",
  );
  shape.stations[0].browProjection = 4;
  shape.stations[0].forehead.height = 8;
  TestValidator.equals("owns nested sections", layer.fields(host), fields);
  const zero = {
    radius: 8,
    stations: [
      {
        name: "neutral",
        anchor: 4,
        forehead: { height: 4, projection: 0 },
        browProjection: 0,
        sulcus: { descent: 4, projection: 0 },
      },
    ],
  };
  TestValidator.equals(
    "all zero identity",
    createPortraitOrbitalSupport("left", zero).fields(host),
    [],
  );
  const broad = {
    positions: [
      [-200, -20, 0],
      [200, -20, 0],
      [200, 20, 0],
      [-200, 20, 0],
      ...Array.from({ length: 32 }, (_, i) => [-155 + i * 10, 0, 0]),
    ],
    indices: [0, 1, 2, 0, 2, 3],
    normals: [],
  };
  const full = {
    radius: 2,
    stations: Array.from({ length: 32 }, (_, i) => ({
      ...structuredClone(zero.stations[0]),
      name: String(i),
      anchor: 4 + i,
      browProjection: 0.1,
    })),
  };
  TestValidator.equals(
    "32 full sections",
    createPortraitOrbitalSupport("left", full).fields(broad).length,
    32,
  );
  for (const change of [
    { radius: 0 },
    { radius: NaN },
    { stations: [] },
    { stations: new Array(33).fill(zero.stations[0]) },
    { stations: [zero.stations[0], zero.stations[0]] },
  ])
    TestValidator.predicate(
      "group refusal",
      throwsError(() =>
        createPortraitOrbitalSupport("left", { ...zero, ...change }),
      ),
    );
  for (const change of [
    { name: "" },
    { anchor: -1 },
    { anchor: 0.5 },
    { browProjection: Infinity },
    { forehead: { height: 0, projection: 0 } },
    { sulcus: { descent: -1, projection: 0 } },
    { sulcus: { descent: 1, projection: NaN } },
  ])
    TestValidator.predicate(
      "section refusal",
      throwsError(() =>
        createPortraitOrbitalSupport("left", {
          ...zero,
          stations: [{ ...zero.stations[0], ...change }],
        }),
      ),
    );
  TestValidator.predicate(
    "side refusal",
    throwsError(() => createPortraitOrbitalSupport("other" as "left", zero)),
  );
  TestValidator.predicate(
    "missing datum refusal",
    throwsError(() =>
      createPortraitOrbitalSupport("left", {
        ...zero,
        stations: [{ ...zero.stations[0], anchor: 10 }],
      }).fields(host),
    ),
  );
  for (const datum of [
    [0, 0],
    [0, NaN, 0],
  ])
    TestValidator.predicate(
      "invalid resident datum refusal",
      throwsError(() =>
        layer.fields({
          ...host,
          positions: [...host.positions.slice(0, 4), datum],
        }),
      ),
    );
  TestValidator.predicate(
    "off-skin section refusal",
    throwsError(() =>
      createPortraitOrbitalSupport("left", {
        ...zero,
        stations: [
          { ...zero.stations[0], forehead: { height: 30, projection: 0 } },
        ],
      }).fields(host),
    ),
  );
};
