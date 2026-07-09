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
  stageScene,
  toValidation,
  violation,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
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
import {
  isRuntimeSafeActionTarget,
  resolveRuntimeSafeTargetPoint,
  targetNodeId,
} from "./actionTargets";

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
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { staged: { success: false, violations: requestRoot } };
    const violations = validateStageShape(props.script, props.staging);
    if (violations.length > 0)
      return { staged: { success: false, violations } };
    return {
      staged: remapMcpStagedSetPaths(stageScene(props.script, props.staging), [
        ["$script", "$input.script"],
        ["$input", "$input.staging"],
      ]),
    };
  }

  public block(props: {
    script: IAutoMovieScriptApplication.IWrite;
    staged: IAutoMovieStagedSet.ISuccess;
    blocking: IAutoMovieBlockingApplication.IWrite;
  }): IAutoMovieBlockOutput {
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { blocked: { success: false, violations: requestRoot } };
    const violations = validateBlockShape(
      props.script,
      props.staged,
      props.blocking,
    );
    if (violations.length > 0)
      return { blocked: { success: false, violations } };
    return {
      blocked: remapMcpBlockedBeatPaths(
        blockBeat(props.script, props.staged, props.blocking),
        [
          ["$script", "$input.script"],
          ["$input", "$input.blocking"],
        ],
      ),
    };
  }

  public perform(props: PerformProps): IAutoMoviePerformOutput {
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { performed: { success: false, violations: requestRoot } };
    const shapeViolations = validatePerformShape(props);
    if (shapeViolations.length > 0)
      return { performed: { success: false, violations: shapeViolations } };
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
    return {
      performed: remapMcpPerformedShotPaths(toMcpPerformedShot(performed), [
        ["$input", "$input.performance"],
      ]),
    };
  }

  public cut(props: {
    assemble: IAutoMovieAssembleApplication.IWrite;
    shots: IAutoMovieShot[];
  }): IAutoMovieCutOutput {
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { cut: { success: false, violations: requestRoot } };
    const violations = validateCutShape(props.assemble, props.shots);
    if (violations.length > 0) return { cut: { success: false, violations } };
    return {
      cut: remapMcpCutPaths(cutSequence(props.assemble, props.shots), [
        ["$input", "$input.assemble"],
        ["$shots", "$input.shots"],
      ]),
    };
  }

  public forge(props: {
    script: IAutoMovieScriptApplication.IWrite;
    forge: IAutoMovieForgeApplication.IWrite;
  }): IAutoMovieForgeOutput {
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { forged: { success: false, violations: requestRoot } };
    const violations = validateForgeShape(props.script, props.forge);
    if (violations.length > 0)
      return { forged: { success: false, violations } };
    return {
      forged: remapMcpForgedCastPaths(forgeCast(props.script, props.forge), [
        ["$script", "$input.script"],
        ["$input", "$input.forge"],
      ]),
    };
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
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { forged: { success: false, violations: requestRoot } };
    const violations = validateForgePropShape(props.spec);
    if (violations.length > 0)
      return { forged: { success: false, violations } };
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

const validatePipelineRequestRoot = (
  props: unknown,
): IAutoMovieConstraintViolation[] =>
  isRecord(props)
    ? []
    : [
        violation(
          "type",
          "$input",
          "pipeline request must be a JSON object",
          props,
        ),
      ];

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
          isRecord(spec) ? spec.articulation : spec,
        ),
      ],
    };
  }
};

const validateForgePropShape = (
  spec: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!isJsonObject(spec, "$input", "prop spec", violations)) return violations;
  requireString(spec.node, "$input.node", "prop node", violations);
  validateForgeModelShape(spec.model, "$input.model", violations);
  validateForgePropArticulationShape(
    spec.articulation,
    "$input.articulation",
    violations,
  );
  return violations;
};

const validateForgePropArticulationShape = (
  articulation: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (articulation === null) return;
  if (!isJsonObject(articulation, path, "prop articulation", violations))
    return;
  if (
    isJsonArray(
      articulation.nodes,
      `${path}.nodes`,
      "prop articulation nodes",
      violations,
    )
  )
    articulation.nodes.forEach((node, index) =>
      validateForgePropNodeShape(node, `${path}.nodes[${index}]`, violations),
    );
  validateForgePropProfileShape(
    articulation.profile,
    `${path}.profile`,
    violations,
  );
  validateForgePropBindingShape(
    articulation.binding,
    `${path}.binding`,
    violations,
  );
};

