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
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieConstraintViolation,
  IAutoMovieForgeApplication,
  IAutoMovieGait,
  IAutoMoviePerformanceApplication,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";

import { AutoMovieContext } from "../AutoMovieContext";
import { toEngineMotion, toEnginePropSpec, toMcpMotion } from "../convert";
import {
  IAutoMovieBlockOutput,
  IAutoMovieCutOutput,
  IAutoMovieForgeOutput,
  IAutoMovieForgePropOutput,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpMotion,
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
  script?: IAutoMovieScriptApplication.IWrite;
  staged?: IAutoMovieStagedSet.ISuccess;
  performance: IAutoMoviePerformanceApplication.IWrite;
  actors?: Record<string, IAutoMovieMcpActorContext>;
  clips?: Record<string, IAutoMovieMcpMotion>;
  blocking?: IAutoMovieBlockingApplication.IWrite;
  mounts?: IAutoMovieStagedSet.IMount[];
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
    script?: IAutoMovieScriptApplication.IWrite;
    staged?: IAutoMovieStagedSet.ISuccess;
    blocking: IAutoMovieBlockingApplication.IWrite;
    previous?: IAutoMovieBeatEndState;
  }): IAutoMovieBlockOutput {
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { blocked: { success: false, violations: requestRoot } };
    // Resident-or-explicit (#1176): script and staged travel together — the
    // explicit form is a pure transform, the resident form reads both from the
    // committed slate so a long production stops re-sending the staged scene
    // every beat. A mixed call is ambiguous about which scene the beat blocks
    // over, so it is refused rather than guessed.
    const resident = props.staged === undefined;
    if (resident !== (props.script === undefined))
      return {
        blocked: {
          success: false,
          violations: [
            violation(
              "type",
              "$input",
              "script and staged travel together: pass both (explicit) or omit both (resident)",
              {
                script: props.script !== undefined,
                staged: props.staged !== undefined,
              },
            ),
          ],
        },
      };
    let script = props.script;
    let staged = props.staged;
    let previous = props.previous;
    let scriptRoot = "$input.script";
    let stagedRoot = "$input.staged";
    if (resident) {
      const slate = this.context!.requireProject("block").writableSlate();
      const missing: IAutoMovieConstraintViolation[] = [];
      if (slate.script === null)
        missing.push(
          violation(
            "type",
            "$slate.script",
            "a script must be committed before a resident block",
            slate.script,
          ),
        );
      if (slate.scene === null)
        missing.push(
          violation(
            "type",
            "$slate.scene",
            "a scene must be committed before a resident block",
            slate.scene,
          ),
        );
      if (missing.length > 0)
        return { blocked: { success: false, violations: missing } };
      script = { type: "write", ...slate.script! };
      // blockBeat reads only the staged scene's nodes; staging-level mounts
      // are not a resident slice (the getShotEndState precedent), and block
      // never consumes them.
      staged = { success: true, scene: slate.scene!, mounts: [] };
      scriptRoot = "$slate.script";
      stagedRoot = "$slate.scene";
      // Continuity-seed: when the caller carries nothing explicitly, the
      // previous beat's committed end-state (script order) seeds the block.
      // An uncommitted predecessor seeds nothing — same as a first beat.
      if (previous === undefined && isRecord(props.blocking)) {
        const beat = props.blocking.beat;
        const index = slate.script!.beats.findIndex((b) => b.id === beat);
        if (index > 0) {
          const prevId = slate.script!.beats[index - 1]!.id;
          previous = slate.beatEnds.find((e) => e.beat === prevId);
        }
      }
    }
    const violations = validateBlockShape(
      script,
      resident ? staged!.scene : staged,
      props.blocking,
      scriptRoot,
      stagedRoot,
      resident,
    );
    if (props.previous !== undefined)
      violations.push(...validatePreviousShape(props.previous));
    if (violations.length > 0)
      return { blocked: { success: false, violations } };
    return {
      blocked: remapMcpBlockedBeatPaths(
        blockBeat(script!, staged!, props.blocking, previous),
        [
          ["$script", scriptRoot],
          [
            "$previous",
            props.previous !== undefined
              ? "$input.previous"
              : "$slate.beatEnds",
          ],
          ["$input", "$input.blocking"],
        ],
      ),
    };
  }

  public perform(props: PerformProps): IAutoMoviePerformOutput {
    const requestRoot = validatePipelineRequestRoot(props);
    if (requestRoot.length > 0)
      return { performed: { success: false, violations: requestRoot } };
    // Resident-or-explicit (#1176): same pairing rule as block. The resident
    // form reads the committed script and scene, and takes staging mounts as
    // the one explicit parameter (the getShotEndState precedent — mounts are
    // not a resident slice); an explicit staged set already carries its own.
    const resident = props.staged === undefined;
    if (resident !== (props.script === undefined))
      return {
        performed: {
          success: false,
          violations: [
            violation(
              "type",
              "$input",
              "script and staged travel together: pass both (explicit) or omit both (resident)",
              {
                script: props.script !== undefined,
                staged: props.staged !== undefined,
              },
            ),
          ],
        },
      };
    if (!resident && props.mounts !== undefined)
      return {
        performed: {
          success: false,
          violations: [
            violation(
              "type",
              "$input.mounts",
              "mounts is the resident form's parameter — an explicit staged set already carries its mounts",
              props.mounts,
            ),
          ],
        },
      };
    let script = props.script;
    let staged = props.staged;
    let actors = props.actors;
    const project = resident ? this.context!.requireProject("perform") : null;
    const slate = project === null ? null : project.writableSlate();
    if (slate !== null) {
      const missing: IAutoMovieConstraintViolation[] = [];
      if (slate.script === null)
        missing.push(
          violation(
            "type",
            "$slate.script",
            "a script must be committed before a resident perform",
            slate.script,
          ),
        );
      if (slate.scene === null)
        missing.push(
          violation(
            "type",
            "$slate.scene",
            "a scene must be committed before a resident perform",
            slate.scene,
          ),
        );
      missing.push(...validateMountsShape(props.mounts));
      // Stored actor contexts (#1176): an omitted registry reads the
      // write-through store back; an explicit registry must not case-collide
      // with a stored sibling (or another of its own nodes) — the upsert
      // rename would silently destroy the sibling's file (#1093).
      if (props.actors === undefined) {
        const stored = project!.storedActors();
        if (stored.length === 0)
          missing.push(
            violation(
              "type",
              "$slate.actors",
              "no stored actor contexts to perform with — a first resident perform passes actors explicitly (they write through as actors/<node>.json)",
              null,
            ),
          );
        else
          actors = Object.fromEntries(
            stored.map(({ node, ...context }) => [node, context]),
          );
      } else if (isRecord(props.actors)) {
        const seen = new Map<string, string>();
        for (const node of Object.keys(props.actors)) {
          const collision =
            project!.actorCaseCollision(node) ??
            seen.get(node.toLowerCase()) ??
            null;
          if (collision !== null)
            missing.push(
              violation(
                "type",
                `$input.actors.${node}`,
                `actor node "${node}" collides case-insensitively with actor "${collision}"; storing it would silently destroy "${collision}" — rename the node or erase the sibling first`,
                node,
              ),
            );
          seen.set(node.toLowerCase(), node);
        }
      }
      if (missing.length > 0)
        return { performed: { success: false, violations: missing } };
      script = { type: "write", ...slate.script! };
      staged = {
        success: true,
        scene: slate.scene!,
        mounts: props.mounts ?? [],
      };
    }
    const shapeViolations = validatePerformShape(props, resident);
    if (shapeViolations.length > 0)
      return { performed: { success: false, violations: shapeViolations } };
    // A loaded registry's faults belong to the store, not the (empty) input:
    // re-anchor them at $slate.actors so a tampered actors/<node>.json file is
    // blamed where it lives.
    const rerootActors = (
      violations: IAutoMovieConstraintViolation[],
    ): IAutoMovieConstraintViolation[] =>
      resident && props.actors === undefined
        ? violations.map((entry) => ({
            ...entry,
            path: remapMcpPath(entry.path, [
              ["$input.actors", "$slate.actors"],
            ]),
          }))
        : violations;
    if (slate !== null) {
      // Continuity-seed (#1176): an actor context that omits position/facing
      // resumes from the previous beat's committed end-state — the automated
      // form of the guide's manual "seed positions and facing from getBeatEnd".
      // Runs after the shape floor so the performance record is guaranteed.
      const seeded = seedActorOpenings(
        actors,
        props.performance,
        slate.script!,
        slate.beatEnds,
      );
      if (seeded.violations.length > 0)
        return {
          performed: {
            success: false,
            violations: rerootActors(seeded.violations),
          },
        };
      actors = seeded.actors;
    }
    const actorViolations = validateActorRegistry(actors);
    if (actorViolations.length > 0)
      return {
        performed: {
          success: false,
          violations: rerootActors(actorViolations),
        },
      };
    const contexts = new Map<string, IAutoMovieActorContext>(
      Object.entries(actors!).map(([node, context]) => [
        node,
        toActorContext(context),
      ]),
    );
    const nodes = new Map(
      staged!.scene.nodes.map((node) => [node.id, node.transform.translation]),
    );
    const synthesize = wrapEnactSynthesizer(
      makeActorSynthesizer(contexts, nodes),
      props.clips,
    );
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
      script: script!,
      staged: staged!,
      performance: props.performance,
      synthesize,
      skeleton: (node) => contexts.get(node)?.rig ?? null,
      restFrames: (node) => contexts.get(node)?.restFrames,
      gaits: (node) => contexts.get(node)?.gaits.map((gait) => gait.name),
      blocking: props.blocking,
    });
    const output = remapMcpPerformedShotPaths(toMcpPerformedShot(performed), [
      ["$input", "$input.performance"],
    ]);
    // Write-through (#1176, the forgeProp precedent): a successful resident
    // perform with an explicit registry stores each context's beat-invariant
    // half as actors/<node>.json, so later resident performs omit `actors`.
    if (slate !== null && props.actors !== undefined && output.success === true)
      // One transaction across the whole registry (#1257): a mid-write failure
      // must leave the actor store untouched and the revision unbumped, not tear
      // it actor-by-actor.
      project!.saveActors(
        Object.entries(props.actors).map(([node, context]) => ({
          node,
          skeleton: context.skeleton,
          gaits: context.gaits,
          speed: context.speed,
          eyeHeight: context.eyeHeight,
          restPose: context.restPose,
          ...(context.rig !== undefined ? { rig: context.rig } : {}),
          ...(context.restFrames !== undefined
            ? { restFrames: context.restFrames }
            : {}),
        })),
      );
    return { performed: output };
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
   *
   * **A case-variant of a stored node id is refused (#1093).** On a
   * case-insensitive filesystem `props/Door.json` and `props/door.json` are one
   * file, so the upsert rename would silently destroy the sibling's spec while
   * the exact-id guards above never fire — the prop twin of the #1011
   * beat-slice clobber. The refusal is platform-independent (a project must
   * stay portable to case-insensitive filesystems) and locates
   * `$input.spec.node`.
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
    const forged = forgeProp(toEnginePropSpec(props.spec));
    if (forged.success === false)
      return {
        forged: remapMcpForgedPropPaths(forged, [["$input", "$input.spec"]]),
      };
    const output: IAutoMovieForgePropOutput = {
      forged: { success: true, prop: props.spec },
    };
    const project = this.context?.project ?? null;
    if (project === null) return output;

    const node = props.spec.node;
    // A node id differing from a stored sibling's only by case shares its
    // slice filename on a case-insensitive filesystem: the upsert rename
    // would silently destroy the sibling's spec — and the exact-id guards
    // below would never fire (#1093, the prop twin of the #1011 beat-slice
    // clobber). Refuse before touching the directory, on every platform, so
    // a project stays portable to case-insensitive filesystems.
    const collision = project.propCaseCollision(node);
    if (collision !== null)
      return {
        ...output,
        stored: false,
        validation: toValidation([
          violation(
            "type",
            "$input.spec.node",
            `prop node "${node}" collides case-insensitively with stored prop "${collision}"; storing it would silently destroy "${collision}" — rename the node or erase the sibling first`,
            node,
          ),
        ]),
      };
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

const validateForgePropShape = (
  spec: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!isJsonObject(spec, "$input.spec", "prop spec", violations))
    return violations;
  requireString(spec.node, "$input.spec.node", "prop node", violations);
  validateForgeModelShape(spec.model, "$input.spec.model", violations);
  validateForgePropArticulationShape(
    spec.articulation,
    "$input.spec.articulation",
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
    // set is optional (#1173); when present each piece needs the string ids
    // and vector the engine's gate dereferences.
    if (
      staging.set !== undefined &&
      isJsonArray(staging.set, "$input.staging.set", "staging set", violations)
    )
      staging.set.forEach((piece, index) => {
        const path = `$input.staging.set[${index}]`;
        if (!isJsonObject(piece, path, "set placement", violations)) return;
        requireString(piece.node, `${path}.node`, "set node", violations);
        requireString(piece.model, `${path}.model`, "set model", violations);
        requireVectorObject(
          piece.position,
          `${path}.position`,
          "set position",
          violations,
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
  props: PerformProps,
  resident = false,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  // The resident form's script/scene come from the committed slate, whose
  // shapes the commit gates already enforced (#1176) — only the caller-typed
  // payloads need the structural floor here.
  if (!resident) {
    validatePerformScriptShape(props.script, "$input.script", violations);
    validatePerformStagedShape(props.staged, "$input.staged", violations);
  }
  validatePerformPerformanceShape(
    props.performance,
    "$input.performance",
    violations,
  );
  // blocking is optional on perform, but when present performShot iterates
  // its actors and reads camera.move (#1006) — the same shape block() gates.
  if (props.blocking !== undefined)
    validateBlockingShape(props.blocking, "$input.blocking", violations);
  if (props.clips !== undefined)
    validatePerformClipsShape(props.clips, "$input.clips", violations);
  return violations;
};

/**
 * The `clips` registry's structural floor (#1148, #1157): each entry must be a
 * motion object whose `skeleton` is a string and whose `keyframes` is an array
 * of well-formed keyframes. `toEngineMotion` maps over every keyframe and reads
 * `keyframe.bezier` (and the compile/sample path reads `time`/`pose`), so
 * without the per-keyframe check a `keyframes: [{}]` / `[null]` / bad-bezier
 * entry throws a `TypeError` out of the bake instead of refusing with a
 * field-located violation.
 */
const validatePerformClipsShape = (
  clips: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(clips, path, "enact clips registry", violations)) return;
  for (const [id, clip] of Object.entries(clips)) {
    const clipPath = `${path}["${id}"]`;
    if (!isJsonObject(clip, clipPath, "enact clip", violations)) continue;
    requireString(
      clip.skeleton,
      `${clipPath}.skeleton`,
      "enact clip skeleton",
      violations,
    );
    if (
      !isJsonArray(
        clip.keyframes,
        `${clipPath}.keyframes`,
        "enact clip keyframes",
        violations,
      )
    )
      continue;
    clip.keyframes.forEach((keyframe, index) => {
      const kfPath = `${clipPath}.keyframes[${index}]`;
      if (!isJsonObject(keyframe, kfPath, "enact clip keyframe", violations))
        return;
      requireFiniteNumber(
        keyframe.time,
        `${kfPath}.time`,
        "enact clip keyframe time",
        violations,
      );
      isJsonObject(
        keyframe.pose,
        `${kfPath}.pose`,
        "enact clip keyframe pose",
        violations,
      );
      // `bezier` must be null (named easing) or a full { x1, y1, x2, y2 }; an
      // undefined or non-object bezier is what makes `toEngineMotion` throw.
      if (
        keyframe.bezier !== null &&
        isJsonObject(
          keyframe.bezier,
          `${kfPath}.bezier`,
          "enact clip keyframe bezier",
          violations,
        )
      )
        for (const axis of ["x1", "y1", "x2", "y2"] as const)
          requireFiniteNumber(
            keyframe.bezier[axis],
            `${kfPath}.bezier.${axis}`,
            `enact clip keyframe bezier ${axis}`,
            violations,
          );
    });
  }
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
  if (isJsonArray(staged.mounts, `${path}.mounts`, "staged mounts", violations))
    staged.mounts.forEach((mount, index) =>
      validatePerformMountShape(mount, `${path}.mounts[${index}]`, violations),
    );
};

const validatePerformStagedNodeShape = (
  node: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(node, path, "staged scene node", violations)) return;
  requireString(node.id, `${path}.id`, "staged scene node id", violations);
  if (
    !isJsonObject(
      node.transform,
      `${path}.transform`,
      "staged scene node transform",
      violations,
    )
  )
    return;
  // The perform wrapper feeds node translations straight into target
  // resolution, aim, and launch math (#1005) — non-finite components would
  // throw in aimYawPitch or bake NaN travel, so finiteness gates here.
  requireFiniteVector(
    node.transform.translation,
    `${path}.transform.translation`,
    "staged scene node translation",
    violations,
  );
  isJsonObject(
    node.transform.rotation,
    `${path}.transform.rotation`,
    "staged scene node rotation",
    violations,
  );
  requireVectorObject(
    node.transform.scale,
    `${path}.transform.scale`,
    "staged scene node scale",
    violations,
  );
};

/** The mount fields `coupleObjects` dereferences (#1005). */
const validatePerformMountShape = (
  mount: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(mount, path, "staged mount", violations)) return;
  requireNonEmptyString(
    mount.node,
    `${path}.node`,
    "staged mount node",
    violations,
  );
  if (
    !isJsonObject(
      mount.binding,
      `${path}.binding`,
      "staged mount binding",
      violations,
    )
  )
    return;
  requireNonEmptyString(
    mount.binding.parent,
    `${path}.binding.parent`,
    "staged mount binding parent",
    violations,
  );
  requireNonEmptyString(
    mount.binding.bone,
    `${path}.binding.bone`,
    "staged mount binding bone",
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

/**
 * Structural totality gate for the resident form's staging mounts (#1176):
 * performShot walks each coupling's node and binding, so a malformed entry must
 * refuse as violations before the engine dereferences it. Referential checks
 * (the rider/parent exist, the bone is real) stay the engine's.
 */
const validateMountsShape = (
  mounts: unknown,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (mounts === undefined) return violations;
  if (!isJsonArray(mounts, "$input.mounts", "staging mounts", violations))
    return violations;
  mounts.forEach((mount, index) => {
    const path = `$input.mounts[${index}]`;
    if (!isJsonObject(mount, path, "staging mount", violations)) return;
    requireString(mount.node, `${path}.node`, "mount rider node", violations);
    if (
      !isJsonObject(
        mount.binding,
        `${path}.binding`,
        "mount binding",
        violations,
      )
    )
      return;
    requireString(
      mount.binding.parent,
      `${path}.binding.parent`,
      "mount parent node",
      violations,
    );
    requireString(
      mount.binding.bone,
      `${path}.binding.bone`,
      "mount parent bone",
      violations,
    );
  });
  return violations;
};

/**
 * Structural totality gate for the optional previous beat-end (#1176): the
 * engine's own `previous` gates read `actors[i].node` as strings, so a
 * malformed carry must be refused as violations before it would crash them.
 * Referential integrity (carried actors are staged nodes) stays the engine's.
 */
const validatePreviousShape = (
  previous: unknown,
): IAutoMovieConstraintViolation[] => {
  // Caller-gated: block only shape-checks an EXPLICIT previous (a resident
  // auto-seed comes from storage the commit gates already validated).
  const violations: IAutoMovieConstraintViolation[] = [];
  if (
    !isJsonObject(previous, "$input.previous", "previous beat-end", violations)
  )
    return violations;
  const actors = (previous as { actors?: unknown }).actors;
  if (!Array.isArray(actors)) {
    violations.push(
      violation(
        "type",
        "$input.previous.actors",
        "previous beat-end actors must be an array",
        actors,
      ),
    );
    return violations;
  }
  actors.forEach((actor, index) => {
    const path = `$input.previous.actors[${index}]`;
    if (!isJsonObject(actor, path, "previous beat-end actor", violations))
      return;
    if (typeof (actor as { node?: unknown }).node !== "string")
      violations.push(
        violation(
          "type",
          `${path}.node`,
          "previous beat-end actor node must be a string",
          (actor as { node?: unknown }).node,
        ),
      );
  });
  return violations;
};

const validateBlockShape = (
  script: unknown,
  stagedOrScene: unknown,
  blocking: unknown,
  scriptRoot = "$input.script",
  stagedRoot = "$input.staged",
  sceneDirect = false,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (isJsonObject(script, scriptRoot, "script", violations)) {
    if (
      isJsonArray(
        script.beats,
        `${scriptRoot}.beats`,
        "script beats",
        violations,
      )
    )
      script.beats.forEach((beat, index) => {
        const path = `${scriptRoot}.beats[${index}]`;
        if (!isJsonObject(beat, path, "script beat", violations)) return;
        requireString(beat.id, `${path}.id`, "beat id", violations);
      });
  }

  // Explicit calls carry a staged SET ({ scene, mounts }); the resident form
  // reads the committed scene slice directly, so the shape gate addresses it
  // without the `.scene` wrapper (#1176).
  const sceneRoot = sceneDirect ? stagedRoot : `${stagedRoot}.scene`;
  const scene = sceneDirect
    ? stagedOrScene
    : isJsonObject(stagedOrScene, stagedRoot, "staged set", violations)
      ? stagedOrScene.scene
      : undefined;
  if (
    scene !== undefined &&
    isJsonObject(scene, sceneRoot, "scene", violations)
  ) {
    const nodes = scene.nodes;
    if (isJsonArray(nodes, `${sceneRoot}.nodes`, "scene nodes", violations))
      nodes.forEach((node, index) => {
        const path = `${sceneRoot}.nodes[${index}]`;
        if (!isJsonObject(node, path, "scene node", violations)) return;
        requireString(node.id, `${path}.id`, "scene node id", violations);
      });
  }

  validateBlockingShape(blocking, "$input.blocking", violations);
  return violations;
};

/** The blocking shape both `block` and `perform` (#1006) gate. */
const validateBlockingShape = (
  blocking: unknown,
  root: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(blocking, root, "blocking", violations)) return;
  requireString(blocking.beat, `${root}.beat`, "beat id", violations);
  const actors = blocking.actors;
  if (isJsonArray(actors, `${root}.actors`, "blocking actors", violations))
    actors.forEach((actor, index) => {
      const path = `${root}.actors[${index}]`;
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
            isJsonObject(anchor, anchorPath, "actor timing anchor", violations);
          });
      }
    });

  if (isJsonObject(blocking.camera, `${root}.camera`, "camera", violations))
    validateStageTarget(blocking.camera.on, `${root}.camera.on`, violations);
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

