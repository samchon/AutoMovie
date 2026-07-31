import {
  IAutoMovieBeatEndFootPlant,
  IAutoMovieBeatEndState,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledFormation,
  IAutoMovieConstraintViolation,
  IAutoMovieDefinedShot,
  IAutoMovieFormationDesign,
  IAutoMovieModel,
  IAutoMovieProductionDesign,
  IAutoMovieShotDefinition,
  IAutoMovieShotProgram,
  IAutoMovieShotSourceOutput,
  IAutoMovieSkeleton,
  IAutoMovieStage,
  IAutoMovieVector3,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { IAutoMovieActionSynthesizer } from "../perform/compilePerformance";
import { IAutoMovieCollisionResponse } from "../physics/collisionResponse";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { blockBeat } from "./blockBeat";
import { performShot } from "./performShot";
import { realizeShotContract } from "./realizeShotContract";
import { resolveBeatEnd, resolveBeatOpening } from "./resolveBeatEnd";
import { stageScene } from "./stageScene";

/**
 * Register one coding-agent-authored shot.
 *
 * This helper deliberately does not execute or validate the builder. Module
 * evaluation remains side-effect free; {@link compileDefinedShot} owns all
 * validation and converts author-visible failures into structured diagnostics.
 */
export const defineShot = <Context>(
  id: string,
  definition: IAutoMovieShotDefinition<Context>,
): IAutoMovieDefinedShot<Context> => ({ id, ...definition });

/**
 * One D010 physical suggestion carried as data.
 *
 * The engine never applies {@link IAutoMovieShotPhysicsAdvice.proposal} by
 * implication. The coding agent may keep it pending, accept it, replace it with
 * a modified response, or reject it with rationale; the decision remains
 * visible beside the build.
 */
interface IAutoMovieShotPhysicsAdviceBase {
  /** Stable advice identity chosen by the shot code. */
  id: string;
  /** Engine-computed impact, push and optional ROM-bounded recoil. */
  proposal: IAutoMovieCollisionResponse;
}

/** One explicit author disposition over an engine D010 proposal. */
export type IAutoMovieShotPhysicsAdvice =
  | (IAutoMovieShotPhysicsAdviceBase & {
      /** The proposal has not been adjudicated yet. */
      decision: null;
      /** No response is selected while the decision is pending. */
      selected: null;
      /** Pending advice carries no invented rationale. */
      rationale: null;
    })
  | (IAutoMovieShotPhysicsAdviceBase & {
      /** The engine proposal is selected unchanged. */
      decision: "accepted";
      /** Exact selected response; validation requires it to equal proposal. */
      selected: IAutoMovieCollisionResponse;
      /** Non-blank author reason for accepting the suggestion. */
      rationale: string;
    })
  | (IAutoMovieShotPhysicsAdviceBase & {
      /** A source-authored replacement is selected. */
      decision: "modified";
      /** Replacement response, observably distinct from proposal. */
      selected: IAutoMovieCollisionResponse;
      /** Non-blank author reason for changing the suggestion. */
      rationale: string;
    })
  | (IAutoMovieShotPhysicsAdviceBase & {
      /** The suggestion is deliberately rejected. */
      decision: "rejected";
      /** Rejection applies no collision response. */
      selected: null;
      /** Non-blank author reason for rejecting the suggestion. */
      rationale: string;
    });

/** Host-owned capabilities needed to turn thin verbs into dense motion. */
export interface IAutoMovieShotRuntime {
  /** Rig-specific action synthesizer; engine composition and ROM gates follow. */
  synthesize: IAutoMovieActionSynthesizer;
  /** Rig lookup for every staged actor. */
  skeleton(node: string): IAutoMovieSkeleton | null;
  /**
   * Raster dimensions used to project required camera subjects at opening,
   * review-frame and closing times.
   */
  frameFormat: Pick<
    IAutoMovieProductionDesign["frameFormat"],
    "width" | "height"
  >;
  /** Optional world landmarks cited by contract predicates. */
  world?: IAutoMovieWorldDesign | null;
  /** Formation designs cited by the registered participant contract. */
  formationDesigns?: ReadonlyMap<string, IAutoMovieFormationDesign>;
  /** Compiler-owned compact formation runtimes present in this shot. */
  formations?: readonly IAutoMovieCompiledFormation[];
  /** Optional full models when predicates need model-owned rig evidence. */
  models?: readonly IAutoMovieModel[];
  /** Formation-slot collisions found while materializing this shot. */
  collisions?: readonly string[];
  /** Optional distinction between missing actor context and a rig-less actor. */
  hasActorContext?(node: string): boolean;
  /** Optional clinical rest frames used by attachment baking. */
  restFrames?(
    node: string,
  ):
    | Partial<
        Record<
          import("@automovie/interface").AutoMovieHumanoidBone,
          IAutoMovieRestFrame
        >
      >
    | undefined;
  /** Optional live point resolver for moving targets. */
  targetAt?(
    target: import("@automovie/interface").IAutoMovieActionTarget,
    seconds: number,
  ): IAutoMovieVector3 | null;
  /** Gait vocabulary available to each actor. */
  gaits?(node: string): readonly string[] | undefined;
  /** Prior verified beat state used as this shot's opening condition. */
  previous?: IAutoMovieBeatEndState;
  /** Ground-IK stance runs carried into the closing continuity snapshot. */
  plants?: ReadonlyArray<{
    /** Scene node whose feet were measured. */
    node: string;
    /** Measured stance runs for that node. */
    plants: readonly IAutoMovieBeatEndFootPlant[];
  }>;
  /** Optional D010 suggestions generated by shot code or a host analysis pass. */
  advice?: readonly IAutoMovieShotPhysicsAdvice[];
}

/** One actionable failure at the public authoring boundary. */
export interface IAutoMovieAuthoringDiagnostic {
  /** Stable machine-readable category. */
  code:
    | "registration-invalid"
    | "builder-failed"
    | "contract-mismatch"
    | "contract-realization-failed"
    | "stage-invalid"
    | "blocking-invalid"
    | "performance-invalid"
    | "pipeline-failed";
  /** Pipeline phase that owns the correction. */
  phase:
    | "registration"
    | "build"
    | "stage"
    | "blocking"
    | "performance"
    | "contract"
    | "continuity";
  /** Exact source or generated field that failed. */
  path: string;
  /** What was observed, including the offending identity or value. */
  fact: string;
  /** Why the failure prevents a trustworthy shot artifact. */
  impact: string;
  /** Concrete source edit or input correction that permits the next attempt. */
  recovery: string;
  /** Original domain violation when a lower engine gate produced one. */
  violation?: IAutoMovieConstraintViolation;
}

/** Result of the direct, non-MCP shot authoring entry point. */
export type IAutoMovieCompiledDefinedShot =
  | {
      /** The registered builder passed every engine gate. */
      success: true;
      /** Compiler-ready source artifact produced by the performShot pipeline. */
      source: IAutoMovieShotSourceOutput;
      /** Independently sampled opening and closing continuity facts. */
      continuity: {
        /** State at shot-local time zero. */
        opening: IAutoMovieBeatEndState;
        /** State at the exclusive shot end. */
        closing: IAutoMovieBeatEndState;
      };
      /** Independent outcomes measured from current scene, motion and camera. */
      realization: IAutoMovieCompiledContractRealization;
      /** D010 suggestions, preserved as decisions rather than imposed motion. */
      advice: readonly IAutoMovieShotPhysicsAdvice[];
    }
  | {
      /** No shot artifact was emitted. */
      success: false;
      /** Every actionable failure discovered at the first failing phase. */
      diagnostics: IAutoMovieAuthoringDiagnostic[];
    };

/**
 * Compile a registered shot without MCP.
 *
 * The builder supplies ordinary code; the engine owns stage referential
 * integrity, blocking coherence, verb composition, ROM validation, artifact
 * validation and continuity sampling. Author mistakes return diagnostics.
 * Unexpected builder exceptions are also translated at this public boundary,
 * keeping raw throws internal to programmer invariants.
 */
export const compileDefinedShot = <Context>(props: {
  /** Registered source export. */
  shot: IAutoMovieDefinedShot<Context>;
  /** Frozen or caller-owned data read by the source builder. */
  context: Context;
  /** Host motion and rig capabilities. */
  runtime: IAutoMovieShotRuntime;
}): IAutoMovieCompiledDefinedShot => {
  let registration: IAutoMovieAuthoringDiagnostic[];
  try {
    registration = validateRegistration(props.shot);
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        {
          code: "pipeline-failed",
          phase: "registration",
          path: "$shot",
          fact: `The registration boundary threw ${errorText(error)}.`,
          impact:
            "No stable shot identity or contract can be selected for compilation.",
          recovery:
            "Pass one defineShot export with a non-blank id, scene and contract beat, then compile that same value again.",
        },
      ],
    };
  }
  if (registration.length !== 0)
    return { success: false, diagnostics: registration };

  let program: IAutoMovieShotProgram;
  try {
    program = props.shot.build(props.context);
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        {
          code: "builder-failed",
          phase: "build",
          path: "$shot.build",
          fact: `The registered builder threw ${errorText(error)}.`,
          impact:
            "No deterministic program exists, so stage and motion validation cannot run.",
          recovery:
            "Correct the named source operation or precondition and return an IAutoMovieShotProgram synchronously.",
        },
      ],
    };
  }

  let phase: IAutoMovieAuthoringDiagnostic["phase"] = "build";
  try {
    const contract = validateProgramContract(props.shot, program);
    if (contract.length !== 0) return { success: false, diagnostics: contract };

    phase = "stage";
    const advice = validateAdvice(props.runtime.advice ?? []);
    if (advice.length !== 0) return { success: false, diagnostics: advice };

    const authoredStage = stageScene(program.script, program.stage);
    if (authoredStage.success === false)
      return {
        success: false,
        diagnostics: authoredStage.violations.map((violation) =>
          fromViolation("stage", "stage-invalid", violation),
        ),
      };

    phase = "blocking";
    const blocked = blockBeat(
      program.script,
      authoredStage,
      program.blocking,
      props.runtime.previous,
    );
    if (blocked.success === false)
      return {
        success: false,
        diagnostics: blocked.violations.map((violation) =>
          fromViolation("blocking", "blocking-invalid", violation),
        ),
      };

    phase = "stage";
    const resumedStage =
      blocked.previous === null
        ? authoredStage
        : stageScene(
            program.script,
            resumeStage(program.stage, blocked.previous),
          );
    if (resumedStage.success === false)
      return {
        success: false,
        diagnostics: resumedStage.violations.map((violation) =>
          fromViolation("stage", "stage-invalid", violation),
        ),
      };
    const staged = resumePoses(resumedStage, blocked.previous);

    phase = "performance";
    const performed = performShot({
      script: program.script,
      staged,
      performance: program.performance,
      synthesize: props.runtime.synthesize,
      skeleton: props.runtime.skeleton,
      hasActorContext: props.runtime.hasActorContext,
      restFrames: props.runtime.restFrames,
      targetAt: props.runtime.targetAt,
      gaits: props.runtime.gaits,
      blocking: blocked.blocking,
      shotId: props.shot.id,
      previous: blocked.previous,
    });
    if (performed.success === false)
      return {
        success: false,
        diagnostics: performed.violations.map((violation) =>
          fromViolation("performance", "performance-invalid", violation),
        ),
      };

    const motions = Object.values(performed.motions);
    const source: IAutoMovieShotSourceOutput = {
      eventSamples: structuredClone(program.eventSamples),
      scene: staged.scene,
      motions,
      shot: performed.shot,
    };
    phase = "contract";
    const measured = realizeShotContract({
      contract: {
        ...props.shot.contract,
        id: props.shot.id,
        source: {
          module: `<defineShot:${props.shot.id}>`,
          export: props.shot.id,
        },
      },
      production: null,
      frameFormat: props.runtime.frameFormat,
      world: props.runtime.world ?? null,
      formations: props.runtime.formationDesigns ?? new Map(),
      compiled: {
        ...source,
        models: [...(props.runtime.models ?? [])],
        formations: [...(props.runtime.formations ?? [])],
      },
      skeleton: props.runtime.skeleton,
      collisions: props.runtime.collisions ?? [],
    });
    if (measured.diagnostics.length !== 0)
      return {
        success: false,
        diagnostics: measured.diagnostics.map((diagnostic) => ({
          code: "contract-realization-failed",
          phase: "contract",
          path: diagnostic.path ?? "$shot.contract",
          fact: diagnostic.message,
          impact:
            "Independent scene, motion, event, or camera evidence does not realize the registered shot contract.",
          recovery:
            "Correct the authored stage, performance, event sample, or camera named by the fact; do not change contract prose to echo the current output.",
        })),
      };

    phase = "continuity";
    const replantedNodes = new Set(performed.plants.map((entry) => entry.node));
    const continuityProps = {
      beat: props.shot.contract.beat,
      scene: staged.scene,
      shot: performed.shot,
      motions,
      mounts: staged.mounts,
      plants: [
        ...(props.runtime.plants ?? []).filter(
          (entry) => replantedNodes.has(entry.node) === false,
        ),
        ...performed.plants,
      ],
    };
    return {
      success: true,
      source,
      continuity: {
        opening: resumeOpeningSnapshot(
          resolveBeatOpening(continuityProps),
          blocked.previous,
        ),
        closing: resolveBeatEnd(continuityProps),
      },
      realization: measured.realization,
      advice: structuredClone(props.runtime.advice ?? []),
    };
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        {
          code: "pipeline-failed",
          phase,
          path: `$${phase}`,
          fact: `The ${phase} pipeline threw ${errorText(error)}.`,
          impact:
            "The public authoring boundary cannot publish a partially measured or partially validated shot.",
          recovery:
            "Correct the runtime capability, authored value, or duplicate continuity input named by the fact, then compile the same registered export again.",
        },
      ],
    };
  }
};

