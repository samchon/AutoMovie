import {
  IAutoMovieConstraintViolation,
  IAutoMovieReviewApplication,
  IAutoMovieReviewNote,
  IAutoMovieScriptApplication,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";

/**
 * A normalized review verdict: pass the shot through, or hand the correction
 * backlog to the next blocking/performance round.
 *
 * @author Samchon
 */
export type IAutoMovieShotReview =
  | IAutoMovieShotReview.ISuccess
  | IAutoMovieShotReview.IFailure;
export namespace IAutoMovieShotReview {
  /** The review is coherent; act on its verdict. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** Which beat was judged. */
    beat: string;

    /** The verdict, verbatim. */
    verdict: "pass" | "revise";

    /**
     * The correction backlog for a revise (empty on a pass) — what the next
     * blocking/performance round must read via `getNotes` and fix.
     */
    notes: IAutoMovieReviewNote[];
  }

  /** The review contradicted itself or the script. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every contradiction found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The REVIEW consumer — normalize a reviewer's write into the verdict the
 * re-perform loop runs on. The gates keep the loop closed: a `revise` with no
 * notes gives the next round nothing to fix (the loop would spin), a `pass`
 * that still carries notes contradicts itself (notes are the open backlog, and
 * passing declares it empty), and every note must be filed on the beat this
 * review judges — a misfiled note would be pulled by the wrong beat's revise
 * pass and silently starve the right one.
 */
export const reviewShot = (
  script: IAutoMovieScriptApplication.IWrite,
  review: IAutoMovieReviewApplication.IWrite,
): IAutoMovieShotReview => {
  const out = new ViolationCollector();

  const validateNonEmptyId = (
    id: string,
    path: string,
    label: string,
  ): void => {
    if (id.trim().length === 0)
      out.push("type", path, `${label} must be a non-empty id`, id);
  };

  validateNonEmptyId(review.beat, "$input.beat", "review beat id");

  if (!script.beats.some((b) => b.id === review.beat))
    out.push(
      "type",
      "$input.beat",
      `beat "${review.beat}" must be one of the script's beats`,
      review.beat,
    );

  if (review.verdict === "revise" && review.notes.length === 0)
    out.push(
      "type",
      "$input.notes",
      "a revise verdict must carry at least one note — the next round needs something to fix",
      review.notes,
    );
  if (review.verdict === "pass" && review.notes.length > 0)
    out.push(
      "type",
      "$input.notes",
      "a pass verdict must carry no open notes — passing declares the backlog empty",
      review.notes,
    );

  review.notes.forEach((note, i) => {
    validateNonEmptyId(
      note.beat,
      `$input.notes[${i}].beat`,
      "review note beat id",
    );
    if (note.beat !== review.beat)
      out.push(
        "type",
        `$input.notes[${i}].beat`,
        `note filed on "${note.beat}" but this review judges "${review.beat}"`,
        note.beat,
      );
  });

  return out.items.length > 0
    ? { success: false, violations: out.items }
    : {
        success: true,
        beat: review.beat,
        verdict: review.verdict,
        notes: review.notes,
      };
};
