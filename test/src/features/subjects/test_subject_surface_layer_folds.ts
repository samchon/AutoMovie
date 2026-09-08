import { TestValidator } from "@nestia/e2e";

import { applyPortraitSurfaceLayers } from "../../subjects/portraitSurface";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Attachment fading belongs to the final deformation, not only its unfaded
 * engine field. An almost constant translation has a positive Jacobian but
 * can move interior skin past an aperture that the fade deliberately retains.
 *
 * Scenarios:
 * 1. A 5-by-5 millimetre grid translates its centre 0.1 mm and retains its
 *    boundary, with positive final face areas. A 4 mm twin folds and refuses.
 * 2. A 2 mm centre translation reaches the fixed right boundary and collapses
 *    a final face. Refusal preserves the supplied mesh and layer settings.
 * 3. A large perpendicular displacement stays a graph above the plane, and a
 *    closed tetrahedron accepts a positive-determinant half-turn. Near-full
 *    smoothstep weights stay bounded; invalid gradient source faces refuse.
 * 4. At grid vertex (3,2), the six incident unit triangles give mean distance
 *    gradient (-5/6,-1/6). At distance 1 mm and fade 2 mm, the quintic
 *    derivative makes its X gradient -25/32 per mm. Translation 1.2 mm has
 *    positive derivative 1-1.2*25/32; 1.5 mm reverses it despite positive
 *    straight-triangle areas. The broad field's sub-nanometre variation does
 *    not change either strict sign.
 */
export const test_subject_surface_layer_folds = (): void => {
  const positions: number[][] = [],
    indices: number[] = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) positions.push([x, y, 0]);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const a = 5 * y + x;
      indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
    }
  const mesh = {
    positions,
    indices,
    groups: new Array(indices.length / 3).fill(0),
  };
  const before = structuredClone(mesh);
  const layer = (x: number, z = 0) => ({
    id: "translated-tissue",
    fields: () => [
      {
        center: { x: 0.002, y: 0.002, z: 0 },
        radius: { x: 100, y: 100, z: 100 },
        displacement: { x: x / 1000, y: 0, z: z / 1000 },
        stretch: { x: 0, y: 0, z: 0 },
      },
    ],
  });
  const apply = (x: number, z = 0) =>
    applyPortraitSurfaceLayers(mesh, [layer(x, z)], 2);
  const moved = apply(0.1);
  TestValidator.predicate(
    "small translation reaches centre",
    nclose(moved.positions[12][0], 2.1),
  );
  TestValidator.equals(
    "right aperture retained",
    moved.positions[14],
    [4, 2, 0],
  );
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((id) => moved.positions[id]);
    TestValidator.predicate(
      "small translation retains every face orientation",
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0,
    );
  }
  apply(1.2);
  for (const x of [1.5, 2, 4])
    TestValidator.predicate(
      "final faded collapse or fold refuses",
      throwsError(() => apply(x)),
    );
  const raised = apply(0, 10);
  TestValidator.predicate(
    "steep outward relief remains valid",
    nclose(raised.positions[12][2], 10),
  );
  TestValidator.equals("refusals preserve host", mesh, before);
  // Direct quintic evaluation at this represented t is 1.0000000000000009.
  // A mathematically bounded attachment mask must remain valid at that input.
  applyPortraitSurfaceLayers(mesh, [layer(0.1)], 1 / 0.999999999999992);
  const tetra = {
    positions: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    indices: [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3],
    groups: [0, 0, 0, 0],
  };
  const turned = applyPortraitSurfaceLayers(tetra, [
    {
      id: "closed-half-turn",
      fields: () => [
        {
          center: { x: 0, y: 0, z: 0 },
          radius: { x: 1000, y: 1000, z: 1000 },
          displacement: { x: 0, y: 0, z: 0 },
          stretch: { x: 0, y: -2, z: -2 },
        },
      ],
    },
  ]);
  TestValidator.predicate(
    "closed surface retains supported positive-determinant turns",
    turned.positions[2][1] < -0.99 && turned.positions[3][2] < -0.99,
  );
  for (const malformed of [
    { ...mesh, positions: positions.map(([x]) => [x, 0, 0]) },
    {
      ...mesh,
      positions: positions.map((point) => point.map((v) => v * 1e200)),
    },
  ])
    TestValidator.predicate(
      "invalid gradient basis refuses",
      throwsError(() => applyPortraitSurfaceLayers(malformed, [layer(0.1)], 2)),
    );
};
