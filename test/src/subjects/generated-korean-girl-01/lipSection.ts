/**
 * Independent vermilion relief, added to the existing measured lip in mm.
 * Body/tubercle/pad projections are signed; zero retains the original section.
 * Widths and pad separation are fractions of the inner mouth's half-width.
 */
export interface IPortraitLipSection {
  /** Broad upper vermilion body projection, in mm. */
  upperBody: number;
  /** Additional central upper tubercle projection, in mm. */
  upperTubercle: number;
  /** Positive central-tubercle width as a fraction of oral half-width, at most one. */
  upperTubercleWidth: number;
  /** Broad lower vermilion body projection, in mm. */
  lowerBody: number;
  /** Additional projection of each lower lateral pad, in mm. */
  lowerPads: number;
  /** Each lower pad's distance from the midline as a half-width fraction, in [0,1]. */
  lowerPadOffset: number;
  /** Positive pad width as a fraction of oral half-width, at most one. */
  lowerPadWidth: number;
}

/** Coordinates within one lip band, independent of a particular mesh's IDs. */
export interface IPortraitLipCoordinate {
  side: "upper" | "lower";
  /** -1 at the anatomical right inner corner, +1 at the left. */
  lateral: number;
  /** Zero at the cutaneous border, one at the oral aperture. */
  across: number;
}

/**
 * Own a section profile and evaluate forward relief in its live lip coordinates.
 * Both band edges and both corners receive exactly zero: the section cannot
 * independently move the skin junction, aperture, or dental attachment.
 */
export const createPortraitLipSection = (
  input: IPortraitLipSection,
): ((coordinate: IPortraitLipCoordinate) => number) => {
  const shape = { ...input };
  if (
    !Object.values(shape).every(Number.isFinite) ||
    [shape.upperTubercleWidth, shape.lowerPadWidth].some(
      (v) => v <= 0 || v > 1,
    ) ||
    shape.lowerPadOffset < 0 ||
    shape.lowerPadOffset > 1
  )
    throw new Error(
      "Lip sections need finite projections and bounded relative widths.",
    );
  return ({ side, lateral: u, across: v }) => {
    if (
      !Number.isFinite(u) ||
      !Number.isFinite(v) ||
      Math.abs(u) > 1 ||
      v < 0 ||
      v > 1
    )
      throw new Error(
        "Lip section coordinates must stay inside their normalized band.",
      );
    if (Math.abs(u) === 1 || v === 0 || v === 1) return 0;
    // Smooth envelopes retain tangent continuity at the band edges. Central
    // upper and paired lower relief are independent from the broad body, so
    // increasing lip projection need not inflate every subunit equally.
    const envelope = (1 - u * u) ** 2 * Math.sin(Math.PI * v) ** 2;
    const projection =
      side === "upper"
        ? shape.upperBody +
          shape.upperTubercle * Math.exp(-((u / shape.upperTubercleWidth) ** 2))
        : shape.lowerBody +
          shape.lowerPads *
            (Math.exp(
              -(((u - shape.lowerPadOffset) / shape.lowerPadWidth) ** 2),
            ) +
              Math.exp(
                -(((u + shape.lowerPadOffset) / shape.lowerPadWidth) ** 2),
              ));
    const result = envelope * projection;
    if (!Number.isFinite(result))
      throw new Error("Lip section relief exceeds its representable range.");
    return result;
  };
};

/**
 * Bind a closed outer lip loop and ordered inner curves to normalized sections.
 * All input points are XYZ millimetres; the result follows the mouth's curved
 * local centreline, not a horizontal head-Y threshold that mislabels a smile.
 * Outer paths are extracted from the loop's own extreme-X corners and sampled
 * linearly between retained anatomical knots. Z is deliberately not inferred.
 */
export const createPortraitLipCoordinates = (
  outer: readonly (readonly number[])[],
  upper: readonly (readonly number[])[],
  lower: readonly (readonly number[])[],
): ((point: readonly number[]) => IPortraitLipCoordinate) => {
  const sample = createPortraitLipBandSampler(outer, upper, lower);
  return (point) => sample(point).coordinate;
};

/**
 * One authoritative curved-band sample supplies both normalized coordinates and
 * its skin/oral boundaries. A contour edit must not independently guess the
 * inner Y against which lip thickness is changed. All heights remain in mm.
 */
