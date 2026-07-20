import { tessellate } from "@automovie/engine";
import { AutoMoviePrimitiveShape } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/** The lateral segment count the engine tessellates round primitives at. */
const SEGMENTS = 16;

/** Area of the regular n-gon cross-section the round lattices approximate. */
const ngonArea = (radius: number): number =>
  (SEGMENTS / 2) * radius * radius * Math.sin((2 * Math.PI) / SEGMENTS);

/**
 * Quantized position key: ring seams recompute `cos/sin(2π)` with float error
 * (~1e-16), so raw component equality would split one seam vertex into two. A
 * 1e-9 grid welds those while keeping distinct vertices apart (`|| 0` folds the
 * −0 a tiny negative rounds to).
 */
const keyAt = (positions: number[], index: number): string =>
  [0, 1, 2]
    .map((axis) => Math.round(positions[index * 3 + axis]! * 1e9) || 0)
    .join(",");

/**
 * Every undirected edge of a non-degenerate triangle must be shared by exactly
 * two triangles: the 2-manifold "no holes, no fins" oracle. Vertices weld by
 * position (faces do not share indices), and triangles with a repeated welded
 * vertex (a sphere pole ring, a cone apex ring) carry no surface and are
 * skipped.
 */
const isWatertight = (t: {
  positions: number[];
  indices: number[];
}): boolean => {
  const counts = new Map<string, number>();
  for (let i = 0; i < t.indices.length; i += 3) {
    const keys = [0, 1, 2].map((corner) =>
      keyAt(t.positions, t.indices[i + corner]!),
    );
    if (new Set(keys).size < 3) continue; // degenerate: no surface, no edges
    for (let e = 0; e < 3; ++e) {
      const edge = [keys[e]!, keys[(e + 1) % 3]!]
        .sort((a, b) => a.localeCompare(b))
        .join("|");
      counts.set(edge, (counts.get(edge) ?? 0) + 1);
    }
  }
  for (const count of counts.values()) if (count !== 2) return false;
  return counts.size > 0;
};

/** Signed volume via the divergence theorem, exact for a closed polyhedron. */
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
 * Solid primitives must be WATERTIGHT (#1143). The cylinder lattice used to
 * emit only its side wall: a barrel prop was see-through from above under
 * back-face culling, and the winding sweep's `volume > 0` oracle passed
 * vacuously (an open side wall already fluxes ⅔·πr²h). Closing the ends makes
 * the divergence-theorem volume equal the analytic n-gon solid EXACTLY, which
 * is the oracle no open surface can fake, and the cone's side normals must ride
 * the slant instead of the straight cylinder's horizontal ring.
 *
 * Scenarios:
 *
 * 1. Box, sphere, cylinder, cone, and capsule are 2-manifold: every welded
 *    non-degenerate edge is shared by exactly two triangles.
 * 2. Closed signed volumes match the analytic n-gon solids exactly: prism `A·h`
 *    (cylinder), pyramid `A·h/3` (cone), bounding prism `A·(h+2r)` (capsule).
 * 3. Every emitted normal is unit length, and the cone's side normals carry the
 *    slant's exact y-component `(0 − r)/√(h² + r²)`, not 0.
 * 4. Negative twin: the plane stays a degenerate zero-volume solid, exempt from
 *    the watertight demand, its signed volume exactly 0.
 */
export const test_geometry_tessellate_watertight = (): void => {
  const solids: AutoMoviePrimitiveShape[] = [
    { type: "box", width: 0.4, height: 0.6, depth: 0.2 },
    { type: "sphere", radius: 0.5 },
    { type: "cylinder", radius: 0.3, height: 1 },
    { type: "cone", radius: 0.3, height: 1 },
    { type: "capsule", radius: 0.2, height: 1 },
  ];
  for (const shape of solids)
    TestValidator.predicate(
      `${shape.type}: watertight (every edge shared by exactly two triangles)`,
      isWatertight(tessellate(shape)),
    );

  TestValidator.predicate(
    "cylinder volume equals the analytic n-gon prism",
    nclose(
      signedVolume(tessellate({ type: "cylinder", radius: 0.3, height: 1 })),
      ngonArea(0.3) * 1,
      1e-12,
    ),
  );
  TestValidator.predicate(
    "cone volume equals the analytic n-gon pyramid",
    nclose(
      signedVolume(tessellate({ type: "cone", radius: 0.3, height: 1 })),
      (ngonArea(0.3) * 1) / 3,
      1e-12,
    ),
  );
  TestValidator.predicate(
    "capsule volume equals its closed bounding n-gon prism",
    nclose(
      signedVolume(tessellate({ type: "capsule", radius: 0.2, height: 1 })),
      ngonArea(0.2) * (1 + 2 * 0.2),
      1e-12,
    ),
  );

  for (const shape of solids) {
    const t = tessellate(shape);
    TestValidator.predicate(
      `${shape.type}: normals are unit length`,
      Array.from({ length: t.normals.length / 3 }, (_, i) =>
        Math.hypot(
          t.normals[i * 3]!,
          t.normals[i * 3 + 1]!,
          t.normals[i * 3 + 2]!,
        ),
      ).every((length) => nclose(length, 1, 1e-9)),
    );
  }
  const cone = tessellate({ type: "cone", radius: 0.3, height: 1 });
  const slantY = (0 - 0.3) / Math.hypot(1, 0.3);
  const sideVertexCount = 2 * (SEGMENTS + 1); // ring pairs before the base cap
  TestValidator.predicate(
    "cone side normals ride the slant, not the horizontal ring",
    Array.from(
      { length: sideVertexCount },
      (_, i) => cone.normals[i * 3 + 1]!,
    ).every((ny) => nclose(ny, slantY, 1e-9)),
  );

  const plane = tessellate({ type: "plane", width: 2, depth: 3 });
  TestValidator.predicate(
    "the plane stays a degenerate zero-volume solid",
    nclose(signedVolume(plane), 0, 1e-12),
  );
};