const validateForgePropNodeShape = (
  node: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(node, path, "prop articulation node", violations)) return;
  requireString(node.id, `${path}.id`, "prop articulation node id", violations);
  validateNullableString(
    node.parent,
    `${path}.parent`,
    "prop articulation node parent",
    violations,
  );
  validateNullableString(
    node.mesh,
    `${path}.mesh`,
    "prop articulation node mesh",
    violations,
  );
  validateNullableString(
    node.camera,
    `${path}.camera`,
    "prop articulation node camera",
    violations,
  );
  validateNullableString(
    node.light,
    `${path}.light`,
    "prop articulation node light",
    violations,
  );
  validateNullableString(
    node.skin,
    `${path}.skin`,
    "prop articulation node skin",
    violations,
  );
};

const validateForgePropProfileShape = (
  profile: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(profile, path, "prop profile", violations)) return;
  requireString(profile.id, `${path}.id`, "prop profile id", violations);
  requireString(profile.name, `${path}.name`, "prop profile name", violations);
  isJsonArray(
    profile.controls,
    `${path}.controls`,
    "prop profile controls",
    violations,
  );
  if (
    isJsonArray(
      profile.drivers,
      `${path}.drivers`,
      "prop profile drivers",
      violations,
    )
  )
    profile.drivers.forEach((driver, index) =>
      validateForgePropDriverShape(
        driver,
        `${path}.drivers[${index}]`,
        violations,
      ),
    );
  if (
    isJsonArray(
      profile.limits,
      `${path}.limits`,
      "prop profile limits",
      violations,
    )
  )
    profile.limits.forEach((limit, index) =>
      validateForgePropLimitShape(
        limit,
        `${path}.limits[${index}]`,
        violations,
      ),
    );
};

const validateForgePropBindingShape = (
  binding: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(binding, path, "prop profile binding", violations)) return;
  requireString(
    binding.profile,
    `${path}.profile`,
    "prop profile binding profile",
    violations,
  );
  requireString(
    binding.root,
    `${path}.root`,
    "prop profile binding root",
    violations,
  );
  validateNullableString(
    binding.instanceName,
    `${path}.instanceName`,
    "prop profile binding instance name",
    violations,
  );
  if (
    !isJsonObject(
      binding.boneMap,
      `${path}.boneMap`,
      "prop profile binding bone map",
      violations,
    )
  )
    return;
  Object.entries(binding.boneMap).forEach(([key, mapped]) =>
    requireString(
      mapped,
      `${path}.boneMap["${key}"]`,
      "prop profile binding mapped node",
      violations,
    ),
  );
};

const validateForgePropDriverShape = (
  driver: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(driver, path, "prop profile driver", violations)) return;
  if (typeof driver.type !== "string") {
    requireString(
      driver.type,
      `${path}.type`,
      "prop profile driver type",
      violations,
    );
    return;
  }
  switch (driver.type) {
    case "copy":
      requireString(
        driver.owner,
        `${path}.owner`,
        "copy driver owner",
        violations,
      );
      requireString(
        driver.source,
        `${path}.source`,
        "copy driver source",
        violations,
      );
      return;
    case "aim":
      requireString(
        driver.owner,
        `${path}.owner`,
        "aim driver owner",
        violations,
      );
      requireString(
        driver.target,
        `${path}.target`,
        "aim driver target",
        violations,
      );
      return;
    case "ik":
      validateStringArray(
        driver.chain,
        `${path}.chain`,
        "ik driver chain",
        violations,
      );
      requireString(driver.goal, `${path}.goal`, "ik driver goal", violations);
      validateNullablePole(driver.pole, `${path}.pole`, violations);
      return;
    case "parent":
      requireString(
        driver.owner,
        `${path}.owner`,
        "parent driver owner",
        violations,
      );
      requireString(
        driver.parent,
        `${path}.parent`,
        "parent driver parent",
        violations,
      );
      return;
    case "driven":
      validateChannelShape(
        driver.output,
        `${path}.output`,
        "driven driver output",
        violations,
      );
      validateChannelShape(
        driver.source,
        `${path}.source`,
        "driven driver source",
        violations,
      );
      validateNullableRangeObject(
        driver.inRange,
        `${path}.inRange`,
        "driven driver input range",
        violations,
      );
      validateNullableRangeObject(
        driver.outRange,
        `${path}.outRange`,
        "driven driver output range",
        violations,
      );
      return;
    case "spring":
      validateStringArray(
        driver.chain,
        `${path}.chain`,
        "spring driver chain",
        violations,
      );
      validateNullableString(
        driver.center,
        `${path}.center`,
        "spring driver center",
        violations,
      );
      return;
    default:
      violations.push(
        violation(
          "type",
          `${path}.type`,
          `prop profile driver type "${driver.type}" is not supported`,
          driver.type,
        ),
      );
  }
};