export const createPortraitLipBandSampler = (
  outer: readonly (readonly number[])[],
  upper: readonly (readonly number[])[],
  lower: readonly (readonly number[])[],
): ((point: readonly number[]) => {
  coordinate: IPortraitLipCoordinate;
  innerY: number;
  outerY: number;
}) => {
  if (
    outer.length < 3 ||
    upper.length < 2 ||
    lower.length < 2 ||
    [...outer, ...upper, ...lower].some(
      (p) => p.length !== 3 || !p.every(Number.isFinite),
    )
  )
    throw new Error("Lip coordinates require finite outer and inner curves.");
  const minimum = Math.min(...outer.map((p) => p[0]));
  const maximum = Math.max(...outer.map((p) => p[0]));
  const first = outer.findIndex((p) => p[0] === minimum);
  const last = outer.findIndex((p) => p[0] === maximum);
  const path = (step: number) => {
    const points = [[...outer[first]]];
    for (let i = first; i !== last; ) {
      i = (i + step + outer.length) % outer.length;
      points.push([...outer[i]]);
    }
    return points;
  };
  const paths = [path(1), path(-1)].sort(
    (a, b) =>
      b.reduce((sum, p) => sum + p[1] / b.length, 0) -
      a.reduce((sum, p) => sum + p[1] / a.length, 0),
  );
  const curves = [
    paths[0],
    paths[1],
    upper.map((p) => [...p]),
    lower.map((p) => [...p]),
  ];
  if (
    curves.some(
      (curve) =>
        curve.length < 2 ||
        curve.some((p, i) => i > 0 && p[0] <= curve[i - 1][0]),
    )
  )
    throw new Error(
      "Lip curves must advance strictly from negative to positive X.",
    );
  const left = upper[0][0],
    right = upper[upper.length - 1][0];
  if (
    !Number.isFinite(right - left) ||
    upper[0].some((v, axis) => v !== lower[0][axis]) ||
    upper[upper.length - 1].some(
      (v, axis) => v !== lower[lower.length - 1][axis],
    ) ||
    minimum > left ||
    maximum < right
  )
    throw new Error(
      "Lip curves must share inner corners inside the outer span.",
    );
  const at = (curve: number[][], x: number): number => {
    const edge = curve.findIndex((p) => p[0] >= x);
    if (edge <= 0) return curve[0][1];
    const a = curve[edge - 1],
      b = curve[edge];
    // Normalize the segment before subtracting, then interpolate as a convex
    // sum. Large finite coordinates must not overflow intermediate differences.
    const scale = Math.max(Math.abs(a[0]), Math.abs(b[0]), 1);
    const t = (x / scale - a[0] / scale) / (b[0] / scale - a[0] / scale);
    return a[1] * (1 - t) + b[1] * t;
  };
  return (point) => {
    if (point.length !== 3 || !point.every(Number.isFinite))
      throw new Error("A lip coordinate sample must be a finite XYZ point.");
    const x = Math.max(left, Math.min(right, point[0]));
    const innerTop = at(curves[2], x),
      innerBottom = at(curves[3], x);
    if (innerTop < innerBottom)
      throw new Error(
        "The upper lip must remain above the lower lip at each section.",
      );
    const side = point[1] >= innerTop / 2 + innerBottom / 2 ? "upper" : "lower";
    const exterior = at(curves[side === "upper" ? 0 : 1], x);
    const interior = side === "upper" ? innerTop : innerBottom;
    const scale = Math.max(
      Math.abs(point[1]),
      Math.abs(exterior),
      Math.abs(interior),
      1,
    );
    const across =
      exterior === interior
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              (point[1] / scale - exterior / scale) /
                (interior / scale - exterior / scale),
            ),
          );
    return {
      coordinate: {
        side,
        lateral: 2 * ((x - left) / (right - left)) - 1,
        across,
      },
      innerY: interior,
      outerY: exterior,
    };
  };
};

/**
 * One thickness-ratio witness along the right(-1) to left(+1) oral span.
 *
 * @author Samchon
 */
export interface IPortraitLipBandKnot {
  at: number;
  /** Positive ratio of the current band's vertical thickness; one is identity. */
  scale: number;
}

/**
 * Resolve an optional thickness profile independently of the oral aperture.
 * Omission is identity. A scalar sets the central ratio and joins ratio one at
 * both corners; an ordered array of two to 64 knots owns the full profile and must preserve
 * those same endpoint values. Adjacent knots use a cubic smoothstep, so values
 * stay within their positive endpoint hull with zero slope at the knots.
 * The function owns copied data; a provided zero or empty array is invalid.
 */
export function createPortraitLipBandScale(
  input?: number | readonly IPortraitLipBandKnot[],
): (lateral: number) => number {
  const knots =
    input === undefined
      ? [
          { at: -1, scale: 1 },
          { at: 1, scale: 1 },
        ]
      : typeof input === "number"
        ? [
            { at: -1, scale: 1 },
            { at: 0, scale: input },
            { at: 1, scale: 1 },
          ]
        : input.map((knot) => ({ ...knot }));
  if (
    knots.length < 2 ||
    knots.length > 64 ||
    knots[0].at !== -1 ||
    knots.at(-1)!.at !== 1 ||
    knots[0].scale !== 1 ||
    knots.at(-1)!.scale !== 1 ||
    knots.some(
      (knot, i) =>
        ![knot.at, knot.scale].every(Number.isFinite) ||
        knot.scale <= 0 ||
        (i > 0 && knot.at <= knots[i - 1].at),
    )
  )
    throw new Error(
      "Lip thickness needs ordered positive ratios from -1 to +1 with identity corners.",
    );
  return (lateral) => {
    if (!Number.isFinite(lateral) || lateral < -1 || lateral > 1)
      throw new Error("Lip thickness samples must lie in the unit oral span.");
    if (lateral === -1 || lateral === 1) return 1;
    const i = knots.findIndex((knot) => knot.at >= lateral),
      a = knots[i - 1],
      b = knots[i];
    const t = (lateral - a.at) / (b.at - a.at),
      blend = t * t * (3 - 2 * t);
    return Math.max(
      Math.min(a.scale, b.scale),
      Math.min(
        Math.max(a.scale, b.scale),
        a.scale * (1 - blend) + b.scale * blend,
      ),
    );
  };
}
