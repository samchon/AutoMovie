import { tessellate } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * A box tessellates to 6 quads = 24 vertices and 12 triangles = 36 indices,
 * with every vertex inside the half-extents. Pins the exact box topology.
 */
export const test_geometry_tessellate_box = (): void => {
  const box = tessellate({ type: "box", width: 0.4, height: 0.6, depth: 0.2 });
  TestValidator.equals("24 vertices", box.positions.length / 3, 24);
  TestValidator.equals("36 indices", box.indices.length, 36);

  let withinBounds = true;
  for (let i = 0; i < box.positions.length; i += 3)
    if (
      Math.abs(box.positions[i]!) > 0.2 + 1e-9 ||
      Math.abs(box.positions[i + 1]!) > 0.3 + 1e-9 ||
      Math.abs(box.positions[i + 2]!) > 0.1 + 1e-9
    )
      withinBounds = false;
  TestValidator.predicate("vertices within half-extents", withinBounds);
};
