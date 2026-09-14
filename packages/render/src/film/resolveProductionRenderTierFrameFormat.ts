import {
  canonicalProductionFrameRate,
  resolveProductionFrameRate,
} from "@automovie/engine";
import type { IAutoMovieProductionDesign } from "@automovie/interface";

import type { IAutoMovieProductionRenderTier } from "./IAutoMovieProductionRenderTier";
import { normalizeRenderTier } from "./normalizeRenderTier";

/**
 * Derive the exact even raster and frame clock for one render tier.
 */
export const resolveProductionRenderTierFrameFormat = (
  source: IAutoMovieProductionDesign["frameFormat"],
  tier: IAutoMovieProductionRenderTier,
): IAutoMovieProductionDesign["frameFormat"] => {
  const normalized = normalizeRenderTier(tier);
  if (normalized.kind === "final") return structuredClone(source);
  const even = (value: number): number =>
    Math.max(2, Math.floor((value * normalized.resolutionScale) / 2) * 2);
  const sourceRate = resolveProductionFrameRate(source);
  const frameRate = canonicalProductionFrameRate({
    numerator: sourceRate.numerator,
    denominator: sourceRate.denominator * normalized.frameStep,
  });
  return {
    width: even(source.width),
    height: even(source.height),
    fps: frameRate.numerator / frameRate.denominator,
    frameRate,
    colorSpace: source.colorSpace,
    ...(source.crop === undefined
      ? {}
      : { crop: structuredClone(source.crop) }),
  };
};