/**
 * Continuity-seed for the resident `perform` (#1176): an actor context that
 * omits `position` or `facingDeg` inherits it from the previous beat's
 * committed end-state (script order), so a walking character resumes exactly
 * where — and facing exactly how — the last beat left it. Explicit values
 * always win. Nothing to inherit (a first beat, an uncommitted predecessor, an
 * actor the end-state never saw) is refused with the commitBeatEnd hint rather
 * than silently placed at the origin. Malformed registries and context entries
 * pass through untouched — the actor-registry gate owns those refusals.
 */
const seedActorOpenings = (
  actors: Record<string, IAutoMovieMcpActorContext> | undefined,
  performance: IAutoMoviePerformanceApplication.IWrite,
  script: { beats: { id: string }[] },
  beatEnds: readonly IAutoMovieBeatEndState[],
): {
  actors: Record<string, IAutoMovieMcpActorContext> | undefined;
  violations: IAutoMovieConstraintViolation[];
} => {
  if (!isRecord(actors)) return { actors, violations: [] };
  const index = script.beats.findIndex((b) => b.id === performance.beat);
  const previous =
    index > 0
      ? (beatEnds.find((e) => e.beat === script.beats[index - 1]!.id) ?? null)
      : null;
  const violations: IAutoMovieConstraintViolation[] = [];
  const seeded: Record<string, IAutoMovieMcpActorContext> = {};
  for (const [node, context] of Object.entries(actors)) {
    seeded[node] = context;
    if (!isRecord(context)) continue;
    const needsPosition = context.position === undefined;
    const needsFacing = context.facingDeg === undefined;
    const needsPhase = context.gaitPhase === undefined;
    if (!needsPosition && !needsFacing && !needsPhase) continue;
    const state = previous?.actors.find((actor) => actor.node === node);
    if (state === undefined) {
      // A missing phase alone is never refusable — a beat with nothing
      // recorded simply starts its gait cycles at zero.
      const unseedable = (field: string): void => {
        violations.push(
          violation(
            "type",
            `$input.actors.${node}.${field}`,
            `actor ${node} has no committed previous beat end to seed ${field} from — commit the predecessor's end (commitBeatEnd) or pass it explicitly`,
            undefined,
          ),
        );
      };
      if (needsPosition) unseedable("position");
      if (needsFacing) unseedable("facingDeg");
      continue;
    }
    seeded[node] = {
      ...context,
      position: needsPosition
        ? { ...state.transform.translation }
        : context.position,
      facingDeg: needsFacing
        ? Math.atan2(state.facing.x, state.facing.z) * (180 / Math.PI)
        : context.facingDeg,
      // The end-state's null marks a non-looping close — nothing to resume, so
      // the omission stays an omission and the cycle starts at zero.
      ...(needsPhase && state.gaitPhase !== null
        ? { gaitPhase: state.gaitPhase }
        : {}),
    };
  }
  return { actors: seeded, violations };
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
    if (!Array.isArray(context.gaits)) {
      violations.push(
        violation(
          "type",
          `${path}.gaits`,
          "actor context gaits must be an array",
          context.gaits,
        ),
      );
      return;
    }
    const seenGaitNames = new Set<string>();
    context.gaits.forEach((gait, index) =>
      validateActorGaitEntry(
        gait,
        `${path}.gaits[${index}]`,
        seenGaitNames,
        violations,
      ),
    );
    validateActorContextFields(context, path, violations);
  });
  return violations;
};