const validateForgePropLimitShape = (
  limit: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(limit, path, "prop profile limit", violations)) return;
  validateChannelShape(
    limit.channel,
    `${path}.channel`,
    "limit channel",
    violations,
  );
};

const validateChannelShape = (
  channel: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(channel, path, label, violations)) return;
  if (channel.kind === "node") {
    requireString(channel.node, `${path}.node`, `${label} node`, violations);
    requireString(channel.path, `${path}.path`, `${label} path`, violations);
  } else if (channel.kind === "pointer") {
    requireString(
      channel.pointer,
      `${path}.pointer`,
      `${label} pointer`,
      violations,
    );
    requireString(
      channel.valueType,
      `${path}.valueType`,
      `${label} value type`,
      violations,
    );
  } else
    violations.push(
      violation(
        "type",
        `${path}.kind`,
        `${label} kind must be "node" or "pointer"`,
        channel.kind,
      ),
    );
};

const validateStringArray = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonArray(value, path, label, violations)) return;
  value.forEach((entry, index) =>
    requireString(entry, `${path}[${index}]`, label, violations),
  );
};

const validateNullablePole = (
  pole: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (pole === null) return;
  if (!isJsonObject(pole, path, "ik driver pole", violations)) return;
  validateNullableString(pole.node, `${path}.node`, "ik pole node", violations);
};

const validateNullableRangeObject = (
  range: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (range === undefined) return;
  if (!isJsonObject(range, path, label, violations)) return;
};

const validateStageShape = (
  script: unknown,
  staging: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (isJsonObject(script, "$input.script", "script", violations)) {
    if (
      isJsonArray(script.cast, "$input.script.cast", "script cast", violations)
    )
      script.cast.forEach((member, index) => {
        const path = `$input.script.cast[${index}]`;
        if (!isJsonObject(member, path, "script cast member", violations))
          return;
        requireString(member.node, `${path}.node`, "cast node", violations);
        if (member.modelRef !== null)
          requireString(
            member.modelRef,
            `${path}.modelRef`,
            "cast model reference",
            violations,
          );
      });
  }

  if (isJsonObject(staging, "$input.staging", "staging", violations)) {
    if (
      isJsonObject(staging.scene, "$input.staging.scene", "scene", violations)
    )
      requireString(
        staging.scene.id,
        "$input.staging.scene.id",
        "scene id",
        violations,
      );
    if (
      isJsonArray(
        staging.actors,
        "$input.staging.actors",
        "staging actors",
        violations,
      )
    )
      staging.actors.forEach((actor, index) => {
        const path = `$input.staging.actors[${index}]`;
        if (!isJsonObject(actor, path, "actor placement", violations)) return;
        requireString(actor.node, `${path}.node`, "actor node", violations);
        requireVectorObject(
          actor.position,
          `${path}.position`,
          "actor position",
          violations,
        );
        if (actor.attach !== undefined && actor.attach !== null) {
          if (
            isJsonObject(
              actor.attach,
              `${path}.attach`,
              "mount binding",
              violations,
            )
          ) {
            requireString(
              actor.attach.parent,
              `${path}.attach.parent`,
              "mount parent",
              violations,
            );
            requireString(
              actor.attach.bone,
              `${path}.attach.bone`,
              "mount bone",
              violations,
            );
          }
        } else if (actor.attach === null)
          violations.push(
            violation(
              "type",
              `${path}.attach`,
              "mount binding must be omitted or a JSON object",
              actor.attach,
            ),
          );
      });
    if (
      isJsonArray(
        staging.cameras,
        "$input.staging.cameras",
        "staging cameras",
        violations,
      )
    )
      staging.cameras.forEach((camera, index) => {
        const path = `$input.staging.cameras[${index}]`;
        if (!isJsonObject(camera, path, "camera placement", violations)) return;
        requireString(camera.node, `${path}.node`, "camera node", violations);
        requireVectorObject(
          camera.position,
          `${path}.position`,
          "camera position",
          violations,
        );
        validateStageTarget(camera.lookAt, `${path}.lookAt`, violations);
      });
    if (
      isJsonArray(
        staging.lights,
        "$input.staging.lights",
        "staging lights",
        violations,
      )
    )
      staging.lights.forEach((light, index) => {
        const path = `$input.staging.lights[${index}]`;
        if (!isJsonObject(light, path, "light placement", violations)) return;
        requireString(light.node, `${path}.node`, "light node", violations);
        requireVectorObject(
          light.direction,
          `${path}.direction`,
          "light direction",
          violations,
        );
      });
  }
  return violations;
};

