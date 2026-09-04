import type { AutoMovieProductionSubjectInspection } from "@automovie/production";

/**
 * The shot a page stands for, without the state it was opened at.
 *
 * Two pages under this one identity are the same thing at two compiles, and
 * only the newer one can still be asked for a frame.
 *
 * The subject is deliberately not in it. Staging the compiled shot is what a
 * page costs, and the page draws any subject standing in that shot, so keying
 * by subject rebuilt one 14 MB scene per subject: 4.3 of the 6.2 seconds one
 * observation took, and 70% of a whole production's sweep (`#1956`).
 */
export const pageSubject = (
  input: Parameters<AutoMovieProductionSubjectInspection>[0],
): string =>
  JSON.stringify({
    productionId: input.productionId,
    shot: input.target.shot,
    width: input.width,
    height: input.height,
  });

/**
 * Everything that decides whether one open page can answer the next viewpoint.
 *
 * The compile fingerprint and the artifact revision are both in it. A sweep
 * whose source moved underneath it is a set of pictures of two different models
 * with nothing in the individual images saying so, and the runtime refuses that
 * sweep after the fact; keeping both in the key means the page never serves the
 * mixed frame in the first place.
 *
 * These two live apart from `inspectSubject.ts` so they can be read side by
 * side without a browser. That file imports Vite and Playwright at module
 * level, so no in-process reader can reach it, and what these keys leave out is
 * the whole decision: nothing else in this project can say whether the subject
 * is absent from one and the compile identity present in the other. Both
 * mistakes are silent; the first costs a rebuilt scene per subject, and the
 * second serves a stale page for a shot that has since recompiled.
 */
export const pageKey = (
  input: Parameters<AutoMovieProductionSubjectInspection>[0],
): string =>
  JSON.stringify({
    productionId: input.productionId,
    compileFingerprint: input.compileFingerprint,
    revision: input.revision,
    shot: input.target.shot,
    width: input.width,
    height: input.height,
  });
