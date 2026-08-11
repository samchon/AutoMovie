import { AutoMovieGuidePass } from "@automovie/interface";

import { frameName, framePattern } from "./plan";

/**
 * The runtime list matching the {@link AutoMovieGuidePass} closed union: what
 * validators check a requested pass name against (the `interface` package is
 * pure types, so the value list lives here).
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `AUTOMOVIE_GUIDE_PASSES` keeps pass identity, ordering, and output naming explicit in the render plan.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `AUTOMOVIE_GUIDE_PASSES` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const AUTOMOVIE_GUIDE_PASSES: readonly AutoMovieGuidePass[] = [
  "beauty",
  "depth",
  "mask",
  "normal",
  "outline",
  "pose",
];

/**
 * Whether a string names a known guide pass.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `isGuidePass` keeps pass identity, ordering, and output naming explicit in the render plan.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `isGuidePass` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const isGuidePass = (value: string): value is AutoMovieGuidePass =>
  (AUTOMOVIE_GUIDE_PASSES as readonly string[]).includes(value);

/**
 * The frame filename for one pass: the `beauty` pass keeps the plain
 * {@link frameName} (`frame_00042.png`) so a single-pass render is byte-
 * compatible with every existing plan, and any other pass tags the name before
 * the extension (`frame_00042.depth.png`). Deterministic, so the same request
 * yields the same paths on every machine, and chunking (#609) composes
 * unchanged, since a pass only refines the filename inside a chunk's frame
 * dir.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `guidePassFrameName` keeps pass identity, ordering, and output naming explicit in the render plan.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `guidePassFrameName` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const guidePassFrameName = (
  index: number,
  pass: AutoMovieGuidePass,
  ext = "png",
  pad = 5,
): string => frameName(index, passExtension(pass, ext), pad);

/**
 * The ffmpeg `-i` pattern matching {@link guidePassFrameName} for one pass.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `guidePassFramePattern` keeps pass identity, ordering, and output naming explicit in the render plan.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `guidePassFramePattern` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const guidePassFramePattern = (
  pass: AutoMovieGuidePass,
  ext = "png",
  pad = 5,
): string => framePattern(passExtension(pass, ext), pad);

/**
 * One pass's deterministic output locations within a frame directory.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `IAutoMovieGuidePassOutput` keeps pass identity, ordering, and output naming explicit in the render plan.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMovieGuidePassOutput` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieGuidePassOutput {
  /**
   * The guide pass this output belongs to.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `IAutoMovieGuidePassOutput.pass` keeps pass identity, ordering, and output naming explicit in the render plan.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMovieGuidePassOutput.pass` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  pass: AutoMovieGuidePass;

  /**
   * First frame path of the pass.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `IAutoMovieGuidePassOutput.firstFrame` keeps pass identity, ordering, and output naming explicit in the render plan.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMovieGuidePassOutput.firstFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  firstFrame: string;

  /**
   * Last frame path of the pass.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `IAutoMovieGuidePassOutput.lastFrame` keeps pass identity, ordering, and output naming explicit in the render plan.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMovieGuidePassOutput.lastFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  lastFrame: string;

  /**
   * Ffmpeg input pattern for the pass's frame sequence.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `IAutoMovieGuidePassOutput.inputPattern` keeps pass identity, ordering, and output naming explicit in the render plan.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMovieGuidePassOutput.inputPattern` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  inputPattern: string;
}

/**
 * Validate and fold a requested pass list: an unknown pass name is a caller bug
 * and throws; duplicates fold to their first occurrence (which wins the order).
 * The one place both the whole-render planner ({@link planGuidePassOutputs}) and
 * the chunked planner normalize a pass request, so they cannot drift.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `normalizeGuidePasses` keeps pass identity, ordering, and output naming explicit in the render plan.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `normalizeGuidePasses` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const normalizeGuidePasses = (
  passes: readonly string[],
): AutoMovieGuidePass[] => {
  const seen = new Set<AutoMovieGuidePass>();
  const normalized: AutoMovieGuidePass[] = [];
  for (const pass of passes) {
    if (!isGuidePass(pass)) throw new Error(`unknown guide pass "${pass}"`);
    if (seen.has(pass)) continue;
    seen.add(pass);
    normalized.push(pass);
  }
  return normalized;
};

/**
 * Plan the per-pass output locations for a frame directory: each requested pass
 * becomes one additional capture per frame time, at a deterministic pass-tagged
 * path. Duplicate passes are folded (first occurrence wins the order); an
 * unknown pass name or a non-positive frame count is a caller bug and throws.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies `planGuidePassOutputs` keeps pass identity, ordering, and output naming explicit in the render plan.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `planGuidePassOutputs` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const planGuidePassOutputs = (props: {
  /** Directory where the render's frame files are written. */
  frameDir: string;

  /** Number of frames each pass captures. */
  frameCount: number;

  /** Requested passes, in capture order. */
  passes: readonly string[];
}): IAutoMovieGuidePassOutput[] => {
  if (!Number.isInteger(props.frameCount) || props.frameCount <= 0)
    throw new Error(
      `guide pass frameCount must be a positive integer, but was ${props.frameCount}`,
    );
  return normalizeGuidePasses(props.passes).map((pass) => ({
    pass,
    firstFrame: `${props.frameDir}/${guidePassFrameName(0, pass)}`,
    lastFrame: `${props.frameDir}/${guidePassFrameName(props.frameCount - 1, pass)}`,
    inputPattern: `${props.frameDir}/${guidePassFramePattern(pass)}`,
  }));
};

/** The filename extension carrying the pass tag (`beauty` stays untagged). */
const passExtension = (pass: AutoMovieGuidePass, ext: string): string =>
  pass === "beauty" ? ext : `${pass}.${ext}`;