/** Keep resumable simulation facts authoritative at the new opening instant. */
const resumeOpeningSnapshot = (
  opening: IAutoMovieBeatEndState,
  previous: IAutoMovieBeatEndState | null,
): IAutoMovieBeatEndState => {
  if (previous === null) return opening;
  const states = new Map(previous.actors.map((actor) => [actor.node, actor]));
  return {
    ...opening,
    actors: opening.actors.map((actor) => {
      const prior = states.get(actor.node);
      return prior === undefined
        ? actor
        : {
            ...actor,
            gaitPhase: prior.gaitPhase,
            rootVelocity: structuredClone(prior.rootVelocity),
            footPlants: structuredClone(prior.footPlants),
            mount: structuredClone(prior.mount),
          };
    }),
  };
};

/** Resume root placement, facing, and persistent mounts before staging. */
const resumeStage = (
  stage: IAutoMovieStage,
  previous: IAutoMovieBeatEndState,
): IAutoMovieStage => {
  const states = new Map(previous.actors.map((actor) => [actor.node, actor]));
  return {
    ...stage,
    actors: stage.actors.map((actor) => {
      const prior = states.get(actor.node);
      return prior === undefined
        ? actor
        : {
            ...actor,
            position: structuredClone(prior.transform.translation),
            facingDeg:
              (Math.atan2(prior.facing.x, prior.facing.z) * 180) / Math.PI,
            attach:
              prior.mount === null ? undefined : structuredClone(prior.mount),
          };
    }),
  };
};

