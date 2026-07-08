import {
  locateOnBeat,
  toValidation,
  validateScriptTree,
} from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieConstraintViolation,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieShotPerformance,
  IAutoMovieValidation,
} from "@automovie/interface";

import { AutoMovieContext } from "../AutoMovieContext";
import { toEngineTransform } from "../convert";
import {
  IAutoMovieCommitOutput,
  IAutoMovieEraseOutput,
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
  IAutoMovieMcpTransform,
  IAutoMovieMcpWritableSlate,
  IAutoMoviePropEraseOutput,
  IAutoMovieRegisterAssetOutput,
  IAutoMovieSetOutput,
} from "../dto";
import {
  AutoMoviePrerequisiteTool,
  assertPrerequisites,
} from "../project/AutoMoviePrerequisite";
import { checkAssetPath } from "../project/AutoMovieProject";
import { beatOf, shotIdOf } from "../project/shotKey";
import {
  validateSceneArtifact,
  validateSequenceArtifact,
  validateShotArtifact,
} from "../validators/artifacts";
import {
  appendValidation,
  pushViolation,
  validateNonEmptyId,
  validateNonEmptyText,
  validateRange,
  validateTransformArtifact,
  validateUniqueBy,
  validateUniqueIds,
  validateVectorArtifact,
} from "../validators/primitives";

/**
 * The `commit*` tools — pure slate transforms gated by artifact validation and
 * pipeline preconditions, where an upstream replacement clears every stale
 * downstream slice — together with the resident-only project mutations built on
 * the same refusal ledger: targeted `erase*`/`set*` (#617/#654) and manifest
 * asset registration (#670). The MCP contract lives on the
 * {@link AutoMovieApplication} facade; this service owns the execution.
 */
export class CommitService {
  public constructor(private readonly context?: AutoMovieContext) {}

  /**
   * The slate a commit transforms: the explicit one when given (the tool stays
   * a pure transform), else the resident project's slate (#614). Resident-based
   * successful commits write through — the project files mirror the returned
   * slate, including the invalidation cascade (cleared slices disappear).
   *
   * The resident path is additionally gated by the film-ladder prerequisites
   * (#615): an out-of-order resident commit throws the actionable "do this
   * next" prompt before any transform runs. An explicit slate bypasses the gate
   * — it is a pure transform whose cross-slice preconditions already surface as
   * violations.
   */
  private base(
    slate: IAutoMovieMcpWritableSlate | undefined,
    caller: AutoMoviePrerequisiteTool,
  ): { slate: IAutoMovieMcpWritableSlate; resident: boolean } {
    if (slate !== undefined) return { slate, resident: false };
    const project = this.context!.requireProject(caller);
    assertPrerequisites(caller, project);
    return { slate: project.writableSlate(), resident: true };
  }

  private finish(
    output: IAutoMovieCommitOutput,
    resident: boolean,
  ): IAutoMovieCommitOutput {
    if (resident && output.committed) {
      const project = this.context!.requireProject("commit");
      project.saveSlate(output.slate);
      // Return the per-beat arrays in the stored filename order the next
      // resident read produces, not the upsert's append order — so a caller
      // that caches this output.slate and diffs it (or re-submits it as an
      // explicit slate) sees no reordering against a later read (#716).
      return { ...output, slate: project.orderResidentSlate(output.slate) };
    }
    return output;
  }

  public commitScript(props: {
    slate?: IAutoMovieMcpWritableSlate;
    script: IAutoMovieScript;
  }): IAutoMovieCommitOutput {
    const { slate, resident } = this.base(props.slate, "commitScript");
    const validation = validateScriptArtifact(props.script);
    if (validation.success === false)
      return this.finish(failedCommit(slate, validation), resident);
    return this.finish(
      successfulCommit({
        ...slate,
        script: props.script,
        scene: null,
        shots: [],
        beatEnds: [],
        notes: [],
        film: null,
      }),
      resident,
    );
  }

