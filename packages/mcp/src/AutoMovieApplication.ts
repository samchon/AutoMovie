import {
  IAutoMovieBlockedBeat,
  IAutoMovieCut,
  IAutoMovieForgedCast,
  IAutoMovieStagedSet,
  blockBeat,
  cutSequence,
  forgeCast,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieAssembleApplication,
  IAutoMovieBlockingApplication,
  IAutoMovieForgeApplication,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieStagingApplication,
} from "@automovie/interface";

/**
 * AutoMovie's deterministic 3D film engine, exposed as MCP tools: `stage`
 * places a cast and rigs a scene, `block` plans a beat's coarse movement, `cut`
 * assembles shots into a film, and `forge` builds a cast's parametric models.
 * Each tool takes the model's structured creative intent and returns the
 * engine's computed result — including the placement, ROM, and continuity
 * violations that make the engine, not the model, the arbiter of physical truth
 * ("engine enforces, model creates").
 *
 * `@typia/mcp` derives every tool's JSON schema, and validates requests and
 * responses, straight from this class's method signatures and JSDoc via
 * `typia.llm.controller` — the old per-stage
 * `typia.llm.application<IAutoMovie*Application>()` interfaces are retired as
 * the integration surface. Drive the pipeline stage by stage, feeding each
 * tool's output into the next.
 *
 * Not yet wired: performing a shot needs a per-actor motion synthesiser and rig
 * resolver, not plain JSON — surfacing it, and how many servers/tools the whole
 * pipeline should become, is an ongoing design experiment, not a fixed shape.
 *
 * @author Samchon
 */
export class AutoMovieApplication {
  /**
   * Stage a scene — the first deterministic step. Place the script's cast on
   * the set per the staging plan, resolve every actor/camera/light to a
   * concrete world transform (measured against the staged rigs), and validate
   * persistent mounts. On failure nothing is composed and the violations name
   * the offending placement to repair.
   *
   * @param props The script (cast + beats) and the staging plan (placements).
   * @returns The staged scene on success, or the staging violations to fix.
   */
  public stage(props: {
    /** The script: the cast to place and the beats they play. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The staging plan: where each actor, camera, and light goes. */
    staging: IAutoMovieStagingApplication.IWrite;
  }): IAutoMovieStageOutput {
    return { staged: stageScene(props.script, props.staging) };
  }

  /**
   * Block a beat — plan the coarse movement (who goes where, in what order,
   * with what timing anchors) over an already-{@link stage staged} scene, before
   * the fine performance. Returns the blocked beat, or the violations if a
   * block contradicts the staging or the beat.
   *
   * @param props The script, the successfully staged scene, and the blocking.
   * @returns The blocked beat on success, or the violations to fix.
   */
  public block(props: {
    /** The script: the cast and their beats. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The staged scene this beat blocks over (a successful `stage` result). */
    staged: IAutoMovieStagedSet.ISuccess;
    /** The blocking plan: the beat's movement intents and timing anchors. */
    blocking: IAutoMovieBlockingApplication.IWrite;
  }): IAutoMovieBlockOutput {
    return { blocked: blockBeat(props.script, props.staged, props.blocking) };
  }

  /**
   * Cut shots into a film — assemble a sequence of performed shots on the
   * output clock, applying trims and transitions (a cross-dissolve overlaps the
   * tail). Returns the cut with its runtime, or the violations if a trim or
   * transition does not fit its shot.
   *
   * @param props The assemble plan (the ordered entries) and the shots to cut.
   * @returns The cut film on success, or the violations to fix.
   */
  public cut(props: {
    /** The assemble plan: the ordered shot entries, trims, and transitions. */
    assemble: IAutoMovieAssembleApplication.IWrite;
    /** The performed shots referenced by the assemble entries. */
    shots: IAutoMovieShot[];
  }): IAutoMovieCutOutput {
    return { cut: cutSequence(props.assemble, props.shots) };
  }

  /**
   * Forge a cast's models — build the parametric head/body meshes the script's
   * cast needs from the forge specification, ready to rig and render. Returns
   * the forged cast, or the violations if a specification is out of range.
   *
   * @param props The script (whose cast is forged) and the forge specification.
   * @returns The forged cast on success, or the violations to fix.
   */
  public forge(props: {
    /** The script: the cast whose models to forge. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The forge specification: the model parameters per cast member. */
    forge: IAutoMovieForgeApplication.IWrite;
  }): IAutoMovieForgeOutput {
    return { forged: forgeCast(props.script, props.forge) };
  }
}

/** The `stage` tool's result (a single object wrapping the engine's union). */
export interface IAutoMovieStageOutput {
  /** The staged scene on success, or the staging violations on failure. */
  staged: IAutoMovieStagedSet;
}

/** The `block` tool's result. */
export interface IAutoMovieBlockOutput {
  /** The blocked beat on success, or the blocking violations on failure. */
  blocked: IAutoMovieBlockedBeat;
}

/** The `cut` tool's result. */
export interface IAutoMovieCutOutput {
  /** The cut film on success, or the assemble violations on failure. */
  cut: IAutoMovieCut;
}

/** The `forge` tool's result. */
export interface IAutoMovieForgeOutput {
  /** The forged cast on success, or the forge violations on failure. */
  forged: IAutoMovieForgedCast;
}
