import { Vector3 } from "@automovie/engine";

/** A position and physical first derivative on a millimetre-valued section. */
export interface IPortraitNasalJet {
  /** XYZ in the common head frame, in mm. */
  point: readonly number[];
  /** dXYZ/ds for physical section distance s in mm; this is not normalized. */
  derivative: readonly number[];
}

/**
 * Interpolate two complete section jets with one cubic Hermite polynomial.
 * Parameter t is dimensionless in [0,1]; span is the positive physical interval
 * in mm. Both neighbours use the same jet at their shared end, so position and
 * first derivative have one owner. Reversing a section requires reversing its
 * derivative signs as well as swapping endpoints.
 *
 * The value uses the equivalent four Bernstein controls and convex de Casteljau
 * evaluation. Its domain is their convex hull, not merely the endpoint box:
 * authored tangents can intentionally form a rounded shoulder between ends.
 * The returned derivative is with respect to physical distance, not t. Exact
 * endpoint returns avoid arithmetic moving a shared seam. Nonrepresentable
 * controls or derivatives refuse rather than emitting a broken surface.
 */
export function samplePortraitNasalSection(
  left: IPortraitNasalJet,
  right: IPortraitNasalJet,
  span: number,
  t: number,
): { point: number[]; derivative: number[] } {
  if (
    !Number.isFinite(span) ||
    span <= 0 ||
    !Number.isFinite(t) ||
    t < 0 ||
    t > 1 ||
    [left.point, left.derivative, right.point, right.derivative].some(
      (p) => p.length !== 3 || !p.every(Number.isFinite),
    )
  )
    throw new Error(
      "A nasal section needs finite XYZ jets, positive span and a unit parameter.",
    );
  if (t === 0)
    return { point: [...left.point], derivative: [...left.derivative] };
  if (t === 1)
    return { point: [...right.point], derivative: [...right.derivative] };
  const offset = (derivative: number): number => {
    const product = span * derivative;
    return Number.isFinite(product) ? product / 3 : (span / 3) * derivative;
  };
  const controls = [
    [...left.point],
    left.point.map((value, axis) => value + offset(left.derivative[axis])),
    right.point.map((value, axis) => value - offset(right.derivative[axis])),
    [...right.point],
  ];
  if (controls.some((p) => !p.every(Number.isFinite)))
    throw new Error(
      "Nasal section tangent controls exceed the finite coordinate domain.",
    );
  // A convex mix cannot leave its endpoint interval; keep that mathematical
  // bound even when floating addition rounds just beyond the larger endpoint.
  const mix = (a: number, b: number): number =>
    Math.max(Math.min(a, b), Math.min(Math.max(a, b), (1 - t) * a + t * b));
  const first = [0, 1, 2].map((i) =>
    controls[i].map((value, axis) => mix(value, controls[i + 1][axis])),
  );
  const second = [0, 1].map((i) =>
    first[i].map((value, axis) => mix(value, first[i + 1][axis])),
  );
  const point = second[0].map((value, axis) => mix(value, second[1][axis]));
  const derivative = second[0].map(
    (value, axis) => 3 * ((second[1][axis] - value) / span),
  );
  if (!derivative.every(Number.isFinite))
    throw new Error(
      "Nasal section derivative exceeds the finite coordinate domain.",
    );
  return { point, derivative };
}

/**
 * Compose a boundary-jet correction with its unchanged far end. The signed
 * distance follows one shared transverse direction: positive on exterior skin,
 * negative into the vestibule. The requested derivative therefore changes sign
 * when using the inward section's positive local parameter. Both sides reach
 * the same boundary value and physical derivative at distance zero.
 */
export function portraitNasalJetCorrection(
  positionDelta: readonly number[],
  derivativeDelta: readonly number[],
  span: number,
  signedDistance: number,
): number[] {
  if (!Number.isFinite(signedDistance))
    throw new Error("A nasal section distance must be finite.");
  const direction = signedDistance < 0 ? -1 : 1;
  const left = {
    point: positionDelta,
    derivative: derivativeDelta.map((value) => value * direction),
  };
  const right = { point: [0, 0, 0], derivative: [0, 0, 0] };
  return samplePortraitNasalSection(
    left,
    right,
    span,
    Math.min(1, Math.abs(signedDistance) / span),
  ).point;
}

/** Group-owned aperture placement; broad body sections never refit these axes. */
export interface IPortraitNasalApertureFrame {
  /** Vestibular axis origin in head millimetres. */
  origin: readonly number[];
  /** Nonzero inward direction, normalized independently of the body sections. */
  inward: readonly number[];
}

/** A final shared rim sample and its positive exterior transverse direction. */
export interface IPortraitNasalRimJet {
  point: readonly number[];
  tangent: readonly number[];
  transverse: readonly number[];
}

/**
 * Derive the final rim jet once for exterior and vestibular consumers. Tangent
 * follows the cyclic boundary. Its cross product with the existing common
 * normal gives the co-normal; the supplied adjacent exterior point chooses the
 * physical outward sign. No body-volume parameter participates in this frame.
 */
