import {
  IAutoMovieActorContext,
  IAutoMovieBlockedBeat,
  IAutoMovieCut,
  IAutoMovieForgedCast,
  IAutoMoviePerformedShot,
  IAutoMovieStagedSet,
  blockBeat,
  cutSequence,
  forgeCast,
  makeActorSynthesizer,
  performShot,
  readSlateContext,
  stageScene,
} from "@automovie/engine";
import {
  AutoMovieEasing,
  AutoMovieHumanoidBone,
  IAutoMovieAssembleApplication,
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieConstraintViolation,
  IAutoMovieExpression,
  IAutoMovieForgeApplication,
  IAutoMovieGait,
  IAutoMovieGaitRootBob,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMoviePose,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieSlate,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * AutoMovie's deterministic motion-control engine, exposed as MCP tools. Query
 * tools read slate context; `stage`, `block`, `perform`, `cut`, and `forge`
 * compute the film pipeline. Each tool takes structured creative intent and
 * returns the engine's result, including violations that make the engine, not
 * the model, the arbiter of physical truth ("engine enforces, model creates").
 *
 * `@typia/mcp` derives every tool's JSON schema, and validates requests and
 * responses, straight from this class's method signatures and JSDoc via
 * `typia.llm.controller`; the old per-stage
 * `typia.llm.application<IAutoMovie*Application>()` interfaces are retired as
 * the integration surface. Drive the pipeline stage by stage, feeding each
 * tool's output into the next.
 *
 * `perform` keeps the MCP contract JSON-only by accepting per-actor motion
 * contexts and assembling the engine's default synthesizer inside the server.
 * How many servers/tools the whole pipeline should become remains an ongoing
 * design experiment, not a fixed shape.
 *
 * @author Samchon
 */
export class AutoMovieApplication {
  /**
   * Read the script slice from a slate. It returns `null` until the SCRIPT
   * stage has committed a script, so agents can ask for context without
   * inventing it.
   *
   * @param props The slate to query.
   * @returns The script slice, or null when absent.
   */
  public getScript(props: {
    /** The stored slate slices to read. */ slate: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetScriptOutput {
    return {
      script: readSlateContext(toStoredSlate(props.slate), {
        type: "getScript",
      }) as IAutoMovieScript | null,
    };
  }

  /**
   * Read the staged scene slice from a slate. It returns `null` until STAGING
   * has committed a scene, letting later tools gate on real state.
   *
   * @param props The slate to query.
   * @returns The staged scene slice, or null when absent.
   */
  public getScene(props: {
    /** The stored slate slices to read. */ slate: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetSceneOutput {
    return {
      scene: readSlateContext(toStoredSlate(props.slate), {
        type: "getScene",
      }) as IAutoMovieScene | null,
    };
  }

  /**
   * Read the shot built for one beat. Missing shots return `null`; duplicate
   * shot ids throw as an ambiguous slate state.
   *
   * @param props The slate and beat id to query.
   * @returns The matching shot, or null when absent.
   */
  public getShot(props: {
    /** The stored slate slices to read. */
    slate: IAutoMovieMcpStoredSlate;
    /** Beat id whose shot should be read. */
    beat: string;
  }): IAutoMovieGetShotOutput {
    return {
      shot: readSlateContext(toStoredSlate(props.slate), {
        type: "getShot",
        beat: props.beat,
      }) as IAutoMovieShot | null,
    };
  }

  /**
   * Read review notes from a slate. Omitting `beat` returns the full open
   * backlog; providing it scopes the notes to one beat.
   *
   * @param props The slate and optional beat filter to query.
   * @returns The matching review notes.
   */
  public getNotes(props: {
    /** The stored slate slices to read. */
    slate: IAutoMovieMcpStoredSlate;
    /** Optional beat id filter. */
    beat?: string;
  }): IAutoMovieGetNotesOutput {
    return {
      notes: readSlateContext(toStoredSlate(props.slate), {
        type: "getNotes",
        beat: props.beat,
      }) as IAutoMovieReviewNote[],
    };
  }

  /**
   * Read the resolved end-state for one beat. Missing entries return `null`;
   * duplicates throw as an ambiguous slate state.
   *
   * @param props The slate and beat id to query.
   * @returns The matching beat end state, or null when absent.
   */
  public getBeatEnd(props: {
    /** The stored slate slices to read. */
    slate: IAutoMovieMcpStoredSlate;
    /** Beat id whose end state should be read. */
    beat: string;
  }): IAutoMovieGetBeatEndOutput {
    return {
      beatEnd: readSlateContext(toStoredSlate(props.slate), {
        type: "getBeatEnd",
        beat: props.beat,
      }) as IAutoMovieBeatEndState | null,
    };
  }

  /**
   * Stage a scene -- the first deterministic step. Place the script's cast on
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
   * Block a beat -- plan the coarse movement (who goes where, in what order,
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
   * Perform a shot -- compile one beat's action calls into camera/object tracks
   * and per-actor clips over a successfully staged scene. The server builds the
   * default deterministic synthesizer from the provided actor contexts, so MCP
   * clients pass only JSON: gait/profile data, optional rigs, and optional rest
   * frames. The MCP gait shape omits cubic-bezier tuple fields because the LLM
   * schema cannot express tuples. Supplying validated blocking arms the
   * intent-realization gates.
   *
   * @param props The script, staged scene, performance write, actor contexts,
   *   and optional validated blocking.
   * @returns The performed shot on success, or the performance violations.
   */
  public perform(props: {
    /** The script: the cast and beats the shot belongs to. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The successfully staged scene this shot performs over. */
    staged: IAutoMovieStagedSet.ISuccess;
    /** The performance plan: timed action calls and camera frames. */
    performance: IAutoMoviePerformanceApplication.IWrite;
    /** Per staged actor, the data the default synthesizer needs. */
    actors: Record<string, IAutoMovieMcpActorContext>;
    /** Optional validated blocking, from a successful `block` result. */
    blocking?: IAutoMovieBlockingApplication.IWrite;
  }): IAutoMoviePerformOutput {
    const contexts = new Map<string, IAutoMovieActorContext>(
      Object.entries(props.actors).map(([node, context]) => [
        node,
        toActorContext(context),
      ]),
    );
    const nodes = new Map(
      props.staged.scene.nodes.map((node) => [
        node.id,
        node.transform.translation,
      ]),
    );
    const synthesize = makeActorSynthesizer(contexts, nodes);
    const performed = performShot({
      script: props.script,
      staged: props.staged,
      performance: props.performance,
      synthesize,
      skeleton: (node) => contexts.get(node)?.rig ?? null,
      restFrames: (node) => contexts.get(node)?.restFrames,
      blocking: props.blocking,
    });
    return { performed: toMcpPerformedShot(performed) };
  }

  /**
   * Cut shots into a film -- assemble a sequence of performed shots on the
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
   * Forge a cast's models -- build the parametric head/body meshes the script's
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

const toActorContext = (
  context: IAutoMovieMcpActorContext,
): IAutoMovieActorContext => ({
  ...context,
  gaits: context.gaits.map((gait): IAutoMovieGait => ({ ...gait })),
});

const toMcpPerformedShot = (
  performed: IAutoMoviePerformedShot,
): IAutoMovieMcpPerformedShot =>
  performed.success === false
    ? performed
    : {
        ...performed,
        motions: Object.fromEntries(
          Object.entries(performed.motions).map(([node, motion]) => [
            node,
            toMcpMotion(motion),
          ]),
        ),
      };

const toMcpMotion = (motion: IAutoMovieMotion): IAutoMovieMcpMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((keyframe) => ({
    ...keyframe,
    bezier: toMcpBezier(keyframe.bezier),
  })),
});

const toMcpBezier = (
  bezier: IAutoMovieKeyframe["bezier"],
): IAutoMovieMcpBezier | null =>
  bezier === null
    ? null
    : {
        x1: bezier[0],
        y1: bezier[1],
        x2: bezier[2],
        y2: bezier[3],
      };

const toStoredSlate = (slate: IAutoMovieMcpStoredSlate): IAutoMovieSlate => ({
  brief: "",
  script: slate.script,
  scene: slate.scene,
  shots: slate.shots,
  beatEnds: slate.beatEnds,
  notes: slate.notes,
  film: null,
});

/**
 * Stored slate slices accepted by MCP query tools.
 *
 * This is narrower than the full production slate so query schemas stay small:
 * film assembly is not needed to read script, scene, shots, notes, or beat-end
 * state.
 */
export interface IAutoMovieMcpStoredSlate {
  /** Committed script, or null before SCRIPT exists. */
  script: IAutoMovieScript | null;

  /** Committed staged scene, or null before STAGING exists. */
  scene: IAutoMovieScene | null;

  /** Shots built so far. */
  shots: IAutoMovieShot[];

  /** Resolved end-state snapshots for built beats. */
  beatEnds: IAutoMovieBeatEndState[];

  /** Open review notes. */
  notes: IAutoMovieReviewNote[];
}

/** The `getScript` query result. */
export interface IAutoMovieGetScriptOutput {
  /** The committed script slice, or null until it exists. */
  script: IAutoMovieScript | null;
}

/** The `getScene` query result. */
export interface IAutoMovieGetSceneOutput {
  /** The committed staged scene, or null until it exists. */
  scene: IAutoMovieScene | null;
}

/** The `getShot` query result. */
export interface IAutoMovieGetShotOutput {
  /** The shot for the requested beat, or null until it exists. */
  shot: IAutoMovieShot | null;
}

/** The `getNotes` query result. */
export interface IAutoMovieGetNotesOutput {
  /** Open review notes, optionally filtered by beat. */
  notes: IAutoMovieReviewNote[];
}

/** The `getBeatEnd` query result. */
export interface IAutoMovieGetBeatEndOutput {
  /** The end-state for the requested beat, or null until it exists. */
  beatEnd: IAutoMovieBeatEndState | null;
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

/**
 * Actor context accepted by the MCP `perform` tool.
 *
 * This is the JSON-safe subset of the engine's actor context. Gait cubic-bezier
 * tuple fields are intentionally omitted; use named easing curves for
 * MCP-supplied gait limbs.
 */
export interface IAutoMovieMcpActorContext {
  /** Skeleton id every synthesized clip targets. */
  skeleton: string;

  /** Gaits this actor can perform, without tuple-valued bezier controls. */
  gaits: IAutoMovieMcpGait[];

  /** Where the actor stands at the start of the shot (world meters). */
  position: IAutoMovieVector3;

  /** Locomotion speed in meters per second. */
  speed: number;

  /** Heading the actor faces, degrees about +Y (0 = +Z). */
  facingDeg: number;

  /** Eye height above the actor position, meters. */
  eyeHeight: number;

  /** Pose the actor settles into for a `hold`. */
  restPose: IAutoMoviePose;

  /** Optional rig for ROM validation and IK/physics synthesis. */
  rig?: IAutoMovieSkeleton;

  /** Optional clinical rest-frame lookup, paired with the renderer/player. */
  restFrames?: IAutoMovieActorContext["restFrames"];
}

/** JSON-safe gait definition accepted by the MCP `perform` tool. */
export interface IAutoMovieMcpGait {
  /** Stable gait name such as `"walk"` or `"run"`. */
  name: string;

  /** Stride period in seconds. */
  period: number;

  /** Optional vertical body-mass oscillation. */
  rootBob?: IAutoMovieGaitRootBob;

  /** Limb swing channels without tuple-valued bezier controls. */
  limbs: IAutoMovieMcpGaitLimb[];
}

/** JSON-safe gait limb channel accepted by the MCP `perform` tool. */
export interface IAutoMovieMcpGaitLimb {
  /** The bone this limb swing drives. */
  bone: AutoMovieHumanoidBone;

  /** Joint axis this gait channel writes. */
  axis?: "flexion" | "abduction" | "twist";

  /** Cycle phase offset in [0, 1). */
  phase: number;

  /** Fraction of the stride spent in stance. */
  duty: number;

  /** Peak swing on the selected axis, degrees. */
  amplitude: number;

  /** Easing used while the limb is in stance. */
  stanceEasing?: AutoMovieEasing;

  /** Easing used while the limb is in swing. */
  swingEasing?: AutoMovieEasing;

  /** Center the swing oscillates around, degrees. */
  neutral?: number;
}

/**
 * Performed-shot union returned by the MCP `perform` tool.
 *
 * It mirrors the engine result but rewrites motion keyframe bezier tuples into
 * named object fields so MCP schema generation stays JSON-schema compatible.
 */
export type IAutoMovieMcpPerformedShot =
  | IAutoMovieMcpPerformedShot.ISuccess
  | IAutoMovieMcpPerformedShot.IFailure;
export namespace IAutoMovieMcpPerformedShot {
  /** The performance compiled and every clip passed validation. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The shot, ready for the cut. */
    shot: IAutoMovieShot;

    /** The synthesized per-actor clips, keyed by scene-node id. */
    motions: Record<string, IAutoMovieMcpMotion>;
  }

  /** The action list contradicted the stage, or a compiled clip broke ROM. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/** JSON-safe motion clip returned by the MCP `perform` tool. */
export interface IAutoMovieMcpMotion {
  /** Stable id so scenes and exports can cite this clip. */
  id: string;

  /** Which skeleton this clip animates. */
  skeleton: string;

  /** Total clip length, seconds. */
  duration: number;

  /** Whether the clip loops seamlessly. */
  loop: boolean;

  /** Keyframes in strictly increasing time order. */
  keyframes: IAutoMovieMcpKeyframe[];
}

/** JSON-safe keyframe returned by the MCP `perform` tool. */
export interface IAutoMovieMcpKeyframe {
  /** Timestamp within the clip, seconds. */
  time: number;

  /** The body pose held at this instant. */
  pose: IAutoMoviePose;

  /** Optional facial expression at this instant. */
  expression: IAutoMovieExpression | null;

  /** How to interpolate from this keyframe toward the next. */
  easing: AutoMovieEasing;

  /** Cubic-bezier control points as named fields, or null for named easing. */
  bezier: IAutoMovieMcpBezier | null;
}

/** Cubic-bezier control points as named fields, not a tuple. */
export interface IAutoMovieMcpBezier {
  /** First control point x. */
  x1: number;

  /** First control point y. */
  y1: number;

  /** Second control point x. */
  x2: number;

  /** Second control point y. */
  y2: number;
}

/** The `perform` tool's result. */
export interface IAutoMoviePerformOutput {
  /** The performed shot on success, or the performance violations on failure. */
  performed: IAutoMovieMcpPerformedShot;
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