const validatePerformShape = (
  props: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!isJsonObject(props, "$input", "perform payload", violations))
    return violations;
  validatePerformScriptShape(props.script, "$input.script", violations);
  validatePerformStagedShape(props.staged, "$input.staged", violations);
  validatePerformPerformanceShape(
    props.performance,
    "$input.performance",
    violations,
  );
  return violations;
};

const validatePerformScriptShape = (
  script: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(script, path, "script", violations)) return;
  if (!isJsonArray(script.beats, `${path}.beats`, "script beats", violations))
    return;
  script.beats.forEach((beat, index) => {
    const beatPath = `${path}.beats[${index}]`;
    if (!isJsonObject(beat, beatPath, "script beat", violations)) return;
    requireString(beat.id, `${beatPath}.id`, "script beat id", violations);
  });
};

const validatePerformStagedShape = (
  staged: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(staged, path, "staged set", violations)) return;
  if (!isJsonObject(staged.scene, `${path}.scene`, "staged scene", violations))
    return;
  requireString(
    staged.scene.id,
    `${path}.scene.id`,
    "staged scene id",
    violations,
  );
  if (
    isJsonArray(
      staged.scene.nodes,
      `${path}.scene.nodes`,
      "staged scene nodes",
      violations,
    )
  )
    staged.scene.nodes.forEach((node, index) =>
      validatePerformStagedNodeShape(
        node,
        `${path}.scene.nodes[${index}]`,
        violations,
      ),
    );
  if (
    isJsonArray(
      staged.scene.cameras,
      `${path}.scene.cameras`,
      "staged scene cameras",
      violations,
    )
  )
    staged.scene.cameras.forEach((camera, index) => {
      const cameraPath = `${path}.scene.cameras[${index}]`;
      if (!isJsonObject(camera, cameraPath, "staged scene camera", violations))
        return;
      requireString(
        camera.id,
        `${cameraPath}.id`,
        "staged camera id",
        violations,
      );
    });
  isJsonArray(staged.mounts, `${path}.mounts`, "staged mounts", violations);
};

const validatePerformStagedNodeShape = (
  node: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(node, path, "staged scene node", violations)) return;
  requireString(node.id, `${path}.id`, "staged scene node id", violations);
  validateTransformObject(
    node.transform,
    `${path}.transform`,
    "staged scene node transform",
    violations,
  );
};

const validatePerformPerformanceShape = (
  performance: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(performance, path, "performance", violations)) return;
  validatePerformActionArray(performance.draft, `${path}.draft`, violations);
  if (
    !isJsonObject(
      performance.revise,
      `${path}.revise`,
      "performance revision",
      violations,
    )
  )
    return;
  if (performance.revise.final === null) return;
  validatePerformActionArray(
    performance.revise.final,
    `${path}.revise.final`,
    violations,
  );
};

const validatePerformActionArray = (
  actions: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonArray(actions, path, "performance actions", violations)) return;
  actions.forEach((action, index) =>
    isJsonObject(action, `${path}[${index}]`, "performance action", violations),
  );
};

const isJsonObject = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): value is Record<string, unknown> => {
  if (isRecord(value)) return true;
  violations.push(
    violation("type", path, `${label} must be a JSON object`, value),
  );
  return false;
};

