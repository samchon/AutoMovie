import { IAutoMovieTransition } from "../cinematics/IAutoMovieTransition";
import { IAutoMovieTrim } from "../cinematics/IAutoMovieTrim";
import { IAutoMovieNamedId } from "../core/IAutoMovieNamedId";
import { IAutoMovieContextRequest } from "./IAutoMovieContextRequest";

/**
 * Stage 6 — **ASSEMBLE** (the cut). With every beat's shot built and passed,
 * edit them into one film: the order, each shot's trim, the transitions, and
 * the frame rate — an {@link IAutoMovieSequence} cut-list. This is the editorial
 * rung above the shots; the rhythm here (a sharp short strike, a held
 * aftermath) is where pacing lives.
 *
 * The CoT slots make the editor justify the cut: `pacing` (why this rhythm
 * serves the theme) and `continuity` (how the shots match across each cut — the
 * charge ends where the strike begins). Pull a sibling shot via `getContext`
 * (`getShot`) to check a match-cut rather than guess it.
 *
 * Declaration order is part of this contract, here and in every harness type:
 * schema-reflected tools present properties in declaration order and the model
 * fills them in that order, so a reasoning field placed BEFORE the artifact it
 * steers (`thinking` before `request`, `pacing`/`continuity` beside the entries
 * they justify) is chain-of-thought by construction, not decoration. Keep
 * reasoning fields ahead of the payloads they steer in future types.
 *
 * @author Samchon
 */
export interface IAutoMovieAssembleApplication {
  process(props: IAutoMovieAssembleApplication.IProps): void;
}
export namespace IAutoMovieAssembleApplication {
  export interface IProps {
    /**
     * Think before you cut. In what order do the shots tell the story, where do
     * you trim dead air, where does a hard cut land harder than a dissolve, and
     * what is the rhythm — which shots breathe, which snap? Note any continuity
     * mismatch you are resolving.
     */
    thinking: string;

    /** Cut the film, or pull a shot/the script to check continuity first. */
    request: IWrite | IAutoMovieContextRequest;
  }

  export interface IWrite {
    type: "write";

    /** Stable id + name for the assembled film. */
    sequence: IAutoMovieNamedId;

    /** Playback frame rate. */
    fps: number;

    /**
     * The shots in playback order, each with an optional trim + incoming
     * transition.
     */
    entries: IEntry[];

    /**
     * Why this rhythm serves the theme — which shots are held and which are cut
     * tight, and why. (Pacing has no cheap deterministic verifier, so the
     * rationale is the quality signal.)
     */
    pacing: string;

    /**
     * How the shots flow across the cuts — match-cuts, energy carried, no
     * jarring jump unless intended. The continuity you checked.
     */
    continuity: string;
  }

  /** One shot's placement in the cut: an optional trim and incoming transition. */
  export interface IEntry {
    /** Id of the shot played here. */
    shot: string;

    /** Trim into the shot (seconds), or null to play it whole. */
    trim: IAutoMovieTrim | null;

    /** Blend in from the previous entry, or null for a hard cut (the default). */
    transition: IAutoMovieTransition | null;
  }
}
