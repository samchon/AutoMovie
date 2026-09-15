import {
  createAutoMovieMeshDeformer,
  inspectAutoMovieMeshTopology,
  mergeAutoMovieMeshes,
  transformAutoMovieMesh,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { vertexColourMesh } from "../internal/vertexColourFixture";

/**
 * Vertex colour follows correspondence, not world coordinates.
 *
 * Scenarios:
 * 1. Mirrored placement preserves ordered RGB and owns its copied buffer.
 * 2. Mixed merging inserts white for uncoloured vertices; coloured merging
 *    retains declaration order. Empty and wholly bare merges omit the field.
 * 3. A nontrivial spatial deformation moves positions but retains RGB.
 * 4. Topology inspection counts nonfinite colour components independently.
 */
export const test_geometry_vertex_colour = (): void => {
  const colored = vertexColourMesh();
  const { colors: _colors, ...bare } = colored;
  const placed = transformAutoMovieMesh(colored, {
    scale: { x: -2, y: 3, z: 1 },
  });
  TestValidator.equals("placement retains RGB", placed.colors, colored.colors);
  TestValidator.predicate(
    "placement owns RGB",
    placed.colors !== colored.colors,
  );
  TestValidator.equals(
    "mirror retains vertex order",
    placed.indices,
    [0, 2, 1],
  );
  TestValidator.predicate(
    "bare transform omits RGB",
    !Object.hasOwn(transformAutoMovieMesh(bare, {}), "colors"),
  );
  const mixed = mergeAutoMovieMeshes([
    bare,
    colored,
    { ...bare, indices: null },
  ]);
  TestValidator.equals("identity fill surrounds colour", mixed.colors, [
    ...new Array(9).fill(1),
    ...colored.colors!,
    ...new Array(9).fill(1),
  ]);
  TestValidator.equals(
    "all colours retained",
    mergeAutoMovieMeshes([colored, colored]).colors,
    [...colored.colors!, ...colored.colors!],
  );
  TestValidator.predicate(
    "empty and bare omit RGB",
    [[], [bare]].every(
      (meshes) => !Object.hasOwn(mergeAutoMovieMeshes(meshes), "colors"),
    ),
  );
  const deformed = createAutoMovieMeshDeformer([
    {
      center: { x: 0, y: 0, z: 0 },
      radius: { x: 2, y: 2, z: 2 },
      displacement: { x: 0, y: 0, z: 0.1 },
      stretch: { x: 0, y: 0, z: 0 },
    },
  ])(colored);
  TestValidator.predicate(
    "deformation actually moves the surface",
    deformed.positions[2]! > 0,
  );
  TestValidator.equals(
    "deformation retains RGB",
    deformed.colors,
    colored.colors,
  );
  TestValidator.equals(
    "finite RGB",
    inspectAutoMovieMeshTopology(colored).nonFinite,
    0,
  );
  TestValidator.equals(
    "nonfinite RGB",
    inspectAutoMovieMeshTopology({
      ...colored,
      colors: [NaN, Infinity, ...colored.colors!.slice(2)],
    }).nonFinite,
    2,
  );
};
