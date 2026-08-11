import {
  IAutoMovieConstraintViolation,
  IAutoMovieReviewNote,
  IAutoMovieScript,
  IAutoMovieShotReviewWrite,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";

/**
 * A normalized review verdict: pass the shot through, or hand the correction
 * backlog to the next blocking/performance round.
 *
 * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation IAutoMovieShotReview makes review judgment actionable: A normalized review verdict: pass the shot through, or hand the correction backlog to the next blocking/performance round.
 * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview realizes review observation interpretation: A normalized review verdict: pass the shot through, or hand the correction backlog to the next blocking/performance round.
 * @author Samchon
 */
export type IAutoMovieShotReview =
  | IAutoMovieShotReview.ISuccess
  | IAutoMovieShotReview.IFailure;
export namespace IAutoMovieShotReview {
  /**
   * The review is coherent; act on its verdict.
   *
   * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation IAutoMovieShotReview.ISuccess makes review judgment actionable: The review is coherent; act on its verdict.
   * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.ISuccess realizes review observation interpretation: The review is coherent; act on its verdict.
   */
  export interface ISuccess {
    /**
     * Discriminator.
     *
     * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation The true discriminator admits a coherent pass or revise judgment to the next production round.
     * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.ISuccess.success admits a coherent pass or revise verdict to the next round.
     */
    success: true;

    /**
     * Which beat was judged.
     *
     * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation IAutoMovieShotReview.ISuccess.beat makes review judgment actionable: Which beat was judged.
     * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.ISuccess.beat realizes review observation interpretation: Which beat was judged.
     */
    beat: string;

    /**
     * The verdict, verbatim.
     *
     * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation IAutoMovieShotReview.ISuccess.verdict makes review judgment actionable: The verdict, verbatim.
     * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.ISuccess.verdict realizes review observation interpretation: The verdict, verbatim.
     */
    verdict: "pass" | "revise";

    /**
     * The correction backlog for a revise (empty on a pass), what the next
     * blocking/performance round must read via `getNotes` and fix.
     *
     * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation IAutoMovieShotReview.ISuccess.notes makes review judgment actionable: The correction backlog for a revise (empty on a pass), what the next blocking/performance round must read via `getNotes` and fix.
     * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.ISuccess.notes realizes review observation interpretation: The correction backlog for a revise (empty on a pass), what the next blocking/performance round must read via `getNotes` and fix.
     */
    notes: IAutoMovieReviewNote[];
  }

  /**
   * The review contradicted itself or the script.
   *
   * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation IAutoMovieShotReview.IFailure makes review judgment actionable: The review contradicted itself or the script.
   * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.IFailure realizes review observation interpretation: The review contradicted itself or the script.
   */
  export interface IFailure {
    /**
     * Discriminator.
     *
     * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation The false discriminator prevents a self-contradictory review from becoming an actionable verdict.
     * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.IFailure.success withholds a contradictory review from production action.
     */
    success: false;

    /**
     * Every contradiction found, for the correction round.
     *
     * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation Returns beat mismatches, invalid verdict-note combinations, and malformed correction notes to the reviewer.
     * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation IAutoMovieShotReview.IFailure.violations realizes review observation interpretation: Every contradiction found, for the correction round.
     */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The REVIEW consumer, normalize a reviewer's write into the verdict the
 * re-perform loop runs on. The gates keep the loop closed: a `revise` with no
 * notes gives the next round nothing to fix (the loop would spin), a `pass`
 * that still carries notes contradicts itself (notes are the open backlog, and
 * passing declares it empty), and every note must be filed on the beat this
 * review judges, a misfiled note would be pulled by the wrong beat's revise
 * pass and silently starve the right one.
 *
 * @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation Normalizes a pass or revise verdict and rejects a correction backlog that contradicts or targets a different beat.
 * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-observation-interpretation reviewShot realizes review observation interpretation: The REVIEW consumer, normalize a reviewer's write into the verdict the re-perform loop runs on. The gates keep the loop closed: a `revise` with no notes gives the next round nothing to fix (the loop would spin), a `pass` that still carries notes contradicts itself (notes are the open backlog, and passing declares it empty), and every note must be filed on the beat this review judges, a misfiled note would be pulled by the wrong beat's revise pass and silently starve the right one.
 */
export const reviewShot = (
  script: IAutoMovieScript,
  review: IAutoMovieShotReviewWrite,
): IAutoMovieShotReview => {
  const out = new ViolationCollector();
  const beatById = new Map<string, number>();
  script.beats.forEach((beat, index) => {
    const existing = beatById.get(beat.id);
    if (existing !== undefined) {
      out.push(
        "type",
        `$script.beats[${index}].id`,
        `script beat id "${beat.id}" is duplicated; first declared at $script.beats[${existing}].id`,
        beat.id,
      );
      return;
    }
    beatById.set(beat.id, index);
  });

  const validateNonEmptyId = (
    id: string,
    path: string,
    label: string,
  ): void => {
    if (id.trim().length === 0)
      out.push("type", path, `${label} must be a non-empty id`, id);
  };

  validateNonEmptyId(review.beat, "$input.beat", "review beat id");

  if (!beatById.has(review.beat))
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
      "a revise verdict must carry at least one note, the next round needs something to fix",
      review.notes,
    );
  if (review.verdict === "pass" && review.notes.length > 0)
    out.push(
      "type",
      "$input.notes",
      "a pass verdict must carry no open notes, passing declares the backlog empty",
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