export function portraitNasalRimJets(
  points: readonly (readonly number[])[],
  normals: readonly (readonly number[])[],
  exterior: readonly (readonly number[])[],
): IPortraitNasalRimJet[] {
  if (
    points.length < 3 ||
    normals.length !== points.length ||
    exterior.length !== points.length ||
    [...points, ...normals, ...exterior].some(
      (p) => p.length !== 3 || !p.every(Number.isFinite),
    )
  )
    throw new Error(
      "Shared nasal rim jets need aligned finite point, normal and exterior samples.",
    );
  return points.map((point, i) => {
    const before = points[(i + points.length - 1) % points.length],
      after = points[(i + 1) % points.length];
    const tangent = Vector3.normalize(
      Vector3.create(
        after[0] - before[0],
        after[1] - before[1],
        after[2] - before[2],
      ),
    );
    const normal = Vector3.normalize(
      Vector3.create(...(normals[i] as [number, number, number])),
    );
    let transverse = Vector3.normalize(Vector3.cross(tangent, normal));
    const toward = Vector3.create(
      ...(exterior[i].map((v, axis) => v - point[axis]) as [
        number,
        number,
        number,
      ]),
    );
    const agreement = Vector3.dot(transverse, toward);
    if (
      ![
        tangent.x,
        tangent.y,
        tangent.z,
        transverse.x,
        transverse.y,
        transverse.z,
        agreement,
      ].every(Number.isFinite) ||
      Vector3.length(tangent) === 0 ||
      Vector3.length(transverse) === 0 ||
      agreement === 0
    )
      throw new Error(
        "A nasal rim jet needs a regular tangent and an unambiguous exterior side.",
      );
    if (agreement < 0) transverse = Vector3.scale(transverse, -1);
    return {
      point: [...point],
      tangent: [tangent.x, tangent.y, tangent.z],
      transverse: [transverse.x, transverse.y, transverse.z],
    };
  });
}

/**
 * Shape a complete vestibular meridian from its shared exterior jet to a floor.
 * The middle section contracts the rim about the group datum and travels inward;
 * its one derivative belongs to both Hermite intervals. The final derivative is
 * radial in the floor plane, so all meridians approach a common smooth pole.
 * This is a geometric lining hypothesis, not a measured airway reconstruction.
 *
 * Depth and both intervals use millimetres. Progress spans [0,1] from rim to
 * floor. The returned initial derivative points inward, opposite the exterior
 * co-normal. Neither the body height nor a newly fitted plane moves the datum.
 */
export function samplePortraitNasalEntry(
  rim: IPortraitNasalRimJet,
  frame: IPortraitNasalApertureFrame,
  depth: number,
  contraction: number,
  progress: number,
): { point: number[]; derivative: number[] } {
  if (
    !Number.isFinite(depth) ||
    depth <= 0 ||
    !Number.isFinite(contraction) ||
    contraction <= 0 ||
    contraction >= 1 ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1 ||
    [frame.origin, frame.inward, rim.point, rim.tangent, rim.transverse].some(
      (v) => v.length !== 3 || !v.every(Number.isFinite),
    )
  )
    throw new Error(
      "A nasal entry needs finite jets, positive depth and a contracted middle section.",
    );
  const inward = Vector3.normalize(
    Vector3.create(...(frame.inward as [number, number, number])),
  );
  if (Vector3.length(inward) === 0)
    throw new Error("A nasal entry needs a nonzero inward group axis.");
  const axis = [inward.x, inward.y, inward.z];
  const floor = frame.origin.map((v, i) => v + depth * axis[i]);
  const middle = frame.origin.map(
    (v, i) => v + contraction * (rim.point[i] - v) + depth * axis[i],
  );
  const radial = middle.map((v, i) => floor[i] - v);
  const firstSpan = Math.hypot(...middle.map((v, i) => v - rim.point[i]));
  const lastSpan = Math.hypot(...radial);
  const total = firstSpan + lastSpan;
  const axial = radial.reduce((sum, v, i) => sum + v * axis[i], 0);
  const floorRadial = radial.map((v, i) => v - axial * axis[i]);
  const floorRadius = Math.hypot(...floorRadial);
  if (
    ![...floor, ...middle, firstSpan, lastSpan, total, floorRadius].every(
      Number.isFinite,
    ) ||
    firstSpan === 0 ||
    lastSpan === 0 ||
    floorRadius === 0
  )
    throw new Error(
      "A nasal entry needs finite nonzero body and floor sections.",
    );
  const middleDerivative = floor.map((v, i) => (v - rim.point[i]) / total);
  const endDerivative = floorRadial.map((v) => v / floorRadius);
  const split = firstSpan / total;
  return progress <= split
    ? samplePortraitNasalSection(
        { point: rim.point, derivative: rim.transverse.map((v) => -v) },
        { point: middle, derivative: middleDerivative },
        firstSpan,
        progress / split,
      )
    : samplePortraitNasalSection(
        { point: middle, derivative: middleDerivative },
        { point: floor, derivative: endDerivative },
        lastSpan,
        (progress - split) / (1 - split),
      );
}
