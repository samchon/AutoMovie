import type { AutoMovieGuidePass } from "@automovie/interface";

/**
 * Order and de-duplicate the declared structural passes, or refuse them.
 *
 * Beauty is not a guide pass, and a guide-pass deliverable carries exactly one
 * declared pass, so one deliverable's failure can never hide inside another's
 * output.
 */
export const normalizeGuidePasses = (
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