  public commitScene(props: {
    slate?: IAutoMovieMcpWritableSlate;
    scene: IAutoMovieScene;
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieCommitOutput {
    const { slate, resident } = this.base(props.slate, "commitScene");
    const violations: IAutoMovieConstraintViolation[] = [];
    appendValidation(
      violations,
      validateSceneArtifact(props.scene, props.models),
    );
    if (slate.script === null)
      pushViolation(
        violations,
        "type",
        "$slate.script",
        "a script must be committed before a scene",
        slate.script,
      );
    else validateSceneAgainstScript(props.scene, slate.script, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return this.finish(failedCommit(slate, validation), resident);
    return this.finish(
      successfulCommit({
        ...slate,
        scene: props.scene,
        shots: [],
        beatEnds: [],
        notes: [],
        film: null,
      }),
      resident,
    );
  }

  /**
   * The **upsert rule** (#617, the AutoBe granularity doctrine): `commitShot`
   * and `commitBeatEnd` replace by their beat key — re-committing the same
   * beat's artifact swaps exactly that slice (and, resident, exactly that
   * file), leaving sibling beats untouched. One beat is the stable correction
   * target; there is no whole-set re-send.
   *
   * **Motions are not a persisted slice (D012, the AutoBe generated-output
   * doctrine).** A shot's `performances[].motion` are id references into the
   * `motions` a `perform` produced, and those clips are the densest, purely
   * _derived_ artifact — deterministically re-`perform`able from the resident
   * script/scene/shot, so persisting them would only bloat the project (the
   * memory is the AST, not its regenerable output). But a resident commit that
   * kept no registry could silently store a **dangling** motion reference,
   * unresolvable on a later re-open. So a resident `commitShot` whose shot
   * references any motion MUST pass the `motions` registry those references
   * resolve against; without it the commit is refused, not silently accepted.
   * An explicit-slate call stays a pure transform — its cross-slice references
   * are the caller's to guarantee — so it is byte-compatible with before.
   */
  public commitShot(props: {
    slate?: IAutoMovieMcpWritableSlate;
    shot: IAutoMovieShot;
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieCommitOutput {
    const { slate, resident } = this.base(props.slate, "commitShot");
    const violations: IAutoMovieConstraintViolation[] = [];
    validateUniqueIds(
      slate.shots,
      "$slate.shots",
      "committed shot id",
      violations,
    );
    const beat = validateShotCommitPreconditions(props.shot, slate, violations);
    if (
      resident &&
      props.motions === undefined &&
      props.shot.performances.some((performance) => performance.motion !== null)
    )
      pushViolation(
        violations,
        "type",
        "$input.motions",
        "a resident commitShot whose shot references motions must pass the motions registry those references resolve against (motions are re-perform-derived, not persisted, so a reference with no registry would be a dangling id)",
        props.motions,
      );
    if (slate.scene !== null)
      appendValidation(
        violations,
        validateShotArtifact(props.shot, slate.scene, props.motions),
      );
    // Locate this beat's feedback on the screenplay refinement graph (D013):
    // when the script carries a tree, every violation of this commit gains the
    // claiming beat node, so scriptAncestors can cascade it up to the scene,
    // the act, or the intent.
    const located =
      beat === null
        ? violations
        : locateOnBeat(violations, slate.script?.tree ?? null, beat);
    const validation = toValidation(located);
    if (validation.success === false)
      return this.finish(failedCommit(slate, validation), resident);
    return this.finish(
      successfulCommit({
        ...slate,
        shots: upsertById(slate.shots, props.shot),
        beatEnds: slate.beatEnds.filter((end) => end.beat !== beat),
        film: null,
      }),
      resident,
    );
  }

  public commitBeatEnd(props: {
    slate?: IAutoMovieMcpWritableSlate;
    beatEnd: IAutoMovieBeatEndState;
  }): IAutoMovieCommitOutput {
    const { slate, resident } = this.base(props.slate, "commitBeatEnd");
    const violations: IAutoMovieConstraintViolation[] = [];
    validateUniqueBy(
      slate.beatEnds.map((end, index) => ({
        id: end.beat,
        path: `$slate.beatEnds[${index}].beat`,
      })),
      "committed beat end",
      violations,
    );
    validateBeatEndArtifact(props.beatEnd, slate, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return this.finish(failedCommit(slate, validation), resident);
    return this.finish(
      successfulCommit({
        ...slate,
        beatEnds: upsertBy(
          slate.beatEnds,
          props.beatEnd,
          (end) => end.beat === props.beatEnd.beat,
        ),
        film: null,
      }),
      resident,
    );
  }

  public commitNotes(props: {
    slate?: IAutoMovieMcpWritableSlate;
    notes: IAutoMovieReviewNote[];
  }): IAutoMovieCommitOutput {
    const { slate, resident } = this.base(props.slate, "commitNotes");
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNotesArtifact(props.notes, slate, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return this.finish(failedCommit(slate, validation), resident);
    return this.finish(
      successfulCommit({ ...slate, notes: props.notes, film: null }),
      resident,
    );
  }

  /**
   * Commit the assembled film — validated against the FULL committed shot set
   * (every script beat's shot present and sequenced, no open review notes),
   * then swapped in as the single film slice. Unlike the per-beat commits there
   * is no upsert key: the film is one artifact, and any upstream change clears
   * it.
   */
  public commitFilm(props: {
    slate?: IAutoMovieMcpWritableSlate;
    film: IAutoMovieSequence;
  }): IAutoMovieCommitOutput {
    const { slate, resident } = this.base(props.slate, "commitFilm");
    const violations: IAutoMovieConstraintViolation[] = [];
    appendValidation(
      violations,
      validateSequenceArtifact(props.film, slate.shots),
    );
    validateFilmPreconditions(props.film, slate, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return this.finish(failedCommit(slate, validation), resident);
    return this.finish(
      successfulCommit({ ...slate, film: props.film }),
      resident,
    );
  }

  /**
   * Erase ONE beat's shot from the resident project — a targeted removal of a
   * named mistake, never a reset (#617). The cascade mirrors the commit tools'
   * invalidation: the beat's beat-end and beat-scoped review notes are stale
   * without their shot and go with it, and the assembled film (built against
   * the full shot set) is cleared. Requires evidence (`reason`), and the shot
   * must exist — erasing nothing is itself a mistake, reported as a violation.
   * Upstream slices (script/scene) have no erase: re-committing upstream
   * already owns that path via the commit cascade, and a targeted erase of the
   * root would be a reset in disguise.
   */
  public eraseShot(props: {
    beat: string;
    reason: string;
  }): IAutoMovieEraseOutput {
    const project = this.context!.requireProject("eraseShot");
    const slate = project.writableSlate();
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.beat, "$input.beat", "beat id", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "erase reason",
      violations,
    );
    const shotId = shotIdOf(props.beat);
    if (
      props.beat.trim().length > 0 &&
      !slate.shots.some((shot) => shot.id === shotId)
    )
      pushViolation(
        violations,
        "type",
        "$input.beat",
        `beat "${props.beat}" has no committed shot to erase`,
        props.beat,
      );
    const validation = toValidation(violations);
    if (validation.success === false)
      return { erased: false, slate, validation };
    const next: IAutoMovieMcpWritableSlate = {
      ...slate,
      shots: slate.shots.filter((shot) => shot.id !== shotId),
      beatEnds: slate.beatEnds.filter((end) => end.beat !== props.beat),
      notes: slate.notes.filter((note) => note.beat !== props.beat),
      film: null,
    };
    project.saveSlate(next);
    return { erased: true, slate: next, validation: { success: true } };
  }

  /**
   * Erase ONE beat's review notes from the resident project. Per-beat is the
   * minimal addressable granularity — notes carry no ids; the beat is their
   * identity anchor. Evidence (`reason`) required; erasing a beat with no notes
   * is a violation. The assembled film is cleared (any notes change invalidates
   * it, mirroring `commitNotes`).
   */
  public eraseNotes(props: {
    beat: string;
    reason: string;
  }): IAutoMovieEraseOutput {
    const project = this.context!.requireProject("eraseNotes");
    const slate = project.writableSlate();
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.beat, "$input.beat", "beat id", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "erase reason",
      violations,
    );
    if (
      props.beat.trim().length > 0 &&
      !slate.notes.some((note) => note.beat === props.beat)
    )
      pushViolation(
        violations,
        "type",
        "$input.beat",
        `beat "${props.beat}" has no review notes to erase`,
        props.beat,
      );
    const validation = toValidation(violations);
    if (validation.success === false)
      return { erased: false, slate, validation };
    const next: IAutoMovieMcpWritableSlate = {
      ...slate,
      notes: slate.notes.filter((note) => note.beat !== props.beat),
      film: null,
    };
    project.saveSlate(next);
    return { erased: true, slate: next, validation: { success: true } };
  }

  /**
   * Erase ONE stored prop spec (`props/<node>.json`) from the resident project
   * (#671) — the targeted removal mirror of `forgeProp`'s write-through.
   * Evidence (`reason`) required; erasing a prop with no stored spec is a
   * violation. A prop the committed scene still places is REFUSED, not
   * cascaded: the scene is upstream of every shot, so clearing it from a spec
   * erase would be a reset in disguise — re-commit the scene without the
   * placement first, then erase the spec.
   */
  public eraseProp(props: {
    node: string;
    reason: string;
  }): IAutoMoviePropEraseOutput {
    const project = this.context!.requireProject("eraseProp");
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.node, "$input.node", "prop node", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "erase reason",
      violations,
    );
    const stored = project.storedProps().map((spec) => spec.node);
    if (props.node.trim().length > 0) {
      if (!stored.includes(props.node))
        pushViolation(
          violations,
          "type",
          "$input.node",
          `prop "${props.node}" has no stored spec to erase`,
          props.node,
        );
      const scene = project.storedSlate().scene;
      if (scene !== null && scene.nodes.some((node) => node.id === props.node))
        pushViolation(
          violations,
          "type",
          "$slate.scene",
          `prop "${props.node}" is still placed in the committed scene; re-commit the scene without it before erasing the spec`,
          props.node,
        );
    }
    const validation = toValidation(violations);
    if (validation.success === false)
      return { erased: false, props: stored, validation };
    project.removeProp(props.node);
    return {
      erased: true,
      props: stored.filter((node) => node !== props.node),
      validation: { success: true },
    };
  }

  /**
   * Replace ONE actor's performance in a beat's resident shot — the AutoBe
   * one-artifact-per-call granularity taken below the beat (#654). Sibling
   * performances and every other beat stay byte-unchanged; the beat's beat-end
   * and beat-scoped review notes are stale without the performance they sampled
   * and are removed, and the assembled film is cleared (the commit cascade's
   * spirit, scoped to one beat).
   *
   * **Replacement-only.** The node must already perform in that shot:
   * introducing a NEW performer changes the shot's dramatic content and belongs
   * to `perform` + `commitShot`, not a surgical splice. Validation mirrors
   * `commitShot`'s registry semantics — startOffset within the shot, and when a
   * `motions` registry is supplied the performance's motion must reference it;
   * full ROM/physics validation stays `perform`'s job, because this tool
   * splices artifacts that a perform already produced.
   */
  public setActorPerformance(props: {
    beat: string;
    performance: IAutoMovieShotPerformance;
    motions?: Record<string, IAutoMovieMcpMotion>;
    reason: string;
  }): IAutoMovieSetOutput {
    const project = this.context!.requireProject("setActorPerformance");
    const slate = project.writableSlate();
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.beat, "$input.beat", "beat id", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "set reason",
      violations,
    );
    validateNonEmptyId(
      props.performance.node,
      "$input.performance.node",
      "performance node",
      violations,
    );
    const shotId = shotIdOf(props.beat);
    const shot = slate.shots.find((entry) => entry.id === shotId);
    if (props.beat.trim().length > 0 && shot === undefined)
      pushViolation(
        violations,
        "type",
        "$input.beat",
        `beat "${props.beat}" has no committed shot to edit`,
        props.beat,
      );
    if (
      shot !== undefined &&
      props.performance.node.trim().length > 0 &&
      !shot.performances.some(
        (performance) => performance.node === props.performance.node,
      )
    )
      pushViolation(
        violations,
        "type",
        "$input.performance.node",
        `node "${props.performance.node}" does not perform in shot "${shotId}" — a new performer is perform + commitShot's job`,
        props.performance.node,
      );
    validateRange(
      props.performance.startOffset,
      "$input.performance.startOffset",
      0,
      shot?.duration ?? Infinity,
      "performance startOffset",
      violations,
    );
    if (props.performance.motion !== null) {
      validateNonEmptyId(
        props.performance.motion,
        "$input.performance.motion",
        "performance motion",
        violations,
      );
      if (
        props.motions !== undefined &&
        !Object.values(props.motions).some(
          (motion) => motion.id === props.performance.motion,
        )
      )
        pushViolation(
          violations,
          "type",
          "$input.performance.motion",
          `performance motion "${props.performance.motion}" must reference a supplied motion`,
          props.performance.motion,
        );
    }
    const validation = toValidation(violations);
    if (validation.success === false)
      return { updated: false, slate, validation };
    const next: IAutoMovieMcpWritableSlate = {
      ...slate,
      shots: slate.shots.map((entry) =>
        entry.id !== shotId
          ? entry
          : {
              ...entry,
              performances: entry.performances.map((performance) =>
                performance.node === props.performance.node
                  ? props.performance
                  : performance,
              ),
            },
      ),
      beatEnds: slate.beatEnds.filter((end) => end.beat !== props.beat),
      notes: slate.notes.filter((note) => note.beat !== props.beat),
      film: null,
    };
    project.saveSlate(next);
    return { updated: true, slate: next, validation: { success: true } };
  }

  /**
   * Move ONE placement in the resident scene — replace that scene node's
   * transform, leaving sibling placements byte-unchanged (#654).
   *
   * **The cascade mirrors `commitScene`, deliberately.** A placement move
   * changes the world coordinates every committed shot was performed against:
   * keeping those shots would be silently stale geometry — worse than
   * re-performing — so shots, beat-ends, and review notes clear and the film
   * nulls, exactly as a scene re-commit would. The gain over re-staging is
   * precision (one node moves, the rest of the staging is untouched), not a
   * shortcut around re-performing.
   */
  public setPlacement(props: {
    node: string;
    transform: IAutoMovieMcpTransform;
    reason: string;
  }): IAutoMovieSetOutput {
    const project = this.context!.requireProject("setPlacement");
    const slate = project.writableSlate();
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.node, "$input.node", "placement node", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "set reason",
      violations,
    );
    // The LLM authors the placement rotation as semantic Euler degrees; lower
    // it to the engine's quaternion before the artifact check runs against the
    // engine transform (#723).
    const transform = toEngineTransform(props.transform);
    validateTransformArtifact(
      transform,
      "$input.transform",
      "placement transform",
      violations,
    );
    if (slate.scene === null)
      pushViolation(
        violations,
        "type",
        "$slate.scene",
        "a scene must be committed before a placement move",
        slate.scene,
      );
    else if (
      props.node.trim().length > 0 &&
      !slate.scene.nodes.some((node) => node.id === props.node)
    )
      pushViolation(
        violations,
        "type",
        "$input.node",
        `scene has no placement "${props.node}" to move`,
        props.node,
      );
    const validation = toValidation(violations);
    if (validation.success === false)
      return { updated: false, slate, validation };
    const scene = slate.scene!;
    const next: IAutoMovieMcpWritableSlate = {
      ...slate,
      scene: {
        ...scene,
        nodes: scene.nodes.map((node) =>
          node.id !== props.node ? node : { ...node, transform },
        ),
      },
      shots: [],
      beatEnds: [],
      notes: [],
      film: null,
    };
    project.saveSlate(next);
    return { updated: true, slate: next, validation: { success: true } };
  }

  /**
   * Track ONE binary asset in the resident project's manifest (#670, completing
   * #614's asset index). The tool registers the path only: byte-writing stays
   * the host adapter's job (the render discipline — binaries never flow through
   * the server), so a registration may point at a file the adapter already
   * wrote or is about to write. Path escapes and duplicates come back as
   * violations on the same refusal ledger the erase/set tools use — the store's
   * own `registerAsset` keeps its throwing contract for programmatic hosts, and
   * this surface pre-checks so the throw stays unreachable from MCP.
   */
  public registerAsset(props: { path: string }): IAutoMovieRegisterAssetOutput {
    const project = this.context!.requireProject("registerAsset");
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyText(props.path, "$input.path", "asset path", violations);
    if (props.path.trim().length > 0) {
      const checked = checkAssetPath(props.path);
      if ("fault" in checked)
        pushViolation(
          violations,
          "type",
          "$input.path",
          checked.fault,
          props.path,
        );
      else if (project.assets.includes(checked.path))
        pushViolation(
          violations,
          "type",
          "$input.path",
          `asset "${checked.path}" is already registered; assets are never silently replaced`,
          props.path,
        );
    }
    const validation = toValidation(violations);
    if (validation.success === false)
      return {
        registered: false,
        path: null,
        assets: project.assets,
        validation,
      };
    const registered = project.registerAsset(props.path);
    return {
      registered: true,
      path: registered,
      assets: project.assets,
      validation: { success: true },
    };
  }
}

const failedCommit = (
  slate: IAutoMovieMcpWritableSlate,
  validation: IAutoMovieValidation.IFailure,
): IAutoMovieCommitOutput => ({ committed: false, slate, validation });

const successfulCommit = (
  slate: IAutoMovieMcpWritableSlate,
): IAutoMovieCommitOutput => ({
  committed: true,
  slate,
  validation: { success: true },
});

const upsertById = <T extends { id: string }>(items: T[], item: T): T[] =>
  upsertBy(items, item, (entry) => entry.id === item.id);

const upsertBy = <T>(
  items: T[],
  item: T,
  matches: (entry: T) => boolean,
): T[] => {
  let replaced = false;
  const next = items.map((entry) => {
    if (!matches(entry)) return entry;
    replaced = true;
    return item;
  });
  if (!replaced) next.push(item);
  return next;
};

const validateScriptArtifact = (
  script: IAutoMovieScript,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateNonEmptyText(script.logline, "$input.logline", "logline", violations);
  validateNonEmptyText(script.theme, "$input.theme", "theme", violations);
  validateUniqueBy(
    script.cast.map((member, index) => ({
      id: member.node,
      path: `$input.cast[${index}].node`,
    })),
    "cast node",
    violations,
  );
  validateUniqueIds(script.beats, "$input.beats", "beat id", violations);
  script.cast.forEach((member, i) => {
    const path = `$input.cast[${i}]`;
    validateNonEmptyId(member.node, `${path}.node`, "cast node", violations);
    validateNonEmptyText(
      member.character,
      `${path}.character`,
      "cast character",
      violations,
    );
    if (member.modelRef !== null)
      validateNonEmptyText(
        member.modelRef,
        `${path}.modelRef`,
        "cast modelRef",
        violations,
      );
  });
  if (script.beats.length === 0)
    pushViolation(
      violations,
      "type",
      "$input.beats",
      "script must contain at least one beat",
      script.beats,
    );
  script.beats.forEach((beat, i) => {
    const path = `$input.beats[${i}]`;
    validateNonEmptyId(beat.id, `${path}.id`, "beat id", violations);
    validateNonEmptyText(beat.name, `${path}.name`, "beat name", violations);
    validateNonEmptyText(
      beat.summary,
      `${path}.summary`,
      "beat summary",
      violations,
    );
    validateRange(
      beat.durationHint,
      `${path}.durationHint`,
      0,
      Infinity,
      "beat durationHint",
      violations,
      false,
    );
  });
  // The screenplay refinement tree (D013) validates as part of the script
  // artifact: a script with a malformed tree cannot commit. Absent tree =
  // legacy flat beats, no extra checks (byte-compatible).
  if (script.tree !== undefined && script.tree !== null) {
    const tree = validateScriptTree({
      tree: script.tree,
      beats: script.beats,
    });
    if (tree.success === false) violations.push(...tree.violations);
  }
  return toValidation(violations);
};

const validateSceneAgainstScript = (
  scene: IAutoMovieScene,
  script: IAutoMovieScript,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const nodeIds = new Set(scene.nodes.map((node) => node.id));
  script.cast.forEach((member, i) => {
    if (!nodeIds.has(member.node))
      pushViolation(
        violations,
        "type",
        "$input.nodes",
        `scene must contain cast node "${member.node}" from script cast[${i}]`,
        member.node,
      );
  });
};

const validateShotCommitPreconditions = (
  shot: IAutoMovieShot,
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): string | null => {
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before a shot",
      slate.script,
    );
  if (slate.scene === null)
    pushViolation(
      violations,
      "type",
      "$slate.scene",
      "a scene must be committed before a shot",
      slate.scene,
    );

  const beat = beatOf(shot.id);
  if (beat === null)
    pushViolation(
      violations,
      "type",
      "$input.id",
      'shot id must use the "shot:<beat>" form',
      shot.id,
    );
  else if (
    slate.script !== null &&
    !slate.script.beats.some((entry) => entry.id === beat)
  )
    pushViolation(
      violations,
      "type",
      "$input.id",
      `shot beat "${beat}" must exist in the committed script`,
      shot.id,
    );
  return beat;
};

const validateBeatEndArtifact = (
  beatEnd: IAutoMovieBeatEndState,
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateNonEmptyId(beatEnd.beat, "$input.beat", "beat id", violations);
  validateNonEmptyId(beatEnd.shot, "$input.shot", "shot id", violations);
  if (beatEnd.shot !== shotIdOf(beatEnd.beat))
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot must equal "${shotIdOf(beatEnd.beat)}"`,
      beatEnd.shot,
    );
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before a beat end",
      slate.script,
    );
  else if (!slate.script.beats.some((beat) => beat.id === beatEnd.beat))
    pushViolation(
      violations,
      "type",
      "$input.beat",
      `beat "${beatEnd.beat}" must exist in the committed script`,
      beatEnd.beat,
    );
  const shot = slate.shots.find((entry) => entry.id === beatEnd.shot);
  if (shot === undefined)
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot "${beatEnd.shot}" must be committed first`,
      beatEnd.shot,
    );
  const nodeIds =
    slate.scene === null
      ? null
      : new Set(slate.scene.nodes.map((node) => node.id));
  if (slate.scene === null)
    pushViolation(
      violations,
      "type",
      "$slate.scene",
      "a scene must be committed before a beat end",
      slate.scene,
    );
  validateUniqueBy(
    beatEnd.actors.map((actor, index) => ({
      id: actor.node,
      path: `$input.actors[${index}].node`,
    })),
    "beat-end actor",
    violations,
  );
  beatEnd.actors.forEach((actor, i) => {
    const path = `$input.actors[${i}]`;
    validateNonEmptyId(actor.node, `${path}.node`, "actor node", violations);
    if (nodeIds !== null && !nodeIds.has(actor.node))
      pushViolation(
        violations,
        "type",
        `${path}.node`,
        `beat-end actor "${actor.node}" must reference a scene node`,
        actor.node,
      );
    validateTransformArtifact(
      actor.transform,
      `${path}.transform`,
      "beat-end actor transform",
      violations,
    );
    validateVectorArtifact(
      actor.facing,
      `${path}.facing`,
      "beat-end actor facing",
      violations,
    );
    validateRange(
      actor.localTime,
      `${path}.localTime`,
      0,
      shot?.duration ?? Infinity,
      "beat-end actor localTime",
      violations,
    );
    if (
      actor.motion !== null &&
      shot !== undefined &&
      !shot.performances.some(
        (performance) => performance.motion === actor.motion,
      )
    )
      pushViolation(
        violations,
        "type",
        `${path}.motion`,
        `beat-end actor motion "${actor.motion}" must reference the committed shot`,
        actor.motion,
      );
  });
};

const validateNotesArtifact = (
  notes: IAutoMovieReviewNote[],
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before review notes",
      slate.script,
    );
  const beatIds =
    slate.script === null
      ? null
      : new Set(slate.script.beats.map((beat) => beat.id));
  const shotIds = new Set(slate.shots.map((shot) => shot.id));
  notes.forEach((note, i) => {
    const path = `$input.notes[${i}]`;
    validateNonEmptyId(note.beat, `${path}.beat`, "note beat", violations);
    validateNonEmptyText(note.issue, `${path}.issue`, "note issue", violations);
    validateNonEmptyText(
      note.suggestion,
      `${path}.suggestion`,
      "note suggestion",
      violations,
    );
    if (beatIds !== null && !beatIds.has(note.beat))
      pushViolation(
        violations,
        "type",
        `${path}.beat`,
        `review note beat "${note.beat}" must exist in the committed script`,
        note.beat,
      );
    if (!shotIds.has(shotIdOf(note.beat)))
      pushViolation(
        violations,
        "type",
        "$slate.shots",
        `review note beat "${note.beat}" must have a committed shot`,
        note.beat,
      );
  });
};