const isJsonArray = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): value is unknown[] => {
  if (Array.isArray(value)) return true;
  violations.push(violation("type", path, `${label} must be an array`, value));
  return false;
};

const requireString = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (typeof value === "string") return;
  violations.push(violation("type", path, `${label} must be a string`, value));
};

const requireVectorObject = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  isJsonObject(value, path, label, violations);
};

const validateStageTarget = (
  target: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(target, path, "camera target", violations)) return;
  if (target.kind === "node")
    requireString(
      target.node,
      `${path}.node`,
      "camera target node",
      violations,
    );
  else if (target.kind === "point")
    requireVectorObject(
      target.point,
      `${path}.point`,
      "camera target point",
      violations,
    );
  else
    violations.push(
      violation(
        "type",
        path,
        'camera target kind must be "node" or "point"',
        target,
      ),
    );
};

const validateBlockShape = (
  script: unknown,
  staged: unknown,
  blocking: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (isJsonObject(script, "$input.script", "script", violations)) {
    if (
      isJsonArray(
        script.beats,
        "$input.script.beats",
        "script beats",
        violations,
      )
    )
      script.beats.forEach((beat, index) => {
        const path = `$input.script.beats[${index}]`;
        if (!isJsonObject(beat, path, "script beat", violations)) return;
        requireString(beat.id, `${path}.id`, "beat id", violations);
      });
  }

  if (isJsonObject(staged, "$input.staged", "staged set", violations)) {
    if (
      isJsonObject(staged.scene, "$input.staged.scene", "scene", violations)
    ) {
      const nodes = staged.scene.nodes;
      if (
        isJsonArray(
          nodes,
          "$input.staged.scene.nodes",
          "scene nodes",
          violations,
        )
      )
        nodes.forEach((node, index) => {
          const path = `$input.staged.scene.nodes[${index}]`;
          if (!isJsonObject(node, path, "scene node", violations)) return;
          requireString(node.id, `${path}.id`, "scene node id", violations);
        });
    }
  }

  if (isJsonObject(blocking, "$input.blocking", "blocking", violations)) {
    requireString(blocking.beat, "$input.blocking.beat", "beat id", violations);
    const actors = blocking.actors;
    if (
      isJsonArray(
        actors,
        "$input.blocking.actors",
        "blocking actors",
        violations,
      )
    )
      actors.forEach((actor, index) => {
        const path = `$input.blocking.actors[${index}]`;
        if (!isJsonObject(actor, path, "actor intent", violations)) return;
        requireString(actor.node, `${path}.node`, "actor node", violations);
        const anchors = actor.anchors;
        if (anchors !== undefined && anchors !== null) {
          if (
            isJsonArray(
              anchors,
              `${path}.anchors`,
              "actor timing anchors",
              violations,
            )
          )
            anchors.forEach((anchor, anchorIndex) => {
              const anchorPath = `${path}.anchors[${anchorIndex}]`;
              isJsonObject(
                anchor,
                anchorPath,
                "actor timing anchor",
                violations,
              );
            });
        }
      });

    if (
      isJsonObject(
        blocking.camera,
        "$input.blocking.camera",
        "camera",
        violations,
      )
    )
      validateStageTarget(
        blocking.camera.on,
        "$input.blocking.camera.on",
        violations,
      );
  }
  return violations;
};

const validateCutShape = (
  assemble: unknown,
  shots: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (isJsonObject(assemble, "$input.assemble", "assemble", violations)) {
    if (
      isJsonObject(
        assemble.sequence,
        "$input.assemble.sequence",
        "sequence",
        violations,
      )
    )
      requireString(
        assemble.sequence.id,
        "$input.assemble.sequence.id",
        "sequence id",
        violations,
      );
    if (
      isJsonArray(
        assemble.entries,
        "$input.assemble.entries",
        "cut entries",
        violations,
      )
    )
      assemble.entries.forEach((entry, index) => {
        const path = `$input.assemble.entries[${index}]`;
        if (!isJsonObject(entry, path, "cut entry", violations)) return;
        requireString(entry.shot, `${path}.shot`, "shot id", violations);
        validateNullableObject(entry.trim, `${path}.trim`, "trim", violations);
        validateNullableObject(
          entry.transition,
          `${path}.transition`,
          "transition",
          violations,
        );
      });
  }

  if (isJsonArray(shots, "$input.shots", "shots", violations))
    shots.forEach((shot, index) => {
      const path = `$input.shots[${index}]`;
      if (!isJsonObject(shot, path, "shot", violations)) return;
      requireString(shot.id, `${path}.id`, "shot id", violations);
    });
  return violations;
};