/**
 * The non-gait actor-context fields the default synthesizer and camera framing
 * dereference (#998): `speed` feeds `locomoteMotion`'s throwing guard,
 * `position`/`facingDeg`/`eyeHeight` feed `aimYawPitch`/IK, and `restFrames`
 * feeds `decomposeJointRotation` — all raw throws without this gate.
 */
const validateActorContextFields = (
  context: Record<string, unknown>,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  requireNonEmptyString(
    context.skeleton,
    `${path}.skeleton`,
    "actor context skeleton",
    violations,
  );
  requireFiniteVector(
    context.position,
    `${path}.position`,
    "actor context position",
    violations,
  );
  const speed = requireFiniteNumber(
    context.speed,
    `${path}.speed`,
    "actor context speed",
    violations,
  );
  if (speed !== null && speed <= 0)
    violations.push(
      violation(
        "range",
        `${path}.speed`,
        `actor context speed must be > 0, but was ${speed}`,
        speed,
      ),
    );
  requireFiniteNumber(
    context.facingDeg,
    `${path}.facingDeg`,
    "actor context facingDeg",
    violations,
  );
  // gaitPhase is an optional per-beat opening (#1176): absent or null starts
  // the cycle at zero; anything else must be a finite number of seconds.
  if (context.gaitPhase !== undefined && context.gaitPhase !== null)
    requireFiniteNumber(
      context.gaitPhase,
      `${path}.gaitPhase`,
      "actor context gaitPhase",
      violations,
    );
  requireFiniteNumber(
    context.eyeHeight,
    `${path}.eyeHeight`,
    "actor context eyeHeight",
    violations,
  );
  isJsonObject(
    context.restPose,
    `${path}.restPose`,
    "actor context rest pose",
    violations,
  );
  if (context.restFrames !== undefined)
    validateActorRestFrames(
      context.restFrames,
      `${path}.restFrames`,
      violations,
    );
  if (context.rig !== undefined)
    validateActorRig(context.rig, `${path}.rig`, violations);
};

