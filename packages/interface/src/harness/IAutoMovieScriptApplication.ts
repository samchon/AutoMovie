import { IAutoMovieBeat, IAutoMovieCastMember } from "./IAutoMovieSlate";

/**
 * Stage 1: **SCRIPT** (macro). Turn the user's brief into a plan: a logline, a
 * theme, the cast, and an ordered beat list (the shots, in words). No motion
 * yet; this is the treatment the rest of the production works to.
 *
 * Exposed to the model as
 * `typia.llm.application<IAutoMovieScriptApplication>()`. The single `process`
 * method's `IProps` schema enforces the reasoning (the JSDoc on each field is
 * the prompt).
 *
 * @author Samchon
 */
export interface IAutoMovieScriptApplication {
  process(props: IAutoMovieScriptApplication.IProps): void;
}
export namespace IAutoMovieScriptApplication {
  export interface IProps {
    /**
     * Think before you act. What is the user really asking for: the action, the
     * mood, the cast, the rough shape? Note ambiguities you are resolving by
     * default and any constraint the brief implies.
     */
    thinking: string;

    /** The plan, or a signal that the brief cannot be filmed as asked. */
    request: IWrite | IDecline;
  }

  export interface IWrite {
    type: "write";

    /** One sentence: the whole film. */
    logline: string;

    /**
     * The intent/mood every shot should serve (the through-line for later
     * self-critique).
     */
    theme: string;

    /**
     * Everyone who appears. Give each a `node` id you will place in staging and
     * a `character` description specific enough to block their action from.
     */
    cast: IAutoMovieCastMember[];

    /**
     * The ordered beats: each becomes one shot. Keep each beat a single clear
     * action ("the knight charges", "he is unhorsed"); do not pack a whole
     * scene into one beat. Their `durationHint`s should sum near the target
     * length.
     */
    beats: IAutoMovieBeat[];
  }

  /**
   * The brief asks for something out of scope (no rig, impossible staging);
   * explain why.
   */
  export interface IDecline {
    type: "decline";

    reason: string;
  }
}