const validateNullableObject = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (value === null) return;
  isJsonObject(value, path, label, violations);
};

const validateForgeShape = (
  script: unknown,
  forge: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (isJsonObject(script, "$input.script", "script", violations)) {
    if (
      isJsonArray(script.cast, "$input.script.cast", "script cast", violations)
    )
      script.cast.forEach((member, index) => {
        const path = `$input.script.cast[${index}]`;
        if (!isJsonObject(member, path, "script cast member", violations))
          return;
        requireString(member.node, `${path}.node`, "cast node", violations);
        if (member.modelRef !== null)
          requireString(
            member.modelRef,
            `${path}.modelRef`,
            "cast model reference",
            violations,
          );
      });
  }

  if (isJsonObject(forge, "$input.forge", "forge", violations)) {
    if (
      isJsonArray(
        forge.entries,
        "$input.forge.entries",
        "forge entries",
        violations,
      )
    )
      forge.entries.forEach((entry, index) => {
        const path = `$input.forge.entries[${index}]`;
        if (!isJsonObject(entry, path, "forge entry", violations)) return;
        requireString(
          entry.node,
          `${path}.node`,
          "forge entry node",
          violations,
        );
        validateForgeModelShape(entry.model, `${path}.model`, violations);
      });
  }
  return violations;
};

const validateForgeModelShape = (
  model: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(model, path, "forge model", violations)) return;
  requireString(model.id, `${path}.id`, "model id", violations);
  requireString(model.origin, `${path}.origin`, "model origin", violations);
  validateNullableString(
    model.asset,
    `${path}.asset`,
    "model asset",
    violations,
  );
  validateForgeSkeletonShape(model.skeleton, `${path}.skeleton`, violations);
  validateForgeMaterialsShape(model.materials, `${path}.materials`, violations);
  validateForgePartsShape(model.parts, `${path}.parts`, violations);
  validateNullableObject(model.body, `${path}.body`, "model body", violations);
  if (isRecord(model.body)) {
    validateNullableObject(
      model.body.centerOfMass,
      `${path}.body.centerOfMass`,
      "model body center of mass",
      violations,
    );
  }
  validateForgeAffordancesShape(
    model.affordances,
    `${path}.affordances`,
    violations,
  );
};

const validateNullableString = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (value === null || value === undefined) return;
  requireString(value, path, label, violations);
};

const validateForgeSkeletonShape = (
  skeleton: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (skeleton === null) return;
  if (!isJsonObject(skeleton, path, "model skeleton", violations)) return;
  requireString(skeleton.id, `${path}.id`, "skeleton id", violations);
  if (
    isJsonArray(skeleton.bones, `${path}.bones`, "skeleton bones", violations)
  )
    skeleton.bones.forEach((bone, index) => {
      const bonePath = `${path}.bones[${index}]`;
      if (!isJsonObject(bone, bonePath, "skeleton bone", violations)) return;
      requireString(bone.bone, `${bonePath}.bone`, "skeleton bone", violations);
      validateNullableString(
        bone.parent,
        `${bonePath}.parent`,
        "skeleton bone parent",
        violations,
      );
      validateTransformObject(
        bone.rest,
        `${bonePath}.rest`,
        "skeleton bone rest transform",
        violations,
      );
      validateConstraintObject(
        bone.constraint,
        `${bonePath}.constraint`,
        violations,
      );
    });
};

const validateConstraintObject = (
  constraint: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (constraint === null) return;
  if (!isJsonObject(constraint, path, "joint constraint", violations)) return;
  for (const axis of ["flexion", "abduction", "twist"] as const)
    validateNullableObject(
      constraint[axis],
      `${path}.${axis}`,
      `joint constraint ${axis}`,
      violations,
    );
};

