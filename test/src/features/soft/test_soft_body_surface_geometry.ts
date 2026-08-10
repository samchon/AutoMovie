import { simulateSoftBody, softBodySurfaceGeometry } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";
import { exactValues, softPanel } from "../internal/softFixtures";

/** A flat rug lying in the world `xz` plane. */
const rug = (columns: number, rows: number) =>
  softPanel({
    columns,
    rows,
    axisU: { x: 1, y: 0, z: 0 },
    axisV: { x: 0, y: 0, z: 1 },
    overrides: { id: "rug" },
  });

/**
 * The drawable panel is derived from the solved particles alone, and its
 * normals, UVs, indices and bounds are the hand-computable consequences of that
 * lattice.
 *
 * The renderer must stay a projection. If a viewer built its own cloth mesh it
 * would be a second opinion about where the fabric is, and a second opinion can
 * disagree with the field the constraints were proven against — so every
 * attribute is checked here, at the one place that derives them.
 *
 * The rug lies in the `xz` plane, where the quad `(c, r) → (c, r+1) → (c+1, r)`
 * has edge vectors `(0, 0, sv)` and `(su, 0, 0)`, whose cross product is `(0,
 * su·sv, 0)`: the surface faces `+y`, exactly, with no residual in the other
 * two components.
 *
 * Scenarios:
 *
 * 1. A 3×3 rug emits one vertex per particle, four quads, twenty-four indices, and
 *    vertex positions bit-identical to the solved particle array.
 * 2. Every normal of a flat rug is exactly `(0, 1, 0)`: the area-weighted sum
 *    normalizes to an exact axis rather than to a value merely close to one.
 * 3. UVs are the normalized lattice coordinates, with both extremes present and
 *    the interior at exactly one half.
 * 4. Bounds are the world extent of the drawn panel, and a hanging curtain's
 *    normals face `+z` rather than `+y`, which is what proves the derivation
 *    reads the lattice instead of assuming an orientation.
 * 5. A lattice one particle wide emits no triangle and reports `null` bounds: a
 *    single row of particles is a cord, not a surface. Its normals fall back to
 *    `(0, 1, 0)` rather than dividing by a zero-length accumulation.
 * 6. The mirror boundary — one particle deep rather than one wide — behaves the
 *    same way, and its UV rule degenerates on the other axis: the `u` extreme
 *    is still reached while every `v` is exactly zero.
 */
export const test_soft_body_surface_geometry = (): void => {
  const flat = rug(3, 3);
  const surface = softBodySurfaceGeometry({
    domain: flat,
    state: simulateSoftBody(flat, 0),
  });
  TestValidator.equals(
    "one vertex per particle and two triangles per quad",
    namedFacts([
      ["vertices", () => surface.mesh.positions.length === 27],
      ["indices", () => (surface.mesh.indices ?? []).length === 24],
      ["positions", () => exactValues(surface.mesh.positions, flat.rest)],
      ["step", () => surface.step === 0],
      ["domain", () => surface.domain === "rug"],
      ["skinless", () => surface.mesh.skin === null],
    ]),
    {
      vertices: true,
      indices: true,
      positions: true,
      step: true,
      domain: true,
      skinless: true,
    },
  );

  TestValidator.equals(
    "a flat rug faces exactly +y",
    (surface.mesh.normals ?? []).every((value, index) =>
      Object.is(value, index % 3 === 1 ? 1 : 0),
    ),
    true,
  );

  TestValidator.equals(
    "UVs are the normalized lattice coordinates",
    namedFacts([
      ["origin", () => (surface.mesh.uvs ?? [])[0] === 0],
      ["centre", () => (surface.mesh.uvs ?? [])[8] === 0.5],
      ["far", () => (surface.mesh.uvs ?? [])[17] === 1],
      ["count", () => (surface.mesh.uvs ?? []).length === 18],
    ]),
    { origin: true, centre: true, far: true, count: true },
  );

  const curtain = softPanel({
    columns: 3,
    rows: 3,
    overrides: { id: "drape" },
  });
  const hanging = softBodySurfaceGeometry({
    domain: curtain,
    state: simulateSoftBody(curtain, 0),
  });
  TestValidator.equals(
    "bounds are the world extent, and a hanging panel faces +z",
    namedFacts([
      ["minX", () => nclose(hanging.bounds?.min.x ?? NaN, 0)],
      ["maxX", () => nclose(hanging.bounds?.max.x ?? NaN, 0.5)],
      ["minY", () => nclose(hanging.bounds?.min.y ?? NaN, -0.5)],
      ["maxY", () => nclose(hanging.bounds?.max.y ?? NaN, 0)],
      [
        "normals",
        () =>
          (hanging.mesh.normals ?? []).every((value, index) =>
            Object.is(value, index % 3 === 2 ? 1 : 0),
          ),
      ],
    ]),
    { minX: true, maxX: true, minY: true, maxY: true, normals: true },
  );

  const cord = softPanel({ columns: 1, rows: 4, overrides: { id: "cord" } });
  const thread = softBodySurfaceGeometry({
    domain: cord,
    state: simulateSoftBody(cord, 0),
  });
  TestValidator.equals(
    "a one-particle-wide lattice is a cord, not a surface",
    namedFacts([
      ["indices", () => (thread.mesh.indices ?? []).length === 0],
      ["bounds", () => thread.bounds === null],
      ["vertices", () => thread.mesh.positions.length === 12],
      [
        "normals",
        () =>
          (thread.mesh.normals ?? []).every((value, index) =>
            Object.is(value, index % 3 === 1 ? 1 : 0),
          ),
      ],
      ["uvs", () => (thread.mesh.uvs ?? [])[0] === 0],
    ]),
    { indices: true, bounds: true, vertices: true, normals: true, uvs: true },
  );

  const batten = softPanel({
    columns: 4,
    rows: 1,
    overrides: { id: "batten" },
  });
  const rail = softBodySurfaceGeometry({
    domain: batten,
    state: simulateSoftBody(batten, 0),
  });
  TestValidator.equals(
    "a one-particle-deep lattice is the mirror boundary of the cord",
    namedFacts([
      ["indices", () => (rail.mesh.indices ?? []).length === 0],
      ["bounds", () => rail.bounds === null],
      ["u", () => (rail.mesh.uvs ?? [])[6] === 1],
      [
        "v",
        () =>
          (rail.mesh.uvs ?? []).every(
            (value, index) => index % 2 === 0 || value === 0,
          ),
      ],
    ]),
    { indices: true, bounds: true, u: true, v: true },
  );
};