/**
 * The rig graph checks `computeRestHeight` and FK would otherwise throw on
 * (#999): duplicate bone rows, parents naming absent bones, root count, and
 * parent cycles. Typia accepts all of these — bone names are a closed union,
 * but graph relations are not.
 */
const validateActorRig = (
  rig: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(rig, path, "actor rig", violations)) return;
  requireNonEmptyString(rig.id, `${path}.id`, "actor rig id", violations);
  if (!isJsonArray(rig.bones, `${path}.bones`, "actor rig bones", violations))
    return;
  const before = violations.length;
  const entries: { bone: string; parent: string | null; index: number }[] = [];
  const seen = new Set<string>();
  rig.bones.forEach((bone, index) => {
    const bonePath = `${path}.bones[${index}]`;
    if (!isJsonObject(bone, bonePath, "actor rig bone", violations)) return;
    requireNonEmptyString(
      bone.bone,
      `${bonePath}.bone`,
      "actor rig bone name",
      violations,
    );
    validateTransformObject(
      bone.rest,
      `${bonePath}.rest`,
      "actor rig bone rest",
      violations,
    );
    if (typeof bone.bone !== "string") return;
    if (seen.has(bone.bone))
      violations.push(
        violation(
          "type",
          `${bonePath}.bone`,
          `actor rig bone "${bone.bone}" must be unique`,
          bone.bone,
        ),
      );
    seen.add(bone.bone);
    if (bone.parent !== null && typeof bone.parent !== "string") {
      violations.push(
        violation(
          "type",
          `${bonePath}.parent`,
          "actor rig bone parent must be null or a bone name",
          bone.parent,
        ),
      );
      return;
    }
    entries.push({ bone: bone.bone, parent: bone.parent, index });
  });
  // Graph analysis is only meaningful over structurally clean, unique rows.
  if (violations.length > before) return;
  // Zero roots is a guaranteed cycle; N>1 roots is a rig the ENGINE accepts
  // (resolvePose walks every null-parent root), so the boundary must not be
  // stricter than what it protects (#1063).
  const roots = entries.filter((entry) => entry.parent === null);
  if (roots.length === 0) {
    violations.push(
      violation(
        "type",
        `${path}.bones`,
        "actor rig needs at least one root bone (parent: null), but found none",
        entries.map((entry) => entry.bone),
      ),
    );
    return;
  }
  const names = new Set(entries.map((entry) => entry.bone));
  for (const entry of entries)
    if (entry.parent !== null && !names.has(entry.parent))
      violations.push(
        violation(
          "type",
          `${path}.bones[${entry.index}].parent`,
          `actor rig bone parent "${entry.parent}" names a missing bone`,
          entry.parent,
        ),
      );
  if (violations.length > before) return;
  const children = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.parent === null) continue;
    const list = children.get(entry.parent);
    if (list === undefined) children.set(entry.parent, [entry.bone]);
    else list.push(entry.bone);
  }
  const reached = new Set<string>(roots.map((root) => root.bone));
  const queue = roots.map((root) => root.bone);
  while (queue.length > 0) {
    const bone = queue.pop()!;
    for (const child of children.get(bone) ?? [])
      if (!reached.has(child)) {
        reached.add(child);
        queue.push(child);
      }
  }
  for (const entry of entries)
    if (!reached.has(entry.bone))
      violations.push(
        violation(
          "type",
          `${path}.bones[${entry.index}]`,
          `actor rig bone "${entry.bone}" is not reachable from a root (a parent cycle)`,
          entry.bone,
        ),
      );
};

