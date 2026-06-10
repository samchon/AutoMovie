import { IAutoFilmSequence } from "../cinematics/IAutoFilmSequence";
import { IAutoFilmShot } from "../cinematics/IAutoFilmShot";
import { IAutoFilmScene } from "../scene/IAutoFilmScene";

/** One planned shot, described in words before it is blocked and performed. */
export interface IAutoFilmBeat {
  /** Stable id, referenced by the shot built from it. */
  id: string;

  /** Short title ("the charge", "the rear"). */
  name: string;

  /**
   * What happens in this beat, in prose — the brief the blocking stage works
   * to.
   */
  summary: string;

  /** Rough length (seconds) the script imagines; blocking may refine it. */
  durationHint: number;
}

/** A character the film needs, mapped to the scene node that will play it. */
export interface IAutoFilmCastMember {
  /** Id of the scene node (set in staging) that embodies this character. */
  node: string;

  /** Who they are — read by the model when blocking their action. */
  character: string;

  /**
   * Optional reference to an existing/importable model (a VRM, a built rig), or
   * null to use a generated stand-in.
   */
  modelRef: string | null;
}

/** The script: the macro plan the rest of the production works from. */
export interface IAutoFilmScript {
  /** One-sentence summary of the film. */
  logline: string;

  /** The intent / mood the shots should serve. */
  theme: string;

  /** Everyone who appears. */
  cast: IAutoFilmCastMember[];

  /** The ordered beats (each becomes a shot). */
  beats: IAutoFilmBeat[];
}

/**
 * A reviewer's note on a built shot — the feedback that drives a
 * re-block/re-perform.
 */
export interface IAutoFilmReviewNote {
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
 * The **slate** — the clapperboard that heads every take and carries the
 * production's running context between stages. Each harness stage reads the
 * slate's upstream slices and writes its own, exactly as AutoBe threads state
 * between analyze → database → interface → realize → test. State lives here;
 * the model just calls functions.
 *
 * @author Samchon
 */
export interface IAutoFilmSlate {
  /** The user's original request (+ any references), verbatim. */
  brief: string;

  /** The macro plan, once the SCRIPT stage has run (else null). */
  script: IAutoFilmScript | null;

  /** The staged world: placed models, cameras, lights (once STAGING has run). */
  scene: IAutoFilmScene | null;

  /** Shots built so far, keyed by the beat id they realise. */
  shots: IAutoFilmShot[];

  /** Open review notes still to be addressed (the correction backlog). */
  notes: IAutoFilmReviewNote[];

  /** The assembled film, once every beat has passed review (else null). */
  film: IAutoFilmSequence | null;
}
