import type { IAutoMovieProductionRenderTier } from "./IAutoMovieProductionRenderTier";

/**
 * Resolve the declared tier, defaulting to exact final, or refuse it.
 *
 * A tier is either exact final (scale 1, step 1) or a bounded proxy with at
 * least one reduction, so "final" cannot be spelled as a proxy that happens to
 * reduce nothing and a proxy cannot claim final's identity.
 */
export const normalizeRenderTier = (
  tier: IAutoMovieProductionRenderTier | undefined,
): IAutoMovieProductionRenderTier => {
  const value = tier ?? {
    kind: "final",
    resolutionScale: 1,
    frameStep: 1,
  };
  if (
    (value.kind !== "proxy" && value.kind !== "final") ||
    Number.isFinite(value.resolutionScale) === false ||
    value.resolutionScale <= 0 ||
    value.resolutionScale > 1 ||
    Number.isSafeInteger(value.frameStep) === false ||
    value.frameStep <= 0 ||
    value.frameStep > 16 ||
    (value.kind === "final" &&
      (value.resolutionScale !== 1 || value.frameStep !== 1)) ||
    (value.kind === "proxy" &&
      value.resolutionScale === 1 &&
      value.frameStep === 1)
  )
    throw new Error(
      "Render tier must be exact final (scale 1, step 1) or a bounded cheaper proxy (scale in (0, 1], integer step 1..16, with at least one reduction).",
    );
  return structuredClone(value);
};