const REST_FRAME_AXES = ["flexion", "abduction", "twist"] as const;

const validateActorRestFrames = (
  restFrames: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(restFrames, path, "actor rest frames", violations)) return;
  Object.entries(restFrames).forEach(([bone, frame]) => {
    const bonePath = `${path}.${bone}`;
    if (!isJsonObject(frame, bonePath, "actor rest frame", violations)) return;
    for (const axis of REST_FRAME_AXES) {
      const axisFrame = frame[axis];
      if (axisFrame === undefined) continue;
      const axisPath = `${bonePath}.${axis}`;
      if (
        !isJsonObject(axisFrame, axisPath, "actor rest frame axis", violations)
      )
        continue;
      if (axisFrame.sign !== 1 && axisFrame.sign !== -1)
        violations.push(
          violation(
            "type",
            `${axisPath}.sign`,
            "actor rest frame sign must be 1 or -1",
            axisFrame.sign,
          ),
        );
      requireFiniteNumber(
        axisFrame.neutral,
        `${axisPath}.neutral`,
        "actor rest frame neutral",
        violations,
      );
    }
  });
};

const requireFiniteVector = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(value, path, label, violations)) return;
  for (const axis of ["x", "y", "z"] as const)
    requireFiniteNumber(
      value[axis],
      `${path}.${axis}`,
      `${label} ${axis}`,
      violations,
    );
};

