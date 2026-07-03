import {
  IAutoFilmConstraintViolation,
  IAutoFilmReviewApplication,
  IAutoFilmReviewNote,
  IAutoFilmScriptApplication,
} from "@autofilm/interface";

import { ViolationCollector } from "../validation/violation";

/**
 * A normalized review verdict: pass the shot through, or hand the correction
 * backlog to the next blocking/performance round.
 *
 * @author Samchon
 */
export type IAutoFilmShotReview =
  | IAutoFilmShotReview.ISuccess
  | IAutoFilmShotReview.IFailure;
export namespace IAutoFilmShotReview {
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
    notes: IAutoFilmReviewNote[];
  }

  /** The review contradicted itself or the script. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every contradiction found, for the correction round. */
    violations: IAutoFilmConstraintViolation[];
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
  script: IAutoFilmScriptApplication.IWrite,
  review: IAutoFilmReviewApplication.IWrite,
): IAutoFilmShotReview => {
  const out = new ViolationCollector();

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
