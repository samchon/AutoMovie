import type { IAutoMovieMaterializedLibrary } from "@automovie/interface";

import { encodeAutoMoviePathSegment } from "./contentIdentity";

/**
 * Resolve one generated library file to the exact owner that published it.
 *
 * The aggregate index is the sole library-wide file. Environment, model, and
 * context artifacts are all owner-produced families and therefore resolve
 * through the same materialized owner index. An unowned or multiply owned path
 * is an invariant failure rather than an aggregate fallback.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Preserves the exact reviewed library owner on every generated artifact consumed by offline review.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Projects branch, design owner, source, and digest ownership from the materialized index onto each generated family.
 * @author Samchon
 */
export const autoMovieLibraryArtifactSourceTargets = (
  file: string,
  index: IAutoMovieMaterializedLibrary,
): string[] => {
  if (file === "library/index.json") return ["library"];
  const candidates: string[] = [];
  for (const owner of index.owners) {
    const target = `library:${owner.branch}:${owner.owner}`;
    for (const environment of owner.environments)
      if (
        file ===
        `library/environments/${encodeAutoMoviePathSegment(environment)}.json`
      )
        candidates.push(target);
    for (const model of owner.models)
      if (file === `models/${encodeAutoMoviePathSegment(model)}.json`)
        candidates.push(target);
    for (const context of owner.contexts ?? [])
      if (
        file === `library/contexts/${encodeAutoMoviePathSegment(context)}.json`
      )
        candidates.push(target);
  }
  if (candidates.length !== 1)
    throw new Error(
      candidates.length === 0
        ? `Generated library artifact "${file}" has no exact owner in the materialized library index.`
        : `Generated library artifact "${file}" has ${candidates.length} owners in the materialized library index: ${candidates.join(", ")}.`,
    );
  return candidates;
};
