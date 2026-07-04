import { tessellate } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * A tessellated sphere must actually be round: every generated vertex lies on
 * the sphere's radius, and every normal is unit length (so lighting across the
 * surface is correct). Pins both to floating-point tolerance.
 *
 * Scenario: a radius-0.5 sphere — every vertex is exactly 0.5 from the origin,
 * and every normal has length 1.
 */
export const test_geometry_tessellate_sphere = (): void => {
  const r = 0.5;
  const sphere = tessellate({ type: "sphere", radius: r });

  let onRadius = true;
  for (let i = 0; i < sphere.positions.length; i += 3) {
    const x = sphere.positions[i]!;
    const y = sphere.positions[i + 1]!;
    const z = sphere.positions[i + 2]!;
    if (!nclose(Math.sqrt(x * x + y * y + z * z), r, 1e-6)) onRadius = false;
  }
  TestValidator.predicate("every vertex on the radius", onRadius);

  let unitNormals = true;
  for (let i = 0; i < sphere.normals.length; i += 3) {
    const x = sphere.normals[i]!;
    const y = sphere.normals[i + 1]!;
    const z = sphere.normals[i + 2]!;
    if (!nclose(Math.sqrt(x * x + y * y + z * z), 1, 1e-6)) unitNormals = false;
  }
  TestValidator.predicate("every normal is unit", unitNormals);
};
