import type { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

import { portraitMix, portraitPatch, portraitPoint } from "../geometry";

/**
 * Visible conjunctival tissue and lower lid margin, in construction millimetres.
 * These are authored surface dimensions, not measurements of internal anatomy.
 * Zero length/width disables the corresponding surface independently.
 */
export interface IPortraitOcularTissueShape {
  /** Medial tissue's extent from the inner canthus towards the iris, in mm. */
  cornerLength: number;
  /** Caruncular mound's maximum additional forward relief, in mm. */
  caruncleProjection: number;
  /** Plica ridge's additional relief lateral to the caruncle, in mm. */
  plicaProjection: number;
  /** Lower margin's maximum extent inside the visible opening, in mm. */
  lowerMarginWidth: number;
  /** Lower margin's additional rounded forward relief, in mm. */
  lowerMarginLift: number;
}

/**
 * The eye supplies its final refined lid curves and its actual globe surface.
 * X increases on both sides; anatomical left has its medial corner at minimum X.
 * Upper and lower curves share endpoints and return millimetre head coordinates.
 */
export interface IPortraitOcularTissueBoundary {
  side: "left" | "right";
  minimumX: number;
  maximumX: number;
  upper: (x: number) => IAutoMovieVector3;
  lower: (x: number) => IAutoMovieVector3;
  globe: (x: number, y: number) => number;
}

/**
 * Own a tissue profile and build both surfaces in one live ocular frame.
 * The medial mound and lateral plica share a patch between the actual lids;
 * neither is a floating sphere with an independently guessed attachment.
 */
export const createPortraitOcularTissues = (
  input: IPortraitOcularTissueShape,
): ((boundary: IPortraitOcularTissueBoundary) => {
  corner: IAutoMovieMesh | null;
  lowerMargin: IAutoMovieMesh | null;
}) => {
  const shape = { ...input };
  if (
    Object.values(shape).some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error("Ocular tissue dimensions must be finite and nonnegative.");
  return (boundary) => {
    const span = boundary.maximumX - boundary.minimumX;
    if (
      ![boundary.minimumX, boundary.maximumX, span].every(Number.isFinite) ||
      span <= 0 ||
      shape.cornerLength > span / 2
    )
      throw new Error(
        "Ocular tissue needs an ordered aperture and a medial half-width fit.",
      );
    const section = (x: number) => {
      const lower = boundary.lower(x),
        upper = boundary.upper(x);
      if (
        ![lower.x, lower.y, lower.z, upper.x, upper.y, upper.z].every(
          Number.isFinite,
        ) ||
        upper.y < lower.y
      )
        throw new Error("Ocular tissue requires finite, ordered lid samples.");
      return { lower, upper };
    };
    const globe = (x: number, y: number): number => {
      const z = boundary.globe(x, y);
      if (!Number.isFinite(z))
        throw new Error("Ocular tissue requires a finite globe surface.");
      return z;
    };
    const corner =
      shape.cornerLength === 0
        ? null
        : portraitPatch(
            (u, v) => {
              // Both meshes retain increasing X, hence outward (+Z) winding. The
              // anatomical side changes distance from the medial corner, not winding.
              const x =
                boundary.side === "left"
                  ? boundary.minimumX + shape.cornerLength * u
                  : boundary.maximumX - shape.cornerLength * (1 - u);
              const distance = boundary.side === "left" ? u : 1 - u;
              const { lower, upper } = section(x);
              const y = portraitMix(lower.y, upper.y, v);
              const across = Math.sin(Math.PI * v) ** 2;
              const along = Math.sin(Math.PI * distance) ** 2;
              // The caruncle occupies the medial body; the narrower plica crest sits
              // laterally at 82% of the same region. Their envelopes vanish at the lids
              // and at the scleral join. These fractions define this procedural shape,
              // not population statistics. A zero projection retains a flat tissue mask.
              const caruncle = Math.exp(-(((distance - 0.42) / 0.26) ** 2));
              const plica = Math.exp(-(((distance - 0.82) / 0.08) ** 2));
              const rim = portraitMix(lower.z, upper.z, v);
              const z =
                portraitMix(rim, globe(x, y), across) +
                across *
                  along *
                  (0.02 +
                    shape.caruncleProjection * caruncle +
                    shape.plicaProjection * plica);
              return portraitPoint(x, y, z);
            },
            32,
            12,
          );
    const lowerMargin =
      shape.lowerMarginWidth === 0
        ? null
        : portraitPatch(
            (u, v) => {
              const x = portraitMix(boundary.minimumX, boundary.maximumX, u);
              const { lower, upper } = section(x);
              const fade = Math.sin(Math.PI * u);
              // Never span more than half the local aperture. This also closes the
              // strip at both shared canthi and keeps narrow replacement eyes valid.
              const width = Math.min(
                shape.lowerMarginWidth * fade,
                (upper.y - lower.y) / 2,
              );
              const y = lower.y + width * v;
              const z =
                portraitMix(lower.z, globe(x, y), v) +
                shape.lowerMarginLift * fade * Math.sin(Math.PI * v);
              return portraitPoint(x, y, z);
            },
            80,
            4,
          );
    return { corner, lowerMargin };
  };
};
