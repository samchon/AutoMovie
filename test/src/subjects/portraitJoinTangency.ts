import { Vector3 } from "@automovie/engine";

import type { IPortraitFinalSurfaceHost } from "./portraitFinalSurface";

/**
 * Match the first joining row to the actual planes on both sides of its boundary.
 * The annulus is a height surface over its existing head-XY triangulation.
 * Its first sample moves towards the shared edge midpoint only when farther
 * than half that edge's projected length. This gives short boundary segments
 * a local derivative sample instead of extrapolating their planes across the
 * whole annulus. The neighbouring plane then supplies Z at that XY location.
 *
 * Coordinates are millimetres. Only interior vertices are proposed; boundary,
 * native core and surrounding skin remain fixed. Compatible repeated targets
 * agree within 1e-8 mm; incompatible first-row ownership refuses. The caller must
 * hold these targets and all XY coordinates during subsequent height fairing.
 * Every resulting join triangle must retain positive projected area. A vertical
 * or backward-facing supporting plane cannot define this height chart and is
 * refused. This is a discrete tangent-plane condition, not a curvature guarantee
 * or a claim about intersections with geometry outside this annular chart.
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
    const face = edge.outside[0];
    const normal = Vector3.normalize(
      Vector3.cross(
        Vector3.subtract(points[face[1]], points[face[0]]),
        Vector3.subtract(points[face[2]], points[face[0]]),
      ),
    );
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy),
      width = (dx * (p.y - a.y) - dy * (p.x - a.x)) / length;
    if (
      !(normal.z > 0) ||
      !(length > 0) ||
      !Number.isFinite(length) ||
      !(width > 0) ||
      !Number.isFinite(width)
    )
      throw new Error(
        "Join tangency needs a finite forward-facing height chart.",
      );
    const fraction = Math.min(1, length / (2 * width)),
      middleX = a.x + dx / 2,
      middleY = a.y + dy / 2,
      x = middleX + fraction * (p.x - middleX),
      y = middleY + fraction * (p.y - middleY);
    const target = Vector3.create(
      x,
      y,
      a.z - (normal.x * (x - a.x) + normal.y * (y - a.y)) / normal.z,
    );
    if (![target.x, target.y, target.z].every(Number.isFinite))
      throw new Error("Join tangent-plane extrapolation must remain finite.");
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
  // Moving a last-refinement face centre towards its boundary edge stays inside
  // that parent triangle. Check the entire proposed chart as well: callers with
  // a different/nonconvex vertex star must not silently publish a fold. Keeping
  // this checked XY chart fixed makes later Z fairing unable to reverse a face.
  for (let f = 0; f < host.groups.length; f++)
    if (host.groups[f] === group) {
      const [a, b, c] = host.indices
        .slice(f * 3, f * 3 + 3)
        .map((v) => targets.get(v) ?? host.positions[v]);
      const area =
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (!(area > 0) || !Number.isFinite(area))
        throw new Error(
          "Join tangent rows must preserve positive XY triangles.",
        );
    }
  return [...targets].map(([vertex, target]) => ({ vertex, target }));
}