const validateForgeMaterialsShape = (
  materials: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonArray(materials, path, "model materials", violations)) return;
  materials.forEach((material, index) => {
    const materialPath = `${path}[${index}]`;
    if (!isJsonObject(material, materialPath, "model material", violations))
      return;
    requireString(material.id, `${materialPath}.id`, "material id", violations);
    validateNullableString(
      material.baseColorTexture,
      `${materialPath}.baseColorTexture`,
      "material base color texture",
      violations,
    );
    isJsonObject(
      material.baseColor,
      `${materialPath}.baseColor`,
      "material base color",
      violations,
    );
    validateNullableObject(
      material.emissive,
      `${materialPath}.emissive`,
      "material emissive color",
      violations,
    );
  });
};

const validateForgePartsShape = (
  parts: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonArray(parts, path, "model parts", violations)) return;
  parts.forEach((part, index) => {
    const partPath = `${path}[${index}]`;
    if (!isJsonObject(part, partPath, "model part", violations)) return;
    requireString(part.id, `${partPath}.id`, "model part id", violations);
    validateNullableString(
      part.material,
      `${partPath}.material`,
      "model part material",
      violations,
    );
    validateNullableString(
      part.attachedBone,
      `${partPath}.attachedBone`,
      "model part attached bone",
      violations,
    );
    validateGeometryShape(part.geometry, `${partPath}.geometry`, violations);
    validateNullableTransform(
      part.transform,
      `${partPath}.transform`,
      "model part transform",
      violations,
    );
  });
};

const validateGeometryShape = (
  geometry: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(geometry, path, "model part geometry", violations)) return;
  if (geometry.type === "primitive")
    isJsonObject(
      geometry.shape,
      `${path}.shape`,
      "model part primitive shape",
      violations,
    );
  else if (geometry.type === "mesh")
    validateMeshShape(geometry.mesh, `${path}.mesh`, violations);
};

const validateMeshShape = (
  mesh: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(mesh, path, "model part mesh", violations)) return;
  isJsonArray(
    mesh.positions,
    `${path}.positions`,
    "mesh positions",
    violations,
  );
  for (const buffer of ["normals", "uvs", "indices"] as const) {
    const value = mesh[buffer];
    if (value !== null)
      isJsonArray(value, `${path}.${buffer}`, `mesh ${buffer}`, violations);
  }
  if (mesh.skin !== null) {
    if (!isJsonObject(mesh.skin, `${path}.skin`, "mesh skin", violations))
      return;
    for (const buffer of ["joints", "boneIndices", "weights"] as const)
      isJsonArray(
        mesh.skin[buffer],
        `${path}.skin.${buffer}`,
        `mesh skin ${buffer}`,
        violations,
      );
  }
};

const validateForgeAffordancesShape = (
  affordances: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (affordances === null || affordances === undefined) return;
  if (!isJsonArray(affordances, path, "model affordances", violations)) return;
  affordances.forEach((affordance, index) => {
    const affordancePath = `${path}[${index}]`;
    if (
      !isJsonObject(affordance, affordancePath, "model affordance", violations)
    )
      return;
    requireString(
      affordance.id,
      `${affordancePath}.id`,
      "affordance id",
      violations,
    );
    validateTransformObject(
      affordance.frame,
      `${affordancePath}.frame`,
      "affordance frame",
      violations,
    );
    if (affordance.extent !== null) {
      if (
        isJsonArray(
          affordance.extent,
          `${affordancePath}.extent`,
          "affordance extent",
          violations,
        )
      )
        affordance.extent.forEach((point, pointIndex) =>
          requireVectorObject(
            point,
            `${affordancePath}.extent[${pointIndex}]`,
            "affordance extent point",
            violations,
          ),
        );
    }
  });
};

const validateNullableTransform = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (value === null) return;
  validateTransformObject(value, path, label, violations);
};

const validateTransformObject = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(value, path, label, violations)) return;
  requireVectorObject(
    value.translation,
    `${path}.translation`,
    `${label} translation`,
    violations,
  );
  isJsonObject(
    value.rotation,
    `${path}.rotation`,
    `${label} rotation`,
    violations,
  );
  requireVectorObject(
    value.scale,
    `${path}.scale`,
    `${label} scale`,
    violations,
  );
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
  target: unknown,
  nodes: Map<string, IAutoMovieVector3>,
): boolean => resolveRuntimeSafeTargetPoint(target, nodes) !== null;

