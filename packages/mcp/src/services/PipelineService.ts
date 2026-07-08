import {
  IAutoMovieActionSynthesizer,
  IAutoMovieActorContext,
  IAutoMoviePerformedShot,
  IAutoMovieStagedSet,
  blockBeat,
  cutSequence,
  forgeCast,
  forgeProp,
  makeActorSynthesizer,
  performShot,
  resolveTargetPoint,
  stageScene,
  toValidation,
  violation,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieActionTarget,
  IAutoMovieAssembleApplication,
  IAutoMovieBlockingApplication,
  IAutoMovieConstraintViolation,
  IAutoMovieForgeApplication,
  IAutoMovieGait,
  IAutoMoviePerformanceApplication,
  IAutoMoviePropSpec,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";

import { AutoMovieContext } from "../AutoMovieContext";
import { toEnginePropSpec, toMcpMotion } from "../convert";
import {
  IAutoMovieBlockOutput,
  IAutoMovieCutOutput,
  IAutoMovieForgeOutput,
  IAutoMovieForgePropOutput,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpPerformedShot,
  IAutoMovieMcpPropSpec,
  IAutoMoviePerformOutput,
  IAutoMovieStageOutput,
} from "../dto";
import { isRecord } from "../validators/primitives";

type PerformProps = {
  script: IAutoMovieScriptApplication.IWrite;
  staged: IAutoMovieStagedSet.ISuccess;
  performance: IAutoMoviePerformanceApplication.IWrite;
  actors: Record<string, IAutoMovieMcpActorContext>;
  blocking?: IAutoMovieBlockingApplication.IWrite;
};

/**
 * The film pipeline compute — the stage/block/perform/cut/forge ladder over the
 * engine's deterministic consumers. `perform` assembles the default synthesizer
 * from JSON actor contexts so the MCP contract stays tuple-free. The MCP
 * contract lives on the {@link AutoMovieApplication} facade.
 */
export class PipelineService {
  public constructor(private readonly context?: AutoMovieContext) {}

  public stage(props: {
    script: IAutoMovieScriptApplication.IWrite;
    staging: IAutoMovieStagingApplication.IWrite;
  }): IAutoMovieStageOutput {
    return { staged: stageScene(props.script, props.staging) };
  }

  public block(props: {
    script: IAutoMovieScriptApplication.IWrite;
    staged: IAutoMovieStagedSet.ISuccess;
    blocking: IAutoMovieBlockingApplication.IWrite;
  }): IAutoMovieBlockOutput {
    return { blocked: blockBeat(props.script, props.staged, props.blocking) };
  }

  public perform(props: PerformProps): IAutoMoviePerformOutput {
    const actorViolations = validateActorRegistry(props.actors);
    if (actorViolations.length > 0)
      return { performed: { success: false, violations: actorViolations } };
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
    const synthesisViolations = collectDefaultSynthesisViolations(
      props,
      contexts,
      nodes,
      synthesize,
    );
    if (synthesisViolations.length > 0)
      return {
        performed: { success: false, violations: synthesisViolations },
      };
    const performed = performShot({
      script: props.script,
      staged: props.staged,
      performance: props.performance,
      synthesize,
      skeleton: (node) => contexts.get(node)?.rig ?? null,
      restFrames: (node) => contexts.get(node)?.restFrames,
      gaits: (node) => contexts.get(node)?.gaits.map((gait) => gait.name),
      blocking: props.blocking,
    });
    return { performed: toMcpPerformedShot(performed) };
  }

  public cut(props: {
    assemble: IAutoMovieAssembleApplication.IWrite;
    shots: IAutoMovieShot[];
  }): IAutoMovieCutOutput {
    return { cut: cutSequence(props.assemble, props.shots) };
  }

  public forge(props: {
    script: IAutoMovieScriptApplication.IWrite;
    forge: IAutoMovieForgeApplication.IWrite;
  }): IAutoMovieForgeOutput {
    return { forged: forgeCast(props.script, props.forge) };
  }

  /**
   * The prop side of forge stays a pure gate — except that when a resident
   * project is active (#671), an ACCEPTED spec writes through as
   * `props/<node>.json` (the #617 upsert: re-forging replaces exactly its own
   * file) and the output says so with `stored: true`. Pure (no-project) calls
   * and failed forges return byte-identical to the pre-#671 shape.
   *
   * **Re-forging a placed prop is refused (#712), symmetric with `eraseProp`.**
   * When the committed scene still places this prop AND a spec is already
   * stored, replacing that spec would leave committed shots resolving against
   * stale articulation (the same hazard `setPlacement` guards) — so the
   * write-through is refused (`stored: false`) with a `$slate.scene` violation:
   * re-commit the scene without the placement (or accept re-perform) first. The
   * asymmetry with `eraseProp` (which refuses on placement alone) is
   * deliberate: a FIRST forge of an as-yet-unstored node creates the spec shots
   * need rather than replacing one, so it always stores even if the scene
   * already names the node — only a REPLACEMENT of a placed prop stales.
   */
  public forgeProp(props: {
    spec: IAutoMovieMcpPropSpec;
  }): IAutoMovieForgePropOutput {
    const converted = convertPropSpecForForge(props.spec);
    if (converted.success === false) return { forged: converted };
    const forged = forgeProp(converted.prop);
    if (forged.success === false) return { forged };
    const output: IAutoMovieForgePropOutput = {
      forged: { success: true, prop: props.spec },
    };
    const project = this.context?.project ?? null;
    if (project === null) return output;

    const node = props.spec.node;
    const alreadyStored = project.storedProps().some((s) => s.node === node);
    const scene = project.storedSlate().scene;
    const placed =
      scene !== null && scene.nodes.some((entry) => entry.id === node);
    if (alreadyStored && placed)
      return {
        ...output,
        stored: false,
        validation: toValidation([
          violation(
            "type",
            "$slate.scene",
            `prop "${node}" is still placed in the committed scene; re-commit the scene without the placement before re-forging its spec (or accept re-perform)`,
            node,
          ),
        ]),
      };

    project.saveProp(props.spec);
    return { ...output, stored: true };
  }
}

const convertPropSpecForForge = (
  spec: IAutoMovieMcpPropSpec,
):
  | { success: true; prop: IAutoMoviePropSpec }
  | { success: false; violations: IAutoMovieConstraintViolation[] } => {
  try {
    return { success: true, prop: toEnginePropSpec(spec) };
  } catch {
    return {
      success: false,
      violations: [
        violation(
          "type",
          "$input.articulation",
          "prop articulation must match the forgeProp schema",
          spec.articulation,
        ),
      ],
    };
  }
};

const validateActorRegistry = (
  actors: unknown,
): IAutoMovieConstraintViolation[] => {
  if (!isRecord(actors))
    return [
      violation(
        "type",
        "$input.actors",
        "actors must be a JSON object",
        actors,
      ),
    ];
  const violations: IAutoMovieConstraintViolation[] = [];
  Object.entries(actors).forEach(([node, context]) => {
    const path = `$input.actors.${node}`;
    if (!isRecord(context)) {
      violations.push(
        violation("type", path, "actor context must be a JSON object", context),
      );
      return;
    }
    if (!Array.isArray(context.gaits))
      violations.push(
        violation(
          "type",
          `${path}.gaits`,
          "actor context gaits must be an array",
          context.gaits,
        ),
      );
  });
  return violations;
};

const toActorContext = (
  context: IAutoMovieMcpActorContext,
): IAutoMovieActorContext => ({
  ...context,
  gaits: context.gaits.map((gait): IAutoMovieGait => ({ ...gait })),
});

const DEFAULT_GESTURES = new Set<string>([
  "bow",
  "nod",
  "shake",
  "crouch",
  "kick",
  "stagger",
  "wave",
  "celebrate",
  "draw",
  "throw",
  "jump",
  "point",
  "strike",
]);

const actorList = (action: IAutoMovieActionCall): string[] =>
  typeof action.actor === "string"
    ? [action.actor]
    : Array.isArray(action.actor)
      ? action.actor.filter(
          (actor): actor is string => typeof actor === "string",
        )
      : [];

const actorPath = (
  action: IAutoMovieActionCall,
  actionPath: string,
  actor: string,
): string => {
  if (typeof action.actor === "string") return `${actionPath}.actor`;
  if (!Array.isArray(action.actor)) return `${actionPath}.actor`;
  const index = action.actor.indexOf(actor);
  return index === -1 ? `${actionPath}.actor` : `${actionPath}.actor[${index}]`;
};

const targetResolves = (
  target: IAutoMovieActionTarget,
  nodes: Map<string, IAutoMovieVector3>,
): boolean => resolveTargetPoint(target, nodes) !== null;

const collectDefaultSynthesisViolations = (
  props: PerformProps,
  contexts: ReadonlyMap<string, IAutoMovieActorContext>,
  nodes: Map<string, IAutoMovieVector3>,
  synthesize: IAutoMovieActionSynthesizer,
): IAutoMovieConstraintViolation[] => {
  const actions = props.performance.revise.final ?? props.performance.draft;
  const base =
    props.performance.revise.final !== null
      ? "$input.revise.final"
      : "$input.draft";
  const violations: IAutoMovieConstraintViolation[] = [];
  actions.forEach((action, index) => {
    const actionPath = `${base}[${index}]`;
    if (action.verb === "launch") {
      const onHit = describeLaunchOnHitGap(action, actionPath, contexts, nodes);
      if (onHit !== null) violations.push(onHit);
      return;
    }
    if (action.verb === "frame" || action.verb === "attachTo") return;

    for (const actor of actorList(action))
      if (synthesize(action, actor) === null) {
        const gap = describeDefaultSynthesisGap(
          action,
          actionPath,
          actor,
          contexts,
          nodes,
        );
        if (gap !== null) violations.push(gap);
      }
  });
  return violations;
};

const describeLaunchOnHitGap = (
  action: IAutoMovieActionCall & { verb: "launch" },
  actionPath: string,
  contexts: ReadonlyMap<string, IAutoMovieActorContext>,
  nodes: Map<string, IAutoMovieVector3>,
): IAutoMovieConstraintViolation | null => {
  if (
    action.onHit === undefined ||
    action.at.kind !== "node" ||
    !nodes.has(action.at.node)
  )
    return null;
  const context = contexts.get(action.at.node);
  if (context === undefined)
    return violation(
      "type",
      `${actionPath}.onHit`,
      `launch onHit for target "${action.at.node}" requires that actor's MCP context so the default performer can synthesize the generated react`,
      action.onHit,
    );
  if (context.rig === undefined)
    return violation(
      "type",
      `${actionPath}.onHit`,
      `launch onHit for target "${action.at.node}" requires a rig in that actor's MCP context so the default performer can synthesize the generated react`,
      action.onHit,
    );
  return null;
};

const describeDefaultSynthesisGap = (
  action: IAutoMovieActionCall,
  actionPath: string,
  actor: string,
  contexts: ReadonlyMap<string, IAutoMovieActorContext>,
  nodes: Map<string, IAutoMovieVector3>,
): IAutoMovieConstraintViolation | null => {
  const context = contexts.get(actor);
  if (context === undefined)
    return violation(
      "type",
      actorPath(action, actionPath, actor),
      `actor "${actor}" needs an MCP actor context before the default performer can synthesize its ${action.verb} action`,
      actor,
    );

  if (action.verb === "locomote") return null;
  if (action.verb === "lookAt")
    return targetResolves(action.to, nodes)
      ? violation(
          "type",
          `${actionPath}.to`,
          `the default performer could not synthesize lookAt for actor "${actor}"`,
          action.to,
        )
      : null;
  if (action.verb === "gesture") {
    if (!DEFAULT_GESTURES.has(action.kind))
      return violation(
        "type",
        `${actionPath}.kind`,
        `gesture "${action.kind}" is not supported by the MCP default performer; use one of ${[...DEFAULT_GESTURES].join(", ")} or provide a supported action`,
        action.kind,
      );
    if (action.kind === "point" || action.kind === "strike") {
      if (context.rig === undefined)
        return violation(
          "type",
          actorPath(action, actionPath, actor),
          `gesture "${action.kind}" for actor "${actor}" requires a rig in that actor's MCP context`,
          actor,
        );
      if (action.at === undefined || !targetResolves(action.at, nodes))
        return null;
      return violation(
        "type",
        `${actionPath}.at`,
        `the default performer could not solve gesture "${action.kind}" for actor "${actor}"`,
        action.at,
      );
    }
    return violation(
      "type",
      `${actionPath}.kind`,
      `the default performer could not synthesize gesture "${action.kind}" for actor "${actor}"`,
      action.kind,
    );
  }
  if (action.verb === "reach") {
    if (context.rig === undefined)
      return violation(
        "type",
        actorPath(action, actionPath, actor),
        `reach for actor "${actor}" requires a rig in that actor's MCP context`,
        actor,
      );
    if (!targetResolves(action.to, nodes)) return null;
    return violation(
      "type",
      `${actionPath}.to`,
      `the default performer could not solve reach for actor "${actor}"`,
      action.to,
    );
  }
  if (action.verb === "react" && context.rig === undefined)
    return violation(
      "type",
      actorPath(action, actionPath, actor),
      `react for actor "${actor}" requires a rig in that actor's MCP context`,
      actor,
    );

  return violation(
    "type",
    actionPath,
    `the MCP default performer could not synthesize ${action.verb} for actor "${actor}"`,
    action,
  );
};

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
