/** A local anterior nasal section in the common millimetre, +Z-forward frame. */
export interface IPortraitNasalLobule {
  /** Resident skin datum; the group supplies its already scaled XYZ position. */
  anchor: number;
  /** Anterior section pole offset from the datum in head XYZ millimetres. */
  offset: readonly number[];
  /** Positive X/Y half-extents and depth radius relative to the tangent, in mm. */
  radii: readonly number[];
  /** Inner elliptical radius in [0,1). Inside it, the section owns full depth. */
  core: number;
  /** Optional local tangent dz/dx and dz/dy, in mm/mm; omission is [0,0]. */
  slope?: readonly number[];
}

/**
 * Own anterior ellipsoid sections rather than adding scalar inflation to a
 * sparse inferred tip. For q=(x/rx)^2+(y/ry)^2<1 the section depth is
 * apexZ+sx*dx+sy*dy-rz*(1-sqrt(1-q)). Width, height, anterior curvature
 * and the supporting tangent are independent. The affine tangent term lets
 * a sidewall section incline instead of forcing every ala to face forward.
 * A cubic annular fade joins both value and slope to the supplied host at q=1.
 * Its quadratic vanishing dominates the ellipsoid's square-root edge slope.
 *
 * Overlaps share a weighted target and a combined weight 1-product(1-w).
 * This is order-independent in real arithmetic and cannot sum several apex
 * displacements. The group calls this same evaluator for exterior and rim
 * samples before lining construction. Omission/empty returns exact identity.
 * No posterior surface is selected here: the nose socket owns the population.
 */
export function createPortraitNasalLobules(
  input: readonly IPortraitNasalLobule[] = [],
): (
  datums: readonly (readonly number[])[],
) => (point: readonly number[]) => number {
  const shapes = input.map((shape) => ({
    ...shape,
    offset: [...shape.offset],
    radii: [...shape.radii],
    slope: [...(shape.slope ?? [0, 0])],
  }));
  if (
    shapes.length > 32 ||
    shapes.some(
      (s) =>
        !Number.isInteger(s.anchor) ||
        s.anchor < 0 ||
        s.offset.length !== 3 ||
        !s.offset.every(Number.isFinite) ||
        s.radii.length !== 3 ||
        s.radii.some((r) => !Number.isFinite(r) || r <= 0) ||
        s.slope.length !== 2 ||
        !s.slope.every(Number.isFinite) ||
        !Number.isFinite(s.core) ||
        s.core < 0 ||
        s.core >= 1,
    )
  )
    throw new Error(
      "Nasal lobules need resident identities, finite offsets, positive XYZ radii and core in [0,1).",
    );
  return (datums) => {
    const sections = shapes.map((shape) => {
      const datum = datums[shape.anchor];
      if (
        datum === undefined ||
        datum.length !== 3 ||
        !datum.every(Number.isFinite)
      )
        throw new Error("A nasal lobule needs a resident finite XYZ datum.");
      const apex = datum.map((v, axis) => v + shape.offset[axis]);
      if (!apex.every(Number.isFinite))
        throw new Error("A nasal lobule apex exceeds its finite frame.");
      return { ...shape, apex };
    });
    return (point) => {
      if (point.length !== 3 || !point.every(Number.isFinite))
        throw new Error("A nasal lobule sample needs finite XYZ coordinates.");
      let total = 0,
        target = 0,
        retained = 1;
      for (const section of sections) {
        const x = (point[0] - section.apex[0]) / section.radii[0];
        const y = (point[1] - section.apex[1]) / section.radii[1];
        const q = x * x + y * y;
        if (q >= 1) continue;
        const t = Math.max(
          0,
          (Math.sqrt(q) - section.core) / (1 - section.core),
        );
        // Factored complement stays nonnegative near the outer edge.
        const weight = (1 - t) ** 2 * (1 + 2 * t);
        const depth =
          section.apex[2] +
          section.slope[0] * (point[0] - section.apex[0]) +
          section.slope[1] * (point[1] - section.apex[1]) -
          section.radii[2] * (1 - Math.sqrt(1 - q));
        // A running weighted mean avoids summing 32 potentially large depths.
        const ratio = weight / (total + weight);
        target = target * (1 - ratio) + depth * ratio;
        total += weight;
        retained *= 1 - weight;
      }
      const delta = total === 0 ? 0 : (target - point[2]) * (1 - retained);
      if (!Number.isFinite(delta))
        throw new Error("A nasal lobule exceeds its finite depth domain.");
      return delta;
    };
  };
}