const GAIT_LIMB_AXES = new Set<string>(["flexion", "abduction", "twist"]);

const GAIT_EASING_NAMES = new Set<string>([
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "step",
  "cubicBezier",
]);

const requireNonEmptyString = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (typeof value === "string" && value.trim().length > 0) return;
  violations.push(
    violation("type", path, `${label} must be a non-empty string`, value),
  );
};

const requireFiniteNumber = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  violations.push(
    violation("type", path, `${label} must be a finite number`, value),
  );
  return null;
};

const validateActorGaitEntry = (
  gait: unknown,
  path: string,
  seenNames: Set<string>,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(gait, path, "actor gait", violations)) return;
  requireNonEmptyString(
    gait.name,
    `${path}.name`,
    "actor gait name",
    violations,
  );
  if (typeof gait.name === "string") {
    if (seenNames.has(gait.name))
      violations.push(
        violation(
          "type",
          `${path}.name`,
          `actor gait name "${gait.name}" must be unique`,
          gait.name,
        ),
      );
    seenNames.add(gait.name);
  }
  const period = requireFiniteNumber(
    gait.period,
    `${path}.period`,
    "actor gait period",
    violations,
  );
  if (period !== null && period <= 0)
    violations.push(
      violation(
        "range",
        `${path}.period`,
        `actor gait period must be > 0, but was ${period}`,
        period,
      ),
    );
  if (gait.rootBob !== undefined)
    validateActorGaitRootBob(gait.rootBob, `${path}.rootBob`, violations);
  if (
    isJsonArray(gait.limbs, `${path}.limbs`, "actor gait limbs", violations)
  ) {
    const seenRows = new Set<string>();
    gait.limbs.forEach((limb, index) =>
      validateActorGaitLimb(
        limb,
        `${path}.limbs[${index}]`,
        seenRows,
        violations,
      ),
    );
  }
};

