import { blendPortraitSkin } from "./blendPortraitSkin";
import type { IPortraitFinalSurfaceHost } from "./portraitFinalSurface";
import { fitPortraitJoinBoundary } from "./portraitJoinTangency";

/**
 * Join two fixed boundaries by adapting a supplied source height surface.
 * The source supplies anatomical shape throughout the annulus; the attachment
 * supplies only its difference from that shape. Absolute-height biharmonic
 * fairing produced large extrema even after the XY chart could no longer fold.
 *
 * First-row planes and positive XY admission belong to fitPortraitJoinBoundary.
 * The existing positive-weight skin relaxation interpolates Z displacements
 * from those rows and both boundaries. Its zero initial interior displacement
 * and convex updates stay within zero and the fixed displacement extrema.
 * This is bounded graph relaxation, not an exact harmonic or curvature solve.
 * Coordinates and the deterministic source-height callback use millimetres.
 */
export function fitPortraitJoinReference(
  host: IPortraitFinalSurfaceHost,
  group: number,
  height: (x: number, y: number) => number | null,
): { vertex: number; target: number[] }[] {
  const tangent = new Map(
    fitPortraitJoinBoundary(host, group).map((t) => [t.vertex, t.target]),
  );
  const triangles = host.groups.flatMap((g, f) =>
    g === group ? host.indices.slice(f * 3, f * 3 + 3) : [],
  );
  const used = [...new Set(triangles)];
  if (used.length === 0) return [];
  const outside = new Set(
    host.groups.flatMap((g, f) =>
      g === group ? [] : host.indices.slice(f * 3, f * 3 + 3),
    ),
  );
  const lookup = new Map(used.map((v, i) => [v, i]));
  const positions = used.map((v) => {
    const p = tangent.get(v) ?? host.positions[v];
    const z = height(p[0], p[1]);
    if (z === null || !Number.isFinite(z))
      throw new Error(
        "A joining source must provide every finite chart height.",
      );
    return [p[0], p[1], z];
  });
  const indices = triangles.map((v) => lookup.get(v)!);
  // The sum of all triangle-edge lengths exceeds every simple graph path.
  // This reaches the whole compact annulus without inventing a physical radius
  // or allowing the adaptation to escape into the native core or host skin.
  let reach = 0;
  for (let i = 0; i < indices.length; i += 3)
    for (let c = 0; c < 3; c++) {
      const a = positions[indices[i + c]],
        b = positions[indices[i + ((c + 1) % 3)]];
      reach += Math.hypot(...a.map((v, k) => v - b[k]));
    }
  if (!Number.isFinite(reach))
    throw new Error("Joining source distances must remain finite.");
  const constraints = used.flatMap((v, i) =>
    outside.has(v) || tangent.has(v)
      ? [
          {
            vertex: i,
            target: [...(tangent.get(v) ?? host.positions[v])],
            reach,
          },
        ]
      : [],
  );
  const adapted = blendPortraitSkin(positions, indices, constraints);
  return used.flatMap((vertex, i) => {
    const target = adapted[i];
    if (!target.every(Number.isFinite))
      throw new Error("Joining source adaptation must remain finite.");
    return outside.has(vertex) ? [] : [{ vertex, target }];
  });
}
