import { Vector3 } from "@automovie/engine";

import type { IPortraitFinalSurfaceHost } from "./portraitFinalSurface";

/**
 * Match the first joining row to the actual planes on both sides of its boundary.
 * For a directed joining edge A→B, T is its unit tangent and N the neighbouring
 * face normal. N×T points into the join. The inner vertex retains its along-edge
 * coordinate and perpendicular edge distance, but uses that transverse direction.
 * Thus its boundary triangle has the same oriented normal as its neighbour.
 *
 * Coordinates are millimetres. Only interior vertices are proposed; boundary,
 * native core and surrounding skin remain fixed. Compatible repeated targets
 * agree within 1e-8 mm; incompatible first-row ownership refuses. The caller must
 * hold these targets during subsequent fairing. This is a discrete tangent-plane
 * condition, not a curvature or self-intersection guarantee.
 */
export function fitPortraitJoinBoundary(
  host: IPortraitFinalSurfaceHost,
  group: number,
): { vertex: number; target: number[] }[] {
  if (
    !Number.isInteger(group) ||
    group < 0 ||
    host.groups.length * 3 !== host.indices.length ||
    host.positions.some((p) => p.length !== 3 || !p.every(Number.isFinite)) ||
    host.indices.some(
      (v) => !Number.isInteger(v) || v < 0 || v >= host.positions.length,
    )
  )
    throw new Error(
      "Join tangency needs finite resident triangular geometry and a region label.",
    );
  const points = host.positions.map((p) =>
    Vector3.create(...(p as [number, number, number])),
  );
  const key = (a: number, b: number) => (a < b ? `${a}/${b}` : `${b}/${a}`);
  const edges = new Map<
    string,
    { a: number; b: number; vertex: number; count: number; outside: number[][] }
  >();
  for (let f = 0; f < host.groups.length; f++)
    if (host.groups[f] === group) {
      const tri = host.indices.slice(f * 3, f * 3 + 3);
      for (let c = 0; c < 3; c++) {
        const a = tri[c],
          b = tri[(c + 1) % 3],
          id = key(a, b),
          edge = edges.get(id);
        if (edge === undefined)
          edges.set(id, {
            a,
            b,
            vertex: tri[(c + 2) % 3],
            count: 1,
            outside: [],
          });
        else edge.count++;
      }
    }
  const outsideVertices = new Set<number>();
  for (let f = 0; f < host.groups.length; f++)
    if (host.groups[f] !== group) {
      const tri = host.indices.slice(f * 3, f * 3 + 3);
      for (let c = 0; c < 3; c++) {
        outsideVertices.add(tri[c]);
        const edge = edges.get(key(tri[c], tri[(c + 1) % 3]));
        if (edge !== undefined) edge.outside.push([...tri]);
      }
    }
  const targets = new Map<number, number[]>();
  for (const edge of edges.values()) {
    if (edge.count === 2 && edge.outside.length === 0) continue;
    if (
      edge.count !== 1 ||
      edge.outside.length !== 1 ||
      outsideVertices.has(edge.vertex)
    )
      throw new Error(
        "Join tangency needs two-sided boundaries with movable interior samples.",
      );
    const a = points[edge.a],
      b = points[edge.b],
      p = points[edge.vertex];
    const tangent = Vector3.normalize(Vector3.subtract(b, a)),
      face = edge.outside[0];
    const normal = Vector3.normalize(
      Vector3.cross(
        Vector3.subtract(points[face[1]], points[face[0]]),
        Vector3.subtract(points[face[2]], points[face[0]]),
      ),
    );
    const transverse = Vector3.normalize(Vector3.cross(normal, tangent));
    const offset = Vector3.subtract(p, a),
      along = Vector3.dot(offset, tangent);
    const width = Vector3.length(
      Vector3.subtract(offset, Vector3.scale(tangent, along)),
    );
    if (
      !(Vector3.length(transverse) > 0) ||
      !(width > 0) ||
      !Number.isFinite(width)
    )
      throw new Error("Join tangent frames must be finite and nondegenerate.");
    const target = Vector3.add(
      a,
      Vector3.add(
        Vector3.scale(tangent, along),
        Vector3.scale(transverse, width),
      ),
    );
    const previous = targets.get(edge.vertex);
    if (
      previous !== undefined &&
      Vector3.length(
        Vector3.subtract(
          target,
          Vector3.create(...(previous as [number, number, number])),
        ),
      ) > 1e-8
    )
      throw new Error(
        "Joining boundary planes request incompatible first-row positions.",
      );
    targets.set(edge.vertex, [target.x, target.y, target.z]);
  }
  return [...targets].map(([vertex, target]) => ({ vertex, target }));
}
