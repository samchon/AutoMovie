import { IAutoMovieReviewNote } from "./IAutoMovieSlate";

/**
 * Stage 5 — **REVIEW** (the loop). Judge a built shot against its beat and
 * return either a pass or field-located notes that send it back to blocking /
 * performance. This is the human-facing twin of the validation ladder: the
 * structural and physical tiers run automatically (typia, ROM/physics) and
 * attach their findings; this stage adds the **visual** tier — does the
 * rendered shot actually read as the beat intended?
 *
 * The model is shown the rendered frames (M2) plus any automatic violations and
 * must decide. A revise verdict with no notes is invalid — if it fails, say why
 * and how to fix it (the feedback the next pass consumes).
 *
 * @author Samchon
 */
export interface IAutoMovieReviewApplication {
  process(props: IAutoMovieReviewApplication.IProps): void;
}
export namespace IAutoMovieReviewApplication {
  export interface IProps {
    /**
     * Think before you judge. Walk the rendered shot against the beat's intent,
     * in order:
     *
     * - Does the **key action read** at a glance (a stranger would see "he is
     *   shot off his horse")?
     * - Do **interactions connect** — the strike lands on the body, the rider
     *   stays coupled through the rear, the hit precedes the fall?
     * - Is the **motion plausible** — no skating, no limbs through bodies, ROM
     *   not visibly violated (and weigh the automatic structural/physical
     *   violations you were handed)?
     * - Is the **camera** framing the moment that matters, and the **timing** /
     *   energy right for the theme? Be strict: a shot that only "roughly" reads
     *   should be revised.
     */
    thinking: string;

    request: IWrite;
  }

  export interface IWrite {
    type: "write";

    /** Which beat/shot was reviewed. */
    beat: string;

    /**
     * What you observed in the render, good and bad — the evidence for the
     * verdict.
     */
    observations: string;

    /** Does the shot pass, or must it be revised? */
    verdict: "pass" | "revise";

    /**
     * The fixes, when revising — each located as concretely as possible and
     * tier-tagged. Empty only when `verdict` is `pass`.
     */
    notes: IAutoMovieReviewNote[];
  }
}