const canRunDefaultSynthesisPrecheck = (
  action: IAutoMovieActionCall,
): boolean => {
  if (action.verb === "locomote") return isRuntimeSafeActionTarget(action.to);
  if (action.verb === "lookAt") return isRuntimeSafeActionTarget(action.to);
  if (action.verb === "reach") return isRuntimeSafeActionTarget(action.to);
  if (action.verb === "react") return isRuntimeSafeActionTarget(action.from);
  if (
    action.verb === "gesture" &&
    (action.kind === "point" || action.kind === "strike")
  )
    return action.at === undefined || isRuntimeSafeActionTarget(action.at);
  return true;
};

const collectDefaultSynthesisViolations = (
  props: PerformProps,
  contexts: ReadonlyMap<string, IAutoMovieActorContext>,
  nodes: Map<string, IAutoMovieVector3>,
  synthesize: IAutoMovieActionSynthesizer,
): IAutoMovieConstraintViolation[] => {
  const actions = props.performance.revise.final ?? props.performance.draft;
  const base =
    props.performance.revise.final !== null
      ? "$input.performance.revise.final"
      : "$input.performance.draft";
  const violations: IAutoMovieConstraintViolation[] = [];
  actions.forEach((action, index) => {
    const actionPath = `${base}[${index}]`;
    if (action.verb === "launch") {
      const onHit = describeLaunchOnHitGap(action, actionPath, contexts, nodes);
      if (onHit !== null) violations.push(onHit);
      return;
    }
    if (action.verb === "frame" || action.verb === "attachTo") return;
    if (!canRunDefaultSynthesisPrecheck(action)) return;

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
  const node = targetNodeId(action.at);
  if (action.onHit === undefined || node === null || !nodes.has(node))
    return null;
  const context = contexts.get(node);
  if (context === undefined)
    return violation(
      "type",
      `${actionPath}.onHit`,
      `launch onHit for target "${node}" requires that actor's MCP context so the default performer can synthesize the generated react`,
      action.onHit,
    );
  if (context.rig === undefined)
    return violation(
      "type",
      `${actionPath}.onHit`,
      `launch onHit for target "${node}" requires a rig in that actor's MCP context so the default performer can synthesize the generated react`,
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

const remapMcpPerformedShotPaths = (
  performed: IAutoMovieMcpPerformedShot,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieMcpPerformedShot => {
  if (performed.success === true) return performed;
  return {
    success: false,
    violations: performed.violations.map((item) => ({
      ...item,
      path: remapMcpPath(item.path, replacements),
    })),
  };
};

const remapMcpStagedSetPaths = (
  staged: IAutoMovieStageOutput["staged"],
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieStageOutput["staged"] => {
  if (staged.success === true) return staged;
  return {
    success: false,
    violations: staged.violations.map((item) => ({
      ...item,
      path: remapMcpPath(item.path, replacements),
    })),
  };
};

const remapMcpBlockedBeatPaths = (
  blocked: IAutoMovieBlockOutput["blocked"],
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieBlockOutput["blocked"] => {
  if (blocked.success === true) return blocked;
  return {
    success: false,
    violations: blocked.violations.map((item) => ({
      ...item,
      path: remapMcpPath(item.path, replacements),
    })),
  };
};

const remapMcpCutPaths = (
  cut: IAutoMovieCutOutput["cut"],
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieCutOutput["cut"] => {
  if (cut.success === true) return cut;
  return {
    success: false,
    violations: cut.violations.map((item) => ({
      ...item,
      path: remapMcpPath(item.path, replacements),
    })),
  };
};

const remapMcpForgedCastPaths = (
  forged: IAutoMovieForgeOutput["forged"],
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieForgeOutput["forged"] => {
  if (forged.success === true) return forged;
  return {
    success: false,
    violations: forged.violations.map((item) => ({
      ...item,
      path: remapMcpPath(item.path, replacements),
    })),
  };
};

const remapMcpPath = (
  path: string,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): string => {
  for (const [from, to] of replacements)
    if (
      path === from ||
      path.startsWith(`${from}.`) ||
      path.startsWith(`${from}[`)
    )
      return `${to}${path.slice(from.length)}`;
  return path;
};
