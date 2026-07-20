import { tessellate } from "@automovie/engine";
import { AutoMoviePrimitiveShape } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/** Origin-centered shapes whose tessellation encloses a positive volume. */
const SOLIDS: AutoMoviePrimitiveShape[] = [
  { type: "box", width: 0.4, height: 0.6, depth: 0.2 },
  { type: "sphere", radius: 0.5 },
  { type: "cylinder", radius: 0.3, height: 1 },
  { type: "cone", radius: 0.3, height: 1 },
  { type: "capsule", radius: 0.2, height: 1 },
];

/**
 * Signed volume of the indexed surface via the divergence theorem: positive
 * when triangles wind counter-clockwise seen from OUTSIDE: the glTF front-face
 * contract, and what a front-side renderer needs to avoid culling the visible
 * surface (#1053, same oracle as the forge's #1041).
 */
const signedVolume = (t: {
  positions: number[];
  indices: number[];
}): number => {
  let six = 0;
  const p = t.positions;
  for (let i = 0; i < t.indices.length; i += 3) {
    const a = t.indices[i]! * 3;
    const b = t.indices[i + 1]! * 3;
    const c = t.indices[i + 2]! * 3;
    six +=
      p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) +
      p[a + 1]! * (p[b + 2]! * p[c]! - p[b]! * p[c + 2]!) +
      p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!);
  }
  return six / 6;
};

/**
 * Every triangle's geometric (winding) normal must agree with its authored
 * vertex normals: a per-triangle check that catches local flips a global
 * volume cannot. Zero-area triangles (a cone apex ring, a plane's collapsed
 * sides) carry no orientation and are skipped.
 */
const windingAgreesWithNormals = (t: {
  positions: number[];
  normals: number[];
  indices: number[];
}): boolean => {
  const p = t.positions;
  const n = t.normals;
  for (let i = 0; i < t.indices.length; i += 3) {
    const a = t.indices[i]! * 3;
    const b = t.indices[i + 1]! * 3;
    const c = t.indices[i + 2]! * 3;
    const abx = p[b]! - p[a]!;
    const aby = p[b + 1]! - p[a + 1]!;
    const abz = p[b + 2]! - p[a + 2]!;
    const acx = p[c]! - p[a]!;
    const acy = p[c + 1]! - p[a + 1]!;
    const acz = p[c + 2]! - p[a + 2]!;
    const gx = aby * acz - abz * acy;
    const gy = abz * acx - abx * acz;
    const gz = abx * acy - aby * acx;
    if (Math.hypot(gx, gy, gz) < 1e-12) continue;
    const mx = n[a]! + n[b]! + n[c]!;
    const my = n[a + 1]! + n[b + 1]! + n[c + 1]!;
    const mz = n[a + 2]! + n[b + 2]! + n[c + 2]!;
    if (gx * mx + gy * my + gz * mz <= 0) return false;
  }
  return true;
};

/**
 * Tessellated primitives must wind OUTWARD (#1053): the box always did, but the
 * shared sphere/cylinder lattices emitted clockwise-from-outside triangles, so
 * a front-side renderer culled curved primitives inside-out and the exported
 * `.glb` violated the glTF CCW front-face contract.
 *
 * Scenarios:
 *
 * 1. Every solid primitive (box, sphere, cylinder, cone, capsule) encloses a
 *    strictly positive signed volume: outward winding globally.
 * 2. Every non-degenerate triangle's winding normal agrees with its authored
 *    vertex normals: outward winding locally, for all six primitive types
 *    including the plane.
 */
export const test_geometry_tessellate_winding = (): void => {
  for (const shape of SOLIDS)
    TestValidator.predicate(
      `${shape.type}: signed volume is positive`,
      signedVolume(tessellate(shape)) > 0,
    );
  for (const shape of [
    ...SOLIDS,
    { type: "plane", width: 2, depth: 3 } as AutoMoviePrimitiveShape,
  ])
    TestValidator.predicate(
      `${shape.type}: winding agrees with authored normals`,
      windingAgreesWithNormals(tessellate(shape)),
    );
};
