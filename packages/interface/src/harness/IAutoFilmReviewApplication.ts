import { IAutoFilmReviewNote } from "./IAutoFilmSlate";

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
export interface IAutoFilmReviewApplication {
  process(props: IAutoFilmReviewApplication.IProps): void;
}
export namespace IAutoFilmReviewApplication {
  export interface IProps {
    /**
     * Think before you judge. Walk the rendered shot against the beat's intent:
     * does the key action read, do interactions actually connect (the strike
     * lands, the coupling holds), is the timing and framing right? Weigh the
     * automatic violations you were handed.
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
    notes: IAutoFilmReviewNote[];
  }
}