const validateFilmPreconditions = (
  film: IAutoMovieSequence,
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateUniqueIds(
    slate.shots,
    "$slate.shots",
    "committed shot id",
    violations,
  );
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before a film",
      slate.script,
    );
  if (slate.scene === null)
    pushViolation(
      violations,
      "type",
      "$slate.scene",
      "a scene must be committed before a film",
      slate.scene,
    );
  if (slate.notes.length > 0)
    pushViolation(
      violations,
      "type",
      "$slate.notes",
      "open review notes must be cleared before committing a film",
      slate.notes,
    );
  const sequenceShotIds = new Set(film.shots.map((entry) => entry.shot));
  if (slate.script !== null)
    slate.script.beats.forEach((beat, i) => {
      const shot = shotIdOf(beat.id);
      if (!slate.shots.some((entry) => entry.id === shot))
        pushViolation(
          violations,
          "type",
          "$slate.shots",
          `script beat "${beat.id}" must have a committed shot`,
          beat.id,
        );
      if (!sequenceShotIds.has(shot))
        pushViolation(
          violations,
          "type",
          "$input.shots",
          `sequence must include shot "${shot}" for script beat[${i}]`,
          shot,
        );
    });
  if (slate.scene !== null)
    slate.shots.forEach((shot, i) => {
      if (shot.scene !== slate.scene?.id)
        pushViolation(
          violations,
          "type",
          `$slate.shots[${i}].scene`,
          `committed shot scene must match scene "${slate.scene?.id}"`,
          shot.scene,
        );
    });
};
