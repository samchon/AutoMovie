import type { IAutoMovieMaterial } from "@automovie/interface";

/**
 * Linear-RGB pigment endpoints for one iris, independent of aperture geometry.
 * Base is the limbal/dark-band albedo. Variation is a signed RGB increment at
 * the other end of the eight-band palette; zero gives uniform pigmentation.
 * Both endpoints must stay in [0,1]. This is an authored optical approximation,
 * not recovered reflectance or a photograph projected onto the eye.
 * @author Samchon
 */
export interface IPortraitIrisPigment {
  /** Exactly three linear RGB reflectances at progress zero, each in [0,1]. */
  base: readonly number[];
  /** Exactly three signed increments; base+variation must also stay in [0,1]. */
  variation: readonly number[];
}

/**
 * Own eight pigment finishes under a caller's material prefix. The same linear
 * palette supplies the legacy shared iris and an independently colored eye.
 * Every returned color is a fresh value; no mutable input array is retained.
 *
 * Band i uses base + (i/7)*variation. Because every intermediate value is a
 * convex combination of the admitted endpoints, checking those endpoints is
 * sufficient for the entire palette. The iris geometry owns band membership;
 * this material owner cannot alter the limbus, pupil, gaze or corneal surface.
 */
export function createPortraitIrisMaterials(
  prefix: string,
  pigment: IPortraitIrisPigment,
): IAutoMovieMaterial[] {
  if (
    prefix.trim().length === 0 ||
    prefix !== prefix.trim() ||
    pigment.base.length !== 3 ||
    pigment.variation.length !== 3 ||
    [...pigment.base, ...pigment.variation].some((v) => !Number.isFinite(v)) ||
    pigment.base.some(
      (v, i) =>
        v < 0 ||
        v > 1 ||
        v + pigment.variation[i] < 0 ||
        v + pigment.variation[i] > 1,
    )
  )
    throw new Error(
      "Iris pigmentation needs a material prefix and finite unit-range RGB endpoints.",
    );
  return Array.from({ length: 8 }, (_, i) => {
    const rgb = pigment.base.map(
      (value, axis) => value + pigment.variation[axis] * (i / 7),
    );
    const id = `${prefix}-${i}`;
    return {
      id,
      name: id,
      baseColor: { r: rgb[0], g: rgb[1], b: rgb[2], a: 1, hex: null },
      roughness: 0.65,
      metallic: 0,
      opacity: 1,
      emissive: null,
      baseColorTexture: null,
      doubleSided: true,
    };
  });
}