/** Carry prior articulation onto the resumed scene's opening frame. */
const resumePoses = (
  staged: Extract<ReturnType<typeof stageScene>, { success: true }>,
  previous: IAutoMovieBeatEndState | null,
): Extract<ReturnType<typeof stageScene>, { success: true }> => {
  if (previous === null) return staged;
  const states = new Map(previous.actors.map((actor) => [actor.node, actor]));
  return {
    ...staged,
    scene: {
      ...staged.scene,
      nodes: staged.scene.nodes.map((node) => {
        const pose = states.get(node.id)?.pose;
        return pose === undefined
          ? node
          : { ...node, pose: structuredClone(pose) };
      }),
    },
  };
};

const validateAdvice = (
  advice: readonly IAutoMovieShotPhysicsAdvice[],
): IAutoMovieAuthoringDiagnostic[] => {
  const diagnostics: IAutoMovieAuthoringDiagnostic[] = [];
  const ids = new Map<string, number>();
  advice.forEach((item, index) => {
    const path = `$runtime.advice[${index}]`;
    const first = ids.get(item.id);
    if (item.id.trim().length === 0 || first !== undefined)
      diagnostics.push({
        code: "contract-mismatch",
        phase: "performance",
        path: `${path}.id`,
        fact:
          first === undefined
            ? "The physics-advice id is blank."
            : `Physics-advice id "${item.id}" duplicates ${`$runtime.advice[${first}].id`}.`,
        impact:
          "The selected D010 decision cannot be audited against one stable proposal.",
        recovery:
          "Give every advice item one non-blank id that is unique in this shot.",
      });
    else ids.set(item.id, index);

    const rationaleValid =
      typeof item.rationale === "string" && item.rationale.trim().length !== 0;
    const proposalEqualsSelected =
      item.selected !== null &&
      JSON.stringify(canonicalAdviceValue(item.proposal)) ===
        JSON.stringify(canonicalAdviceValue(item.selected));
    const valid =
      item.decision === null
        ? item.selected === null && item.rationale === null
        : item.decision === "accepted"
          ? item.selected !== null && proposalEqualsSelected && rationaleValid
          : item.decision === "modified"
            ? item.selected !== null &&
              proposalEqualsSelected === false &&
              rationaleValid
            : item.selected === null && rationaleValid;
    if (valid === false)
      diagnostics.push({
        code: "contract-mismatch",
        phase: "performance",
        path,
        fact: `D010 advice "${item.id}" has decision ${JSON.stringify(item.decision)}, selected ${item.selected === null ? "null" : "response data"}, and rationale ${JSON.stringify(item.rationale)}.`,
        impact:
          "The artifact cannot distinguish an unchanged proposal, an authored replacement, and a rejected physical suggestion.",
        recovery:
          "Keep pending selected/rationale null; copy proposal into selected for accepted; provide a different selected response for modified; or keep selected null for rejected. Every decided item needs a non-blank rationale.",
      });
  });
  return diagnostics;
};

