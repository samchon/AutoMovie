import {
  IAutoFilmBlockedBeat,
  IAutoFilmCut,
  IAutoFilmForgedCast,
  IAutoFilmStagedSet,
  blockBeat,
  cutSequence,
  forgeCast,
  stageScene,
} from "@autofilm/engine";
import {
  IAutoFilmAssembleApplication,
  IAutoFilmBlockingApplication,
  IAutoFilmForgeApplication,
  IAutoFilmScriptApplication,
  IAutoFilmShot,
  IAutoFilmStagingApplication,
} from "@autofilm/interface";

/**
 * AutoFilm's deterministic film engine, exposed as a **Model Context Protocol**
 * surface. Each public method is one validated MCP tool: an MCP client (Codex,
 * Claude, any agent) supplies the structured creative intent, the engine
 * computes the deterministic result, and the tool returns it — including the
 * placement / ROM / continuity violations that make the **engine, not the
 * model, the arbiter of physical truth** ("engine enforces, model creates").
 *
 * This class is the whole harness pulled into one place: `@typia/mcp` wraps it
 * via `typia.llm.controller`, deriving every tool's JSON schema from these
 * method signatures and their JSDoc, so the old per-stage
 * `typia.llm.application<IAutoFilm*Application>()` interfaces are no longer
 * needed — the agent drives the pipeline stage by stage, feeding each tool the
 * output of the previous one.
 *
 * Not here yet: `perform` (a shot) needs a per-actor synthesiser and rig
 * resolver built from the staged rigs, not plain JSON, so wiring it as a tool
 * is the open experiment.
 *
 * @author Samchon
 */
export class AutoFilmApplication {
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
    script: IAutoFilmScriptApplication.IWrite;
    /** The staging plan: where each actor, camera, and light goes. */
    staging: IAutoFilmStagingApplication.IWrite;
  }): IAutoFilmStageOutput {
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
    script: IAutoFilmScriptApplication.IWrite;
    /** The staged scene this beat blocks over (a successful `stage` result). */
    staged: IAutoFilmStagedSet.ISuccess;
    /** The blocking plan: the beat's movement intents and timing anchors. */
    blocking: IAutoFilmBlockingApplication.IWrite;
  }): IAutoFilmBlockOutput {
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
    assemble: IAutoFilmAssembleApplication.IWrite;
    /** The performed shots referenced by the assemble entries. */
    shots: IAutoFilmShot[];
  }): IAutoFilmCutOutput {
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
    script: IAutoFilmScriptApplication.IWrite;
    /** The forge specification: the model parameters per cast member. */
    forge: IAutoFilmForgeApplication.IWrite;
  }): IAutoFilmForgeOutput {
    return { forged: forgeCast(props.script, props.forge) };
  }
}

/** The `stage` tool's result (a single object wrapping the engine's union). */
export interface IAutoFilmStageOutput {
  /** The staged scene on success, or the staging violations on failure. */
  staged: IAutoFilmStagedSet;
}

/** The `block` tool's result. */
export interface IAutoFilmBlockOutput {
  /** The blocked beat on success, or the blocking violations on failure. */
  blocked: IAutoFilmBlockedBeat;
}

/** The `cut` tool's result. */
export interface IAutoFilmCutOutput {
  /** The cut film on success, or the assemble violations on failure. */
  cut: IAutoFilmCut;
}

/** The `forge` tool's result. */
export interface IAutoFilmForgeOutput {
  /** The forged cast on success, or the forge violations on failure. */
  forged: IAutoFilmForgedCast;
}
