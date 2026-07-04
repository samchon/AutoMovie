import { tessellate } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * The box has an exact, known topology, so it is pinned precisely: six quad
 * faces, each with its own four vertices (so per-face normals stay crisp rather
 * than being averaged at shared corners), giving 24 vertices and 12 triangles.
 * Every vertex sits on the surface, within the half-extents.
 *
 * Scenario: a 0.4×0.6×0.2 box tessellates to 24 vertices and 36 indices, and no
 * vertex lies outside ±(0.2, 0.3, 0.1) — its half-extents.
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