/** Compare response data by value rather than source object key insertion order. */
const canonicalAdviceValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalAdviceValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [
        key,
        canonicalAdviceValue((value as Record<string, unknown>)[key]),
      ]),
  );
};

const validateRegistration = <Context>(
  shot: IAutoMovieDefinedShot<Context>,
): IAutoMovieAuthoringDiagnostic[] => {
  const diagnostics: IAutoMovieAuthoringDiagnostic[] = [];
  for (const [path, value, label] of [
    ["$shot.id", shot.id, "shot id"],
    ["$shot.scene", shot.scene, "scene id"],
    ["$shot.contract.beat", shot.contract.beat, "contract beat id"],
  ] as const)
    if (typeof value !== "string" || value.trim().length === 0)
      diagnostics.push({
        code: "registration-invalid",
        phase: "registration",
        path,
        fact: `The ${label} is blank.`,
        impact:
          "The source export cannot receive a stable registered artifact address.",
        recovery: `Give ${path} one non-blank stable id and keep it identical across source and design references.`,
      });
  return diagnostics;
};

const validateProgramContract = <Context>(
  shot: IAutoMovieDefinedShot<Context>,
  program: IAutoMovieShotProgram,
): IAutoMovieAuthoringDiagnostic[] => {
  const diagnostics: IAutoMovieAuthoringDiagnostic[] = [];
  const mismatch = (
    path: string,
    actual: unknown,
    expected: unknown,
    correction: string,
  ): void => {
    if (actual === expected) return;
    diagnostics.push({
      code: "contract-mismatch",
      phase: "build",
      path,
      fact: `${path} is ${JSON.stringify(actual)} but the registration requires ${JSON.stringify(expected)}.`,
      impact:
        "The source program would self-certify a different artifact than the registered contract.",
      recovery: correction,
    });
  };
  mismatch(
    "$program.stage.scene.id",
    program.stage.scene.id,
    shot.scene,
    "Make the staged scene id equal the scene declared by defineShot.",
  );
  mismatch(
    "$program.blocking.beat",
    program.blocking.beat,
    shot.contract.beat,
    "Make blocking.beat equal the registered contract beat.",
  );
  mismatch(
    "$program.performance.beat",
    program.performance.beat,
    shot.contract.beat,
    "Make performance.beat equal the registered contract beat.",
  );
  mismatch(
    "$program.blocking.duration",
    program.blocking.duration,
    shot.contract.durationSeconds,
    "Make blocking.duration equal the registered contract duration.",
  );
  mismatch(
    "$program.performance.duration",
    program.performance.duration,
    shot.contract.durationSeconds,
    "Make performance.duration equal the registered contract duration.",
  );

  const stagedActors = new Set(program.stage.actors.map((actor) => actor.node));
  const actorFacts = new Map<string, number>();
  program.actors.forEach((actor, index) => {
    const path = `$program.actors[${index}]`;
    const first = actorFacts.get(actor.node);
    const invalid =
      actor.node.trim().length === 0
        ? "node is blank"
        : first !== undefined
          ? `node "${actor.node}" duplicates $program.actors[${first}].node`
          : stagedActors.has(actor.node) === false
            ? `node "${actor.node}" is absent from stage.actors`
            : actor.model.trim().length === 0
              ? "model is blank"
              : Number.isFinite(actor.speed) === false || actor.speed <= 0
                ? `speed is ${JSON.stringify(actor.speed)} instead of finite and above zero`
                : Number.isFinite(actor.eyeHeight) === false ||
                    actor.eyeHeight < 0
                  ? `eyeHeight is ${JSON.stringify(actor.eyeHeight)} instead of finite and non-negative`
                  : null;
    if (invalid === null) actorFacts.set(actor.node, index);
    else
      diagnostics.push({
        code: "contract-mismatch",
        phase: "build",
        path,
        fact: `${path} ${invalid}.`,
        impact:
          "The host cannot bind this thin actor program to one measured staged runtime.",
        recovery:
          "Use one staged actor node and one non-blank compiler model id, then provide finite positive speed and finite non-negative eye height.",
      });
  });

  const samples = new Map<string, number>();
  program.eventSamples.forEach((sample, index) => {
    if (samples.has(sample.id))
      diagnostics.push({
        code: "contract-mismatch",
        phase: "build",
        path: `$program.eventSamples[${index}].id`,
        fact: `Event sample "${sample.id}" is duplicated.`,
        impact:
          "A declared semantic event would have more than one claimed authority time.",
        recovery:
          "Return exactly one independently chosen sample for each registered event id.",
      });
    samples.set(sample.id, sample.time);
  });
  shot.contract.events.forEach((event) => {
    const time = samples.get(event.id);
    if (
      time === undefined ||
      Number.isFinite(time) === false ||
      time < event.window.from ||
      time > event.window.to
    )
      diagnostics.push({
        code: "contract-mismatch",
        phase: "build",
        path: "$program.eventSamples",
        fact:
          time === undefined
            ? `Event "${event.id}" has no sample.`
            : `Event "${event.id}" is sampled at ${time}s outside ${event.window.from}..${event.window.to}s.`,
        impact:
          "The engine cannot independently measure the event inside its authoritative window.",
        recovery: `Return one finite "${event.id}" sample inside its registered event window.`,
      });
  });
  for (const id of samples.keys())
    if (shot.contract.events.some((event) => event.id === id) === false)
      diagnostics.push({
        code: "contract-mismatch",
        phase: "build",
        path: "$program.eventSamples",
        fact: `Event sample "${id}" is not declared by the registered contract.`,
        impact:
          "Source output would invent an event instead of realizing an authoritative requirement.",
        recovery:
          "Remove the sample or add the intended measurable event to defineShot's contract.",
      });
  return diagnostics;
};

const fromViolation = (
  phase: "stage" | "blocking" | "performance",
  code: "stage-invalid" | "blocking-invalid" | "performance-invalid",
  violation: IAutoMovieConstraintViolation,
): IAutoMovieAuthoringDiagnostic => ({
  code,
  phase,
  path: violation.path,
  fact: `${violation.expected}; received ${JSON.stringify(violation.value)}.`,
  impact: `The ${phase} gate cannot emit a trustworthy registered shot while this constraint is unsatisfied.`,
  recovery: `Correct ${violation.path} according to the stated bound, then compile the same registered export again.`,
  violation,
});

const errorText = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);
