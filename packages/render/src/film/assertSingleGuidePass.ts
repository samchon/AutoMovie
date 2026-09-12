import type { AutoMovieGuidePass } from "@automovie/interface";

/**
 * Admit exactly one structural pass for one guide-pass deliverable, or refuse.
 *
 * This is not render's public `normalizeGuidePasses`, which folds any requested
 * pass list, admits beauty, and exists so the whole-render and chunked sequence
 * planners cannot drift. A production deliverable is narrower: beauty is not a
 * guide pass here, and a guide-pass deliverable declares exactly one, so one
 * deliverable's failure can never hide inside another's output. Two different
 * admission rules under one name would be worse than two names.
 */
export const assertSingleGuidePass = (
  passes: readonly Exclude<AutoMovieGuidePass, "beauty">[],
): Exclude<AutoMovieGuidePass, "beauty">[] => {
  const valid = new Set<AutoMovieGuidePass>([
    "depth",
    "mask",
    "normal",
    "outline",
    "pose",
  ]);
  const output: Exclude<AutoMovieGuidePass, "beauty">[] = [];
  for (const pass of passes) {
    if (valid.has(pass) === false)
      throw new Error(`Guide-pass render cannot use "${pass}".`);
    if (output.includes(pass) === false) output.push(pass);
  }
  if (output.length !== 1)
    throw new Error(
      `A guide-pass deliverable requires exactly one declared pass, but received ${output.length}. Declare separate deliverables when the production contract gains per-pass ownership.`,
    );
  return output;
};
