import type { IAutoMoviePlanarPoint } from "@automovie/interface";

/** Largest cross product or distance a free-form planar ring may call zero. */
const REGION_EPSILON = 1e-12;

/**
 * Return the first deterministic hygiene failure in one planar region, or
 * `null` when every ring describes one unambiguous bounded region.
 *
 * The result is a message rather than repaired geometry. Drawing,
 * triangulation, and support decomposition need different outputs, but they
 * must agree on whether their shared input has an interior. A caller that can
 * report a gap may retain the message; a constructor can throw it verbatim.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Detects non-finite, degenerate, self-crossing, and invalid nested planar regions before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Implements one shared numeric and topology validation boundary for planar consumers.
 * @author Samchon
 */
export const autoMoviePlanarRegionFailure = (props: {
  outer: readonly IAutoMoviePlanarPoint[];
  holes?: ReadonlyArray<readonly IAutoMoviePlanarPoint[]>;
  label?: string;
}): string | null => {
  const label = props.label ?? "polygon";
  const holes = props.holes ?? [];
  const labels = [
    `${label} outer ring`,
    ...holes.map((_hole, index) => `${label} hole[${index}]`),
  ];
  const loops = [props.outer, ...holes];
  for (let index = 0; index < loops.length; ++index) {
    const failure = ringFailure(loops[index]!, labels[index]!);
    if (failure !== null) return failure;
  }
  for (let left = 0; left + 1 < loops.length; ++left)
    for (let right = left + 1; right < loops.length; ++right) {
      const one = loops[left]!;
      const other = loops[right]!;
      for (let a = 0; a < one.length; ++a)
        for (let b = 0; b < other.length; ++b)
          if (
            segmentsMeet(
              one[a]!,
              one[(a + 1) % one.length]!,
              other[b]!,
              other[(b + 1) % other.length]!,
            )
          )
            return `${labels[left]} and ${labels[right]} touch or cross at edge ${a} and edge ${b}`;
    }
  for (let hole = 1; hole < loops.length; ++hole) {
    const probe = loops[hole]![0]!;
    if (pointInRing(probe, loops[0]!) === false)
      return `${labels[hole]} must lie inside ${labels[0]}`;
    for (let other = 1; other < loops.length; ++other)
      if (other !== hole && pointInRing(probe, loops[other]!))
        return `${labels[hole]} must lie outside ${labels[other]}`;
  }
  return null;
};

/** The first defect inside one ring, before relations to other rings matter. */
const ringFailure = (
  ring: readonly IAutoMoviePlanarPoint[],
  label: string,
): string | null => {
  if (ring.length < 3) return `${label} needs at least three points`;
  for (let index = 0; index < ring.length; ++index) {
    const point = ring[index]!;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      return `${label}[${index}] must be finite`;
  }
  const size = ring.length;
  for (let index = 0; index < size; ++index) {
    const point = ring[index]!;
    const next = ring[(index + 1) % size]!;
    if (Math.hypot(next.x - point.x, next.y - point.y) <= REGION_EPSILON)
      return `${label}[${index}] repeats the point beside it`;
  }
  // Preserve the established procedural diagnostic order: an area-free ring
  // is rejected before topology is classified. A nonzero-area self-crossing
  // ring still reaches the explicit crossing diagnosis below.
  if (Math.abs(signedArea(ring)) <= REGION_EPSILON)
    return `${label} encloses no area`;
  for (let index = 0; index < size; ++index) {
    const previous = ring[(index + size - 1) % size]!;
    const point = ring[index]!;
    const next = ring[(index + 1) % size]!;
    if (
      Math.abs(cross(previous, point, next)) <= REGION_EPSILON &&
      (point.x - previous.x) * (next.x - point.x) +
        (point.y - previous.y) * (next.y - point.y) <
        0
    )
      return `${label}[${index}] doubles back along its own edge`;
  }
  return ringCrossingFailure(ring, label);
};

/** First meeting of two non-neighbouring edges in one ring. */
const ringCrossingFailure = (
  ring: readonly IAutoMoviePlanarPoint[],
  label: string,
): string | null => {
  for (let left = 0; left < ring.length; ++left)
    for (let right = left + 1; right < ring.length; ++right)
      if (
        neighbouringEdges(ring.length, left, right) === false &&
        segmentsMeet(
          ring[left]!,
          ring[(left + 1) % ring.length]!,
          ring[right]!,
          ring[(right + 1) % ring.length]!,
        )
      )
        return `${label} crosses itself between edge ${left} and edge ${right}`;
  return null;
};

/** Are two edges of the same ring the pair that share a corner? */
const neighbouringEdges = (
  size: number,
  left: number,
  right: number,
): boolean => (left + 1) % size === right || (right + 1) % size === left;

/** Signed shoelace area. */
const signedArea = (points: readonly IAutoMoviePlanarPoint[]): number => {
  let total = 0;
  for (let index = 0; index < points.length; ++index) {
    const from = points[index]!;
    const to = points[(index + 1) % points.length]!;
    total += from.x * to.y - to.x * from.y;
  }
  return total / 2;
};

/** Twice the signed area of `origin -> from -> to`. */
const cross = (
  origin: IAutoMoviePlanarPoint,
  from: IAutoMoviePlanarPoint,
  to: IAutoMoviePlanarPoint,
): number =>
  (from.x - origin.x) * (to.y - origin.y) -
  (from.y - origin.y) * (to.x - origin.x);

/** Do two closed segments share any point? */
const segmentsMeet = (
  fromA: IAutoMoviePlanarPoint,
  toA: IAutoMoviePlanarPoint,
  fromB: IAutoMoviePlanarPoint,
  toB: IAutoMoviePlanarPoint,
): boolean => {
  if (
    straddles(cross(fromB, toB, fromA), cross(fromB, toB, toA)) &&
    straddles(cross(fromA, toA, fromB), cross(fromA, toA, toB))
  )
    return true;
  const contacts: ReadonlyArray<
    readonly [
      IAutoMoviePlanarPoint,
      IAutoMoviePlanarPoint,
      IAutoMoviePlanarPoint,
    ]
  > = [
    [fromB, toB, fromA],
    [fromB, toB, toA],
    [fromA, toA, fromB],
    [fromA, toA, toB],
  ];
  return contacts.some(([from, to, point]) => {
    if (Math.abs(cross(from, to, point)) > REGION_EPSILON) return false;
    const spanX = to.x - from.x;
    const spanY = to.y - from.y;
    const along =
      ((point.x - from.x) * spanX + (point.y - from.y) * spanY) /
      (spanX * spanX + spanY * spanY);
    return along >= -REGION_EPSILON && along <= 1 + REGION_EPSILON;
  });
};

/** Are two points on strictly opposite sides of one line? */
const straddles = (left: number, right: number): boolean =>
  Math.abs(left) > REGION_EPSILON &&
  Math.abs(right) > REGION_EPSILON &&
  left * right < 0;

/** Even-odd ray cast along +X; validation keeps the probe off-ring. */
const pointInRing = (
  point: IAutoMoviePlanarPoint,
  ring: readonly IAutoMoviePlanarPoint[],
): boolean => {
  let inside = false;
  for (let index = 0; index < ring.length; ++index) {
    const from = ring[index]!;
    const to = ring[(index + 1) % ring.length]!;
    if (
      from.y > point.y !== to.y > point.y &&
      point.x <
        from.x + ((point.y - from.y) / (to.y - from.y)) * (to.x - from.x)
    )
      inside = !inside;
  }
  return inside;
};