const validateActorGaitRootBob = (
  rootBob: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(rootBob, path, "actor gait root bob", violations)) return;
  requireFiniteNumber(
    rootBob.amplitude,
    `${path}.amplitude`,
    "actor gait root bob amplitude",
    violations,
  );
  requireFiniteNumber(
    rootBob.phase,
    `${path}.phase`,
    "actor gait root bob phase",
    violations,
  );
  requireFiniteNumber(
    rootBob.center,
    `${path}.center`,
    "actor gait root bob center",
    violations,
  );
};

const validateActorGaitLimb = (
  limb: unknown,
  path: string,
  seenRows: Set<string>,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isJsonObject(limb, path, "actor gait limb", violations)) return;
  requireNonEmptyString(
    limb.bone,
    `${path}.bone`,
    "actor gait limb bone",
    violations,
  );
  if (
    limb.axis !== undefined &&
    (typeof limb.axis !== "string" || !GAIT_LIMB_AXES.has(limb.axis))
  )
    violations.push(
      violation(
        "type",
        `${path}.axis`,
        'actor gait limb axis must be "flexion", "abduction", or "twist"',
        limb.axis,
      ),
    );
  if (
    typeof limb.bone === "string" &&
    (limb.axis === undefined ||
      (typeof limb.axis === "string" && GAIT_LIMB_AXES.has(limb.axis)))
  ) {
    const axis = typeof limb.axis === "string" ? limb.axis : "flexion";
    const row = `${limb.bone}:${axis}`;
    if (seenRows.has(row))
      violations.push(
        violation(
          "type",
          path,
          `duplicate actor gait limb row for ${limb.bone}.${axis}`,
          limb,
        ),
      );
    seenRows.add(row);
  }
  requireFiniteNumber(
    limb.phase,
    `${path}.phase`,
    "actor gait limb phase",
    violations,
  );
  const duty = requireFiniteNumber(
    limb.duty,
    `${path}.duty`,
    "actor gait limb duty",
    violations,
  );
  if (duty !== null && !(duty > 0 && duty < 1))
    violations.push(
      violation(
        "range",
        `${path}.duty`,
        `actor gait limb duty must be within (0, 1), but was ${duty}`,
        duty,
      ),
    );
  requireFiniteNumber(
    limb.amplitude,
    `${path}.amplitude`,
    "actor gait limb amplitude",
    violations,
  );
  if (limb.neutral !== undefined)
    requireFiniteNumber(
      limb.neutral,
      `${path}.neutral`,
      "actor gait limb neutral",
      violations,
    );
  for (const key of ["stanceEasing", "swingEasing"] as const) {
    const easing = limb[key];
    if (easing === undefined) continue;
    if (typeof easing !== "string" || !GAIT_EASING_NAMES.has(easing))
      violations.push(
        violation(
          "type",
          `${path}.${key}`,
          `actor gait limb ${key} must be a named easing curve`,
          easing,
        ),
      );
  }
};

