import {
  createAutoMovieMeshDepthSampler,
  transformAutoMovieMesh,
} from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";

import {
  portraitPoint as p,
  portraitPart,
  portraitPatch,
  portraitSpline,
} from "../geometry";

/**
 * Subject-level pinna placement and dimensions. Lengths are millimetres and
 * scales multiply the authored outline independently of the host's shape.
 *
 * @author Samchon
 */
export interface IPortraitEarShape {
  /** Vertical centre in the head frame. */
  centerY: number;
  /** Sagittal centre in the head frame. */
  centerZ: number;
  /** Positive vertical outline multiplier. */
  heightScale: number;
  /** Positive anterior/posterior outline multiplier. */
  depthScale: number;
  /** Positive posterior-rim projection beyond the sampled host surface. */
  projection: number;
  /** Nonnegative embedding depth at the anterior root. */
  embedding: number;
}

/** Current inferred ear placement; the source photo only partially exposes one ear. */
export const portraitEarShape: IPortraitEarShape = {
  centerY: 8,
  centerZ: -45,
  heightScale: 1.15,
  depthScale: 0.75,
  projection: 12,
  embedding: 1.2,
};

/**
 * Pinnae for this portrait's inferred side anatomy. The visible folds are a
 * single surface: outer helix, intervening groove, antihelix and conchal bowl.
 * The lower outline rounds into the lobule. Dimensions are authored estimates,
 * because the photograph exposes only part of one ear beneath the hair.
 *
 * Coordinates are millimetres. Positive X is the anatomical left ear. The
 * engine mirrors the other ear, including winding and normals. The back
 * surface meets the front at the same rim, and the inner attachment lies inside
 * the head; there is no floating decorative loop masquerading as an ear.
 */
export function buildPortraitEars(
  skin: IAutoMovieMesh,
  shape: IPortraitEarShape = portraitEarShape,
): IAutoMovieModelPart[] {
  if (
    !Object.values(shape).every(Number.isFinite) ||
    shape.heightScale <= 0 ||
    shape.depthScale <= 0 ||
    shape.projection <= 0 ||
    shape.embedding < 0
  )
    throw new Error(
      "Pinna dimensions need finite placement, positive scales/projection and nonnegative embedding.",
    );
  const surfaceDepth = createAutoMovieMeshDepthSampler(skin, "x");
  // The asymmetric outline narrows from a broad upper helix into the forward
  // lobule. The helix and forked antihelix follow independent paths so the
  // inner folds retain their own placement within the outer pinna envelope.
  const outlinePoints = [
    [22, -12],
    [18, -17],
    [10, -18],
    [1, -14],
    [-9, -7],
    [-18, 4],
    [-21, 11],
    [-18, 20],
    [-9, 22],
    [-3, 22],
    [7, 20],
    [17, 17],
    [23, 3],
  ].map(([y, z]) => p(0, y, z));
  const closed = [
    outlinePoints[outlinePoints.length - 1],
    ...outlinePoints,
    outlinePoints[0],
    outlinePoints[1],
  ];
  const outline = (u: number) =>
    portraitSpline(
      closed,
      (1 + u * outlinePoints.length) / (outlinePoints.length + 2),
    );
  const helix = Array.from({ length: 49 }, (_, i) => {
    const point = outline(i / 48);
    return p(0, point.y * 0.86, point.z * 0.86);
  });
  const stroke = (points: number[][]) =>
    Array.from({ length: 25 }, (_, i) =>
      portraitSpline(
        points.map(([y, z]) => p(0, y, z)),
        i / 24,
      ),
    );
  const antihelix = stroke([
    [-12, 7],
    [-6, 2],
    [3, -5],
    [10, -8],
    [16, -8],
  ]);
  const fork = stroke([
    [3, -5],
    [8, 0],
    [13, 7],
  ]);
  const distanceSquared = (
    y: number,
    z: number,
    path: ReturnType<typeof stroke>,
  ): number => {
    let result = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i],
        b = path[i + 1],
        dy = b.y - a.y,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(1, ((y - a.y) * dy + (z - a.z) * dz) / (dy * dy + dz * dz)),
      );
      result = Math.min(
        result,
        (y - a.y - t * dy) ** 2 + (z - a.z - t * dz) ** 2,
      );
    }
    return result;
  };
  const bump = (
    y: number,
    z: number,
    cy: number,
    cz: number,
    wy: number,
    wz: number,
  ): number => Math.exp(-(((y - cy) / wy) ** 2 + ((z - cz) / wz) ** 2));
  const relief = (y: number, z: number): number =>
    2.8 * Math.exp(-distanceSquared(y, z, helix) / 1.35 ** 2) +
    1.7 *
      Math.exp(
        -Math.min(
          distanceSquared(y, z, antihelix),
          distanceSquared(y, z, fork),
        ) /
          1.15 ** 2,
      ) -
    1.7 * bump(y, z, -1, 4, 6, 6) +
    2.2 * bump(y, z, -5, 11, 3, 2.2) +
    1.0 * bump(y, z, -17, 11, 5, 6);
  // Both anatomical sides read their actual refined temporal surface. The old
  // fixed X taper left the lower pinna buried after the cranial base widened.
  // The anterior root is embedded and the posterior edge projects outwards;
  // the pinna remains a separate shell, not a claim of welded skin topology.
  const frontZ = Math.max(...outlinePoints.map((point) => point.z));
  const depthSpan = frontZ - Math.min(...outlinePoints.map((point) => point.z));
  const parts: ReturnType<typeof portraitPart>[] = [];
  for (const side of [-1, 1]) {
    const attachmentX = (y: number, z: number): number => {
      const depth = surfaceDepth(
        (shape.centerY + y * shape.heightScale) / 1000,
        (shape.centerZ + z * shape.depthScale) / 1000,
      );
      if (depth === null)
        throw new Error(
          "The pinna attachment must lie on the supplied temporal surface.",
        );
      return (
        side * (side === 1 ? depth.maximum : depth.minimum) * 1000 +
        shape.projection * ((frontZ - z) / depthSpan) -
        shape.embedding
      );
    };
    const front = portraitPatch(
      (u, v) => {
        const edge = outline(u),
          r = 0.0001 + 0.9999 * v,
          y = edge.y * r,
          z = edge.z * r;
        return p(
          attachmentX(y, z) - 1.3 * (1 - r * r) + relief(y, z),
          shape.centerY + y * shape.heightScale,
          shape.centerZ + z * shape.depthScale,
        );
      },
      112,
      60,
    );
    const back = portraitPatch(
      (u, v) => {
        const edge = outline(1 - u),
          r = 0.0001 + 0.9999 * v,
          y = edge.y * r,
          z = edge.z * r;
        return p(
          attachmentX(y, z) -
            4.5 * (1 - r * r) +
            r * r * relief(edge.y, edge.z),
          shape.centerY + y * shape.heightScale,
          shape.centerZ + z * shape.depthScale,
        );
      },
      112,
      40,
    );
    for (const [name, mesh] of [
      ["pinna", front],
      ["ear-back", back],
    ] as const)
      parts.push(
        portraitPart(
          `${side === 1 ? "left" : "right"}-${name}`,
          transformAutoMovieMesh(mesh, { scale: p(side, 1, 1) }),
          "skin",
        ),
      );
  }
  return parts;
}
