import { IAutoMovieSequence } from "../cinematics/IAutoMovieSequence";
import { IAutoMovieShot } from "../cinematics/IAutoMovieShot";
import { IAutoMovieScene } from "../scene/IAutoMovieScene";
import { IAutoMovieBeatEndState } from "./IAutoMovieBeatEndState";
import { IAutoMovieScriptNode } from "./IAutoMovieScriptNode";

/** One planned shot, described in words before it is blocked and performed. */
export interface IAutoMovieBeat {
  /** Stable id, referenced by the shot built from it. */
  id: string;

  /** Short title ("the charge", "the rear"). */
  name: string;

  /** What happens in this beat, in prose: the brief the blocking stage works to. */
  summary: string;

  /** Rough length (seconds) the script imagines; blocking may refine it. */
  durationHint: number;
}

/** A character the film needs, mapped to the scene node that will play it. */
export interface IAutoMovieCastMember {
  /** Id of the scene node (set in staging) that embodies this character. */
  node: string;

  /** Who they are, read by the model when blocking their action. */
  character: string;

  /**
   * Optional reference to an existing/importable model (a VRM, a built rig), or
   * null to use a generated stand-in.
   */
  modelRef: string | null;
}

/** The script: the macro plan the rest of the production works from. */
export interface IAutoMovieScript {
  /** One-sentence summary of the film. */
  logline: string;

  /** The intent / mood the shots should serve. */
  theme: string;

  /** Everyone who appears. */
  cast: IAutoMovieCastMember[];

  /** The ordered beats (each becomes a shot). */
  beats: IAutoMovieBeat[];

  /**
   * The screenplay refinement tree ({@link IAutoMovieScriptNode}, D013): intent
   * → acts/scenes/groups → beat nodes carrying stage direction, dialogue, and
   * shot captions. Evolving-schema optional: absent means the flat `beats` list
   * is the whole authored structure (fully backward-compatible); when present,
   * beat-kind nodes join `beats` 1:1 and the tree validates on commit.
   */
  tree?: IAutoMovieScriptNode[] | null;
}

/**
 * A reviewer's note on a built shot: the feedback that drives a
 * re-block/re-perform.
 */
export interface IAutoMovieReviewNote {
  /** Which beat/shot the note is about. */
  beat: string;

  /** Which tier raised it. */
  tier: "structural" | "physical" | "visual";

  /**
   * What is wrong, located as concretely as possible ("left foot skates at
   * t=1.2s").
   */
  issue: string;

  /** A suggested fix the next pass should apply. */
  suggestion: string;
}

/**
 * The **slate**: the clapperboard that heads every take and carries the
 * production's running context between stages. Each harness stage reads the
 * slate's upstream slices and writes its own, exactly as AutoBe threads state
 * between analyze → database → interface → realize → test. State lives here;
 * the model just calls functions.
 *
 * @author Samchon
 */
export interface IAutoMovieSlate {
  /** The user's original request (+ any references), verbatim. */
  brief: string;

  /** The macro plan, once the SCRIPT stage has run (else null). */
  script: IAutoMovieScript | null;

  /** The staged world: placed models, cameras, lights (once STAGING has run). */
  scene: IAutoMovieScene | null;

  /** Shots built so far, keyed by the beat id they realise. */
  shots: IAutoMovieShot[];

  /** Resolved end-state snapshots for built beats, keyed by beat id. */
  beatEnds: IAutoMovieBeatEndState[];

  /** Open review notes still to be addressed (the correction backlog). */
  notes: IAutoMovieReviewNote[];

  /** The assembled film, once every beat has passed review (else null). */
  film: IAutoMovieSequence | null;
}