const toActorContext = (
  context: IAutoMovieMcpActorContext,
): IAutoMovieActorContext => ({
  ...context,
  // The registry gate (and, residently, the continuity seed before it)
  // guarantees these are present and finite by the time contexts build.
  position: context.position!,
  facingDeg: context.facingDeg!,
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
  // A string actor points at `.actor`; an array points at `.actor[i]`. `actor`
  // always comes from actorList(action), a string-filtered SUBSET of this same
  // array, so it is a member and `indexOf` (deliberately on the ORIGINAL array,
  // so the path indexes the authored JSON) never returns -1. The `string` guard
  // narrows the array case, so no `Array.isArray` re-check is needed.
  if (typeof action.actor === "string") return `${actionPath}.actor`;
  return `${actionPath}.actor[${action.actor.indexOf(actor)}]`;
};

const targetResolves = (
  target: unknown,
  nodes: Map<string, IAutoMovieVector3>,
): boolean => resolveRuntimeSafeTargetPoint(target, nodes) !== null;

/**
 * Whether an action's duration can safely reach a throwing engine constructor
 * (`holdMotion`/`reactMotion`). A malformed duration skips the precheck so
 * `performShot`'s input scan reports the field-located range violation.
 */
const isRuntimeSafeDuration = (
  duration: unknown,
  allowAuto: boolean,
): boolean =>
  (allowAuto && duration === "auto") ||
  (typeof duration === "number" && Number.isFinite(duration) && duration > 0);

const canRunDefaultSynthesisPrecheck = (
  action: IAutoMovieActionCall,
): boolean => {
  if (action.verb === "locomote") return isRuntimeSafeActionTarget(action.to);
  if (action.verb === "lookAt") return isRuntimeSafeActionTarget(action.to);
  if (action.verb === "reach") return isRuntimeSafeActionTarget(action.to);
  if (action.verb === "hold")
    return isRuntimeSafeDuration(action.duration, false);
  if (action.verb === "react")
    return (
      isRuntimeSafeDuration(action.duration, true) &&
      typeof action.force === "number" &&
      Number.isFinite(action.force) &&
      isRuntimeSafeActionTarget(action.from)
    );
  if (
    action.verb === "gesture" &&
    (action.kind === "point" || action.kind === "strike")
  )
    return action.at === undefined || isRuntimeSafeActionTarget(action.at);
  return true;
};

/**
 * Resolve `enact` actions from the caller-authored `clips` registry (#1148) —
 * the MCP face of the engine's content seam. The clip is re-keyed per actor so
 * a unison cast enacting one clip cannot collide on ids; every other verb falls
 * through to the default synthesizer. Unknown ids return `null`, which the
 * enact refusal rungs turn into an actionable message before the shot
 * compiles.
 */
const wrapEnactSynthesizer = (
  base: IAutoMovieActionSynthesizer,
  clips: Record<string, IAutoMovieMcpMotion> | undefined,
): IAutoMovieActionSynthesizer => {
  return (action, actor) => {
    if (action.verb !== "enact") return base(action, actor);
    const clip = clips?.[action.clip];
    /* c8 ignore next -- describeEnactGap refuses an unsupplied clip id before performShot runs, so by the time this synthesizer bakes an enact the clip is always present. */
    if (clip === undefined) return null;
    return { ...toEngineMotion(clip), id: `${actor}:enact:${clip.id}` };
  };
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
    if (action.verb === "enact") {
      for (const actor of actorList(action)) {
        const gap = describeEnactGap(
          action,
          actionPath,
          actor,
          contexts,
          props.clips,
        );
        if (gap !== null) violations.push(gap);
      }
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

/**
 * The enact refusal rungs (#1148), most-actionable first: the actor needs a
 * context, the context needs a rig (a rig-less clip would dodge the shot's ROM
 * gate — enforcement is the point), the clip must be supplied in the `clips`
 * registry, and the clip must target the actor's own skeleton.
 */
const describeEnactGap = (
  action: IAutoMovieActionCall & { verb: "enact" },
  actionPath: string,
  actor: string,
  contexts: ReadonlyMap<string, IAutoMovieActorContext>,
  clips: Record<string, IAutoMovieMcpMotion> | undefined,
): IAutoMovieConstraintViolation | null => {
  const context = contexts.get(actor);
  if (context === undefined)
    return violation(
      "type",
      actorPath(action, actionPath, actor),
      `actor "${actor}" needs an MCP actor context before the performer can enact a clip for it`,
      actor,
    );
  if (context.rig === undefined)
    return violation(
      "type",
      actorPath(action, actionPath, actor),
      `enact for actor "${actor}" requires a rig in that actor's MCP context so the compiled clip is ROM-gated`,
      actor,
    );
  const clip = clips?.[action.clip];
  if (clip === undefined)
    return violation(
      "type",
      `${actionPath}.clip`,
      `enact names clip "${action.clip}" but the perform call's clips registry does not supply it; pass the authored motion in props.clips`,
      action.clip,
    );
  if (clip.skeleton !== context.rig.id)
    return violation(
      "type",
      `${actionPath}.clip`,
      `enact clip "${action.clip}" targets skeleton "${clip.skeleton}" but actor "${actor}" rigs skeleton "${context.rig.id}"`,
      clip.skeleton,
    );
  return null;
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
    /* c8 ignore start -- the lookAt synthesiser always produces a clip once its target resolves (aimYawPitch cannot fail), and this describer only runs when synthesis returned null, so targetResolves() is never true here. */
    return targetResolves(action.to, nodes)
      ? violation(
          "type",
          `${actionPath}.to`,
          `the default performer could not synthesize lookAt for actor "${actor}"`,
          action.to,
        )
      : /* c8 ignore stop */ null;
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
    /* c8 ignore start -- every non-point/strike gesture in DEFAULT_GESTURES has a gestureMotion shape, so its synthesis never returns null; this could-not-synthesize arm for those kinds is unreachable. */
    return violation(
      "type",
      `${actionPath}.kind`,
      `the default performer could not synthesize gesture "${action.kind}" for actor "${actor}"`,
      action.kind,
    );
  }
  /* c8 ignore stop */
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
  /* c8 ignore start -- describeDefaultSynthesisGap only runs when synthesis returned null, which for the verbs reaching this fall-through (hold, emote, react-with-rig) never happens; the non-react/rigged fall-through is unreachable. */
  return violation(
    "type",
    actionPath,
    `the MCP default performer could not synthesize ${action.verb} for actor "${actor}"`,
    action,
  );
};
/* c8 ignore stop */

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

const remapMcpForgedPropPaths = (
  forged: Extract<IAutoMovieForgePropOutput["forged"], { success: false }>,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): Extract<IAutoMovieForgePropOutput["forged"], { success: false }> => ({
  success: false,
  violations: forged.violations.map((item) => ({
    ...item,
    path: remapMcpPath(item.path, replacements),
  })),
});

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
