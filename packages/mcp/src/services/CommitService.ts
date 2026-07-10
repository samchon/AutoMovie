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
  IAutoMovieTransform,
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
  isRecord,
  pushViolation,
  validateArrayArtifact,
  validateNonEmptyId,
  validateNonEmptyText,
  validateObjectArtifact,
  validateRange,
  validateTransformArtifact,
  validateUniqueBy,
  validateUniqueIds,
  validateVectorArtifact,
} from "../validators/primitives";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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
  ): {
    slate: IAutoMovieMcpWritableSlate;
    resident: boolean;
    slateRoot: string;
  } {
    if (slate !== undefined)
      return { slate, resident: false, slateRoot: "$input.slate" };
    const project = this.context!.requireProject(caller);
    assertPrerequisites(caller, project);
    return {
      slate: project.writableSlate(),
      resident: true,
      slateRoot: "$slate",
    };
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

  private rejectMalformedCommitRequestRoot(
    props: unknown,
    caller: AutoMoviePrerequisiteTool,
  ): IAutoMovieCommitOutput | null {
    const violations = validateRequestRoot(props, "commit request");
    if (violations.length === 0) return null;
    const project = this.context!.requireProject(caller);
    return failedCommit(
      project.writableSlate(),
      toValidation(violations) as IAutoMovieValidation.IFailure,
    );
  }

  public commitScript(props: {
    slate?: IAutoMovieMcpWritableSlate;
    script: IAutoMovieScript;
  }): IAutoMovieCommitOutput {
    const malformed = this.rejectMalformedCommitRequestRoot(
      props,
      "commitScript",
    );
    if (malformed !== null) return malformed;
    const { slate, resident } = this.base(props.slate, "commitScript");
    const validation = validateScriptArtifact(props.script);
    if (validation.success === false)
      return this.finish(
        failedCommit(
          slate,
          remapCommitValidationPaths(validation, [["$input", "$input.script"]]),
        ),
        resident,
      );
    const output = this.finish(
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
    if (resident && output.committed) this.context!.clearGeometryMemory();
    return output;
  }

  public commitScene(props: {
    slate?: IAutoMovieMcpWritableSlate;
    scene: IAutoMovieScene;
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieCommitOutput {
    const malformed = this.rejectMalformedCommitRequestRoot(
      props,
      "commitScene",
    );
    if (malformed !== null) return malformed;
    const { slate, resident, slateRoot } = this.base(
      props.slate,
      "commitScene",
    );
    const violations: IAutoMovieConstraintViolation[] = [];
    const sceneValidation = validateSceneArtifact(props.scene, props.models);
    appendValidation(violations, sceneValidation);
    const script = validateCommittedScript(
      slate.script,
      slateRoot,
      "a script must be committed before a scene",
      violations,
    );
    if (sceneValidation.success === true && script !== null)
      validateSceneAgainstScript(props.scene, script, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return this.finish(
        failedCommit(
          slate,
          remapCommitValidationPaths(validation, [
            ["$input.slate", "$input.slate"],
            ["$input", "$input.scene"],
            ["$models", "$input.models"],
          ]),
        ),
        resident,
      );
    const output = this.finish(
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
    if (resident && output.committed)
      this.context!.rememberGeometryModels(props.models);
    return output;
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
    const malformed = this.rejectMalformedCommitRequestRoot(
      props,
      "commitShot",
    );
    if (malformed !== null) return malformed;
    const { slate, resident, slateRoot } = this.base(props.slate, "commitShot");
    const violations: IAutoMovieConstraintViolation[] = [];
    const slateShots = validateArrayArtifact(
      slate.shots,
      `${slateRoot}.shots`,
      "committed shots",
      violations,
    )
      ? slate.shots
      : [];
    validateUniqueBy(
      slateShots.map((shot, index) => ({
        id: isRecord(shot) ? shot.id : undefined,
        path: `${slateRoot}.shots[${index}].id`,
      })),
      "committed shot id",
      violations,
    );
    slateShots.forEach((shot, index) => {
      const path = `${slateRoot}.shots[${index}]`;
      if (!validateObjectArtifact(shot, path, "committed shot", violations))
        return;
      validateNonEmptyId(
        shot.id,
        `${path}.id`,
        "committed shot id",
        violations,
      );
    });
    const preconditions = validateShotCommitPreconditions(
      props.shot,
      slate,
      slateRoot,
      violations,
    );
    const shotPerformances =
      isRecord(props.shot) && Array.isArray(props.shot.performances)
        ? props.shot.performances
        : [];
    if (
      resident &&
      props.motions === undefined &&
      shotPerformances.some(
        (performance) => isRecord(performance) && performance.motion !== null,
      )
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
      preconditions.beat === null
        ? violations
        : locateOnBeat(violations, preconditions.tree, preconditions.beat);
    const validation = toValidation(located);
    if (validation.success === false)
      return this.finish(
        failedCommit(
          slate,
          remapCommitValidationPaths(validation, [
            ["$input.slate", "$input.slate"],
            ["$motions", "$input.motions"],
            ["$input.motions", "$input.motions"],
            ["$input", "$input.shot"],
          ]),
        ),
        resident,
      );
    const output = this.finish(
      successfulCommit({
        ...slate,
        shots: upsertById(slate.shots, props.shot),
        beatEnds: slate.beatEnds.filter(
          (end) => end.beat !== preconditions.beat,
        ),
        // Replacing the WHOLE shot clears the beat's review notes like the
        // strictly smaller surgeries (setActorPerformance, eraseShot) already
        // do (#1010): the notes reviewed the shot that no longer exists.
        notes: slate.notes.filter((note) => note.beat !== preconditions.beat),
        film: null,
      }),
      resident,
    );
    if (
      resident &&
      output.committed &&
      props.motions !== undefined &&
      preconditions.beat !== null
    )
      this.context!.rememberGeometryMotions(props.motions, preconditions.beat);
    return output;
  }

  public commitBeatEnd(props: {
    slate?: IAutoMovieMcpWritableSlate;
    beatEnd: IAutoMovieBeatEndState;
  }): IAutoMovieCommitOutput {
    const malformed = this.rejectMalformedCommitRequestRoot(
      props,
      "commitBeatEnd",
    );
    if (malformed !== null) return malformed;
    const { slate, resident, slateRoot } = this.base(
      props.slate,
      "commitBeatEnd",
    );
    const violations: IAutoMovieConstraintViolation[] = [];
    const beatEnds = validateArrayArtifact(
      slate.beatEnds,
      `${slateRoot}.beatEnds`,
      "committed beat ends",
      violations,
    )
      ? slate.beatEnds
      : [];
    validateUniqueBy(
      beatEnds.map((end, index) => ({
        id: isRecord(end) ? end.beat : undefined,
        path: `${slateRoot}.beatEnds[${index}].beat`,
      })),
      "committed beat end",
      violations,
    );
    beatEnds.forEach((end, index) => {
      const path = `${slateRoot}.beatEnds[${index}]`;
      if (!validateObjectArtifact(end, path, "committed beat end", violations))
        return;
      validateNonEmptyId(
        end.beat,
        `${path}.beat`,
        "committed beat end",
        violations,
      );
    });
    validateBeatEndArtifact(props.beatEnd, slate, slateRoot, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return this.finish(
        failedCommit(
          slate,
          remapCommitValidationPaths(validation, [
            ["$input.slate", "$input.slate"],
            ["$input", "$input.beatEnd"],
          ]),
        ),
        resident,
      );
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
    const malformed = this.rejectMalformedCommitRequestRoot(
      props,
      "commitNotes",
    );
    if (malformed !== null) return malformed;
    const { slate, resident, slateRoot } = this.base(
      props.slate,
      "commitNotes",
    );
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNotesArtifact(props.notes, slate, slateRoot, violations);
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
   *
   * **The one irreversible editorial gate demands a pre-commit `review`**
   * (#1131), the same evidence discipline every erase/set carries: the cut's
   * authoring stage justifies pacing and continuity, but nothing forced the
   * agent to SELF-CHECK the final cut-list against that intent before
   * persisting it. Declared before the film payload deliberately —
   * schema-reflected tools present properties in declaration order and the
   * model fills them in that order, so a reasoning field ahead of the artifact
   * it steers is chain-of-thought by construction.
   */
  public commitFilm(props: {
    review: string;
    slate?: IAutoMovieMcpWritableSlate;
    film: IAutoMovieSequence;
  }): IAutoMovieCommitOutput {
    const malformed = this.rejectMalformedCommitRequestRoot(
      props,
      "commitFilm",
    );
    if (malformed !== null) return malformed;
    const { slate, resident, slateRoot } = this.base(props.slate, "commitFilm");
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyText(
      props.review,
      "$input.review",
      "film commit review",
      violations,
    );
    const sequenceValidation = validateSequenceArtifact(
      props.film,
      slate.shots,
    );
    appendValidation(violations, sequenceValidation);
    validateFilmPreconditions(props.film, slate, slateRoot, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return this.finish(
        failedCommit(
          slate,
          remapCommitValidationPaths(validation, [
            // identity rules first: remapPath applies the FIRST matching
            // prefix, so review/slate paths must not fall through to the
            // generic $input → $input.film rewrite below.
            ["$input.review", "$input.review"],
            ["$input.slate", "$input.slate"],
            ["$shots", `${slateRoot}.shots`],
            ["$input", "$input.film"],
          ]),
        ),
        resident,
      );
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
    const requestRoot = validateMutationRequestRoot(props);
    if (requestRoot.length > 0)
      return { erased: false, slate, validation: toValidation(requestRoot) };
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.beat, "$input.beat", "beat id", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "erase reason",
      violations,
    );
    const shotId = isNonEmptyString(props.beat) ? shotIdOf(props.beat) : "";
    if (
      isNonEmptyString(props.beat) &&
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
    const requestRoot = validateMutationRequestRoot(props);
    if (requestRoot.length > 0)
      return { erased: false, slate, validation: toValidation(requestRoot) };
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.beat, "$input.beat", "beat id", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "erase reason",
      violations,
    );
    if (
      isNonEmptyString(props.beat) &&
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
    const stored = project.storedProps().map((spec) => spec.node);
    const requestRoot = validateMutationRequestRoot(props);
    if (requestRoot.length > 0)
      return {
        erased: false,
        props: stored,
        validation: toValidation(requestRoot),
      };
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.node, "$input.node", "prop node", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "erase reason",
      violations,
    );
    if (isNonEmptyString(props.node)) {
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
   * `commitShot`'s resident registry semantics (#1095) — startOffset within the
   * shot, and a performance that references a motion MUST pass the `motions`
   * registry it resolves against (this tool is always resident, and motions are
   * re-perform-derived, not persisted: a reference with no registry would
   * durably store a dangling id). Full ROM/physics validation stays `perform`'s
   * job, because this tool splices artifacts that a perform already produced.
   */
  public setActorPerformance(props: {
    beat: string;
    performance: IAutoMovieShotPerformance;
    motions?: Record<string, IAutoMovieMcpMotion>;
    reason: string;
  }): IAutoMovieSetOutput {
    const project = this.context!.requireProject("setActorPerformance");
    const slate = project.writableSlate();
    const requestRoot = validateMutationRequestRoot(props);
    if (requestRoot.length > 0)
      return { updated: false, slate, validation: toValidation(requestRoot) };
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyId(props.beat, "$input.beat", "beat id", violations);
    validateNonEmptyText(
      props.reason,
      "$input.reason",
      "set reason",
      violations,
    );
    const hasPerformance = validateObjectArtifact(
      props.performance,
      "$input.performance",
      "performance",
      violations,
    );
    if (hasPerformance)
      validateNonEmptyId(
        props.performance.node,
        "$input.performance.node",
        "performance node",
        violations,
      );
    const motionIds = (() => {
      if (props.motions === undefined) return null;
      if (!isRecord(props.motions)) {
        pushViolation(
          violations,
          "type",
          "$input.motions",
          "motions registry must be a JSON object",
          props.motions,
        );
        return new Set<string>();
      }
      const ids = new Set<string>();
      Object.entries(props.motions).forEach(([key, motion]) => {
        const path = `$input.motions.${key}`;
        if (
          !validateObjectArtifact(
            motion,
            path,
            "motion registry entry",
            violations,
          )
        )
          return;
        validateNonEmptyId(motion.id, `${path}.id`, "motion id", violations);
        if (typeof motion.id === "string") ids.add(motion.id);
      });
      return ids;
    })();
    const shotId = isNonEmptyString(props.beat) ? shotIdOf(props.beat) : "";
    const shot =
      shotId.length === 0
        ? undefined
        : slate.shots.find((entry) => entry.id === shotId);
    if (isNonEmptyString(props.beat) && shot === undefined)
      pushViolation(
        violations,
        "type",
        "$input.beat",
        `beat "${props.beat}" has no committed shot to edit`,
        props.beat,
      );
    if (
      hasPerformance &&
      shot !== undefined &&
      isNonEmptyString(props.performance.node) &&
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
    if (hasPerformance)
      validateRange(
        props.performance.startOffset,
        "$input.performance.startOffset",
        0,
        shot?.duration ?? Infinity,
        "performance startOffset",
        violations,
      );
    if (hasPerformance && props.performance.motion !== null) {
      validateNonEmptyId(
        props.performance.motion,
        "$input.performance.motion",
        "performance motion",
        violations,
      );
      // This tool is ALWAYS resident, so commitShot's registry rule applies
      // verbatim (#1095): motions are re-perform-derived, not persisted —
      // splicing a motion reference with no registry would durably store a
      // dangling id that a later resident getResolvedPose cannot resolve.
      if (motionIds === null)
        pushViolation(
          violations,
          "type",
          "$input.motions",
          "a performance that references a motion must pass the motions registry it resolves against (motions are re-perform-derived, not persisted, so a reference with no registry would be a dangling id)",
          props.motions,
        );
      else if (
        typeof props.performance.motion === "string" &&
        !motionIds.has(props.performance.motion)
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
    if (props.motions !== undefined)
      this.context!.mergeGeometryMotions(props.motions, props.beat);
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
    const requestRoot = validateMutationRequestRoot(props);
    if (requestRoot.length > 0)
      return { updated: false, slate, validation: toValidation(requestRoot) };
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
    let transform: IAutoMovieTransform | null = null;
    try {
      transform = toEngineTransform(props.transform);
      validateTransformArtifact(
        transform,
        "$input.transform",
        "placement transform",
        violations,
      );
    } catch {
      if (!isRecord(props.transform))
        pushViolation(
          violations,
          "type",
          "$input.transform",
          "placement transform must be a JSON object",
          props.transform,
        );
      else
        pushViolation(
          violations,
          "type",
          "$input.transform.rotation",
          "placement rotation must be omitted, null, or a complete Euler rotation with x, y, z, and order",
          props.transform.rotation,
        );
    }
    if (slate.scene === null)
      pushViolation(
        violations,
        "type",
        "$slate.scene",
        "a scene must be committed before a placement move",
        slate.scene,
      );
    else if (
      isNonEmptyString(props.node) &&
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
          node.id !== props.node ? node : { ...node, transform: transform! },
        ),
      },
      shots: [],
      beatEnds: [],
      notes: [],
      film: null,
    };
    project.saveSlate(next);
    this.context!.clearGeometryMotions();
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
    const requestRoot = validateMutationRequestRoot(props);
    if (requestRoot.length > 0)
      return {
        registered: false,
        path: null,
        assets: project.assets,
        validation: toValidation(requestRoot),
      };
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNonEmptyText(props.path, "$input.path", "asset path", violations);
    if (isNonEmptyString(props.path)) {
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

const validateMutationRequestRoot = (
  props: unknown,
): IAutoMovieConstraintViolation[] => {
  return validateRequestRoot(props, "mutation request");
};

const validateRequestRoot = (
  props: unknown,
  label: string,
): IAutoMovieConstraintViolation[] => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateObjectArtifact(props, "$input", label, violations);
  return violations;
};

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

const remapCommitValidationPaths = (
  validation: IAutoMovieValidation.IFailure,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieValidation.IFailure => ({
  success: false,
  violations: validation.violations.map((item) => ({
    ...item,
    path: remapCommitPath(item.path, replacements),
  })),
});

const remapCommitPath = (
  path: string,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): string => {
  for (const [from, to] of replacements) {
    if (path === from) return to;
    if (path.startsWith(`${from}.`) || path.startsWith(`${from}[`))
      return `${to}${path.slice(from.length)}`;
  }
  return path;
};

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
  if (!validateObjectArtifact(script, "$input", "script", violations))
    return toValidation(violations);
  validateNonEmptyText(script.logline, "$input.logline", "logline", violations);
  validateNonEmptyText(script.theme, "$input.theme", "theme", violations);
  const cast = validateArrayArtifact(
    script.cast,
    "$input.cast",
    "script cast",
    violations,
  )
    ? script.cast
    : [];
  const beats = validateArrayArtifact(
    script.beats,
    "$input.beats",
    "script beats",
    violations,
  )
    ? script.beats
    : [];
  validateUniqueBy(
    cast.map((member, index) => ({
      id: isRecord(member) ? member.node : undefined,
      path: `$input.cast[${index}].node`,
    })),
    "cast node",
    violations,
  );
  validateUniqueBy(
    beats.map((beat, index) => ({
      id: isRecord(beat) ? beat.id : undefined,
      path: `$input.beats[${index}].id`,
    })),
    "beat id",
    violations,
  );
  // Beat ids become slice FILENAMES (shots/<beat>.json, beatEnds/<beat>.json),
  // so ids differing only by case collide on a case-insensitive filesystem.
  // Unrefused here, the collision surfaced as the store's raw mid-save throw
  // at the SECOND beat's commitShot — after non-keyed slices were rewritten —
  // wedging that beat while nextSteps kept prescribing it (#1096). Refuse at
  // the source with a located violation instead.
  const beatsByLower = new Map<string, { id: string; index: number }>();
  beats.forEach((beat, index) => {
    if (!isRecord(beat) || typeof beat.id !== "string") return;
    const lower = beat.id.toLowerCase();
    const prior = beatsByLower.get(lower);
    if (prior !== undefined && prior.id !== beat.id)
      pushViolation(
        violations,
        "type",
        `$input.beats[${index}].id`,
        `beat id "${beat.id}" collides case-insensitively with "${prior.id}" ($input.beats[${prior.index}].id); their per-beat slice files would clobber on a case-insensitive filesystem — rename one beat`,
        beat.id,
      );
    if (prior === undefined) beatsByLower.set(lower, { id: beat.id, index });
  });
  cast.forEach((member, i) => {
    const path = `$input.cast[${i}]`;
    if (!validateObjectArtifact(member, path, "cast member", violations))
      return;
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
  if (Array.isArray(script.beats) && beats.length === 0)
    pushViolation(
      violations,
      "type",
      "$input.beats",
      "script must contain at least one beat",
      beats,
    );
  beats.forEach((beat, i) => {
    const path = `$input.beats[${i}]`;
    if (!validateObjectArtifact(beat, path, "script beat", violations)) return;
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
    if (
      validateArrayArtifact(
        script.tree,
        "$input.tree",
        "script tree",
        violations,
      )
    ) {
      try {
        const tree = validateScriptTree({
          tree: script.tree,
          beats,
        });
        if (tree.success === false) violations.push(...tree.violations);
      } catch {
        pushViolation(
          violations,
          "type",
          "$input.tree",
          "script tree must match the screenplay refinement schema",
          script.tree,
        );
      }
    }
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

const validateCommittedScript = (
  script: IAutoMovieScript | null | unknown,
  slateRoot: string,
  missingMessage: string,
  violations: IAutoMovieConstraintViolation[],
): IAutoMovieScript | null => {
  if (script === null) {
    pushViolation(
      violations,
      "type",
      `${slateRoot}.script`,
      missingMessage,
      script,
    );
    return null;
  }
  const validation = validateScriptArtifact(script as IAutoMovieScript);
  if (validation.success === false) {
    violations.push(
      ...remapCommitValidationPaths(validation, [
        ["$input", `${slateRoot}.script`],
      ]).violations,
    );
    return null;
  }
  return script as IAutoMovieScript;
};

const validateCommittedScene = (
  scene: IAutoMovieScene | null | unknown,
  slateRoot: string,
  missingMessage: string,
  violations: IAutoMovieConstraintViolation[],
): IAutoMovieScene | null => {
  if (scene === null) {
    pushViolation(
      violations,
      "type",
      `${slateRoot}.scene`,
      missingMessage,
      scene,
    );
    return null;
  }
  if (!validateObjectArtifact(scene, `${slateRoot}.scene`, "scene", violations))
    return null;
  validateNonEmptyId(scene.id, `${slateRoot}.scene.id`, "scene id", violations);
  if (
    !validateArrayArtifact(
      scene.nodes,
      `${slateRoot}.scene.nodes`,
      "scene nodes",
      violations,
    )
  )
    return null;
  return scene as unknown as IAutoMovieScene;
};

const validateShotCommitPreconditions = (
  shot: IAutoMovieShot,
  slate: IAutoMovieMcpWritableSlate,
  slateRoot: string,
  violations: IAutoMovieConstraintViolation[],
): { beat: string | null; tree: IAutoMovieScript["tree"] | null } => {
  if (!validateObjectArtifact(shot, "$input", "shot", violations))
    return { beat: null, tree: null };
  const script = validateCommittedScript(
    slate.script,
    slateRoot,
    "a script must be committed before a shot",
    violations,
  );
  validateCommittedScene(
    slate.scene,
    slateRoot,
    "a scene must be committed before a shot",
    violations,
  );

  const beat = typeof shot.id === "string" ? beatOf(shot.id) : null;
  if (beat === null)
    pushViolation(
      violations,
      "type",
      "$input.id",
      'shot id must use the "shot:<beat>" form',
      shot.id,
    );
  else if (script !== null) {
    if (!script.beats.some((entry) => isRecord(entry) && entry.id === beat))
      pushViolation(
        violations,
        "type",
        "$input.id",
        `shot beat "${beat}" must exist in the committed script`,
        shot.id,
      );
  }
  return { beat, tree: script?.tree ?? null };
};

const validateBeatEndArtifact = (
  beatEnd: IAutoMovieBeatEndState,
  slate: IAutoMovieMcpWritableSlate,
  slateRoot: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(beatEnd, "$input", "beat end", violations))
    return;
  validateNonEmptyId(beatEnd.beat, "$input.beat", "beat id", violations);
  validateNonEmptyId(beatEnd.shot, "$input.shot", "shot id", violations);
  if (
    typeof beatEnd.beat === "string" &&
    typeof beatEnd.shot === "string" &&
    beatEnd.shot !== shotIdOf(beatEnd.beat)
  )
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot must equal "${shotIdOf(beatEnd.beat)}"`,
      beatEnd.shot,
    );
  const script = validateCommittedScript(
    slate.script,
    slateRoot,
    "a script must be committed before a beat end",
    violations,
  );
  if (script !== null) {
    if (
      typeof beatEnd.beat === "string" &&
      !script.beats.some((beat) => isRecord(beat) && beat.id === beatEnd.beat)
    )
      pushViolation(
        violations,
        "type",
        "$input.beat",
        `beat "${beatEnd.beat}" must exist in the committed script`,
        beatEnd.beat,
      );
  }
  const slateShots = validateArrayArtifact(
    slate.shots,
    `${slateRoot}.shots`,
    "committed shots",
    violations,
  )
    ? slate.shots
    : [];
  const shotIndex = slateShots.findIndex(
    (entry) => isRecord(entry) && entry.id === beatEnd.shot,
  );
  const shot = shotIndex === -1 ? undefined : slateShots[shotIndex];
  if (typeof beatEnd.shot === "string" && shot === undefined)
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot "${beatEnd.shot}" must be committed first`,
      beatEnd.shot,
    );
  let nodeIds: Set<string> | null = null;
  const scene = validateCommittedScene(
    slate.scene,
    slateRoot,
    "a scene must be committed before a beat end",
    violations,
  );
  if (scene !== null) {
    nodeIds = new Set(
      scene.nodes
        .filter(isRecord)
        .map((node) => node.id)
        .filter((id): id is string => typeof id === "string"),
    );
  }
  const actors = validateArrayArtifact(
    beatEnd.actors,
    "$input.actors",
    "beat-end actors",
    violations,
  )
    ? beatEnd.actors
    : [];
  validateUniqueBy(
    actors.map((actor, index) => ({
      id: isRecord(actor) ? actor.node : undefined,
      path: `$input.actors[${index}].node`,
    })),
    "beat-end actor",
    violations,
  );
  actors.forEach((actor, i) => {
    const path = `$input.actors[${i}]`;
    if (!validateObjectArtifact(actor, path, "beat-end actor", violations))
      return;
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
      isRecord(shot) && typeof shot.duration === "number"
        ? shot.duration
        : Infinity,
      "beat-end actor localTime",
      violations,
    );
    if (actor.motion !== null && shot !== undefined) {
      const performances =
        isRecord(shot) &&
        validateArrayArtifact(
          shot.performances,
          `${slateRoot}.shots[${shotIndex}].performances`,
          "committed shot performances",
          violations,
        )
          ? shot.performances
          : [];
      // The engine derives an actor's end motion from its performance when
      // one exists and from the scene node's AMBIENT motion otherwise
      // (resolveBeatEnd's endActorOf) — so the advertised getShotEndState →
      // commitBeatEnd round trip must accept both sources (#1094). Gating on
      // performances alone dead-ended every scene using ambient node motions.
      const ambient =
        scene !== null &&
        scene.nodes.some(
          (node) =>
            isRecord(node) &&
            node.id === actor.node &&
            node.motion === actor.motion,
        );
      if (
        !ambient &&
        !performances.some(
          (performance) =>
            isRecord(performance) && performance.motion === actor.motion,
        )
      )
        pushViolation(
          violations,
          "type",
          `${path}.motion`,
          `beat-end actor motion "${actor.motion}" must reference the committed shot's performances or the actor's scene-node motion`,
          actor.motion,
        );
    }
  });
};

const validateNotesArtifact = (
  notes: IAutoMovieReviewNote[],
  slate: IAutoMovieMcpWritableSlate,
  slateRoot: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const script = validateCommittedScript(
    slate.script,
    slateRoot,
    "a script must be committed before review notes",
    violations,
  );
  const beatIds =
    script === null
      ? null
      : new Set(
          script.beats
            .filter(isRecord)
            .map((beat) => beat.id)
            .filter((id): id is string => typeof id === "string"),
        );
  const slateShots = validateArrayArtifact(
    slate.shots,
    `${slateRoot}.shots`,
    "committed shots",
    violations,
  )
    ? slate.shots
    : [];
  const shotIds = new Set(
    slateShots
      .filter(isRecord)
      .map((shot) => shot.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const reviewNotes = validateArrayArtifact(
    notes,
    "$input.notes",
    "review notes",
    violations,
  )
    ? notes
    : [];
  reviewNotes.forEach((note, i) => {
    const path = `$input.notes[${i}]`;
    if (!validateObjectArtifact(note, path, "review note", violations)) return;
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
    if (typeof note.beat === "string" && !shotIds.has(shotIdOf(note.beat)))
      pushViolation(
        violations,
        "type",
        `${slateRoot}.shots`,
        `review note beat "${note.beat}" must have a committed shot`,
        note.beat,
      );
  });
};

const validateFilmPreconditions = (
  film: IAutoMovieSequence,
  slate: IAutoMovieMcpWritableSlate,
  slateRoot: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateUniqueIds(
    slate.shots,
    `${slateRoot}.shots`,
    "committed shot id",
    violations,
  );
  const committedShots = Array.isArray(slate.shots)
    ? slate.shots
        .map((shot, index) => ({ shot, index }))
        .filter(({ shot }) => isRecord(shot))
    : [];
  const script = validateCommittedScript(
    slate.script,
    slateRoot,
    "a script must be committed before a film",
    violations,
  );
  const scene = validateCommittedScene(
    slate.scene,
    slateRoot,
    "a scene must be committed before a film",
    violations,
  );
  const notes = validateArrayArtifact(
    slate.notes,
    `${slateRoot}.notes`,
    "committed notes",
    violations,
  )
    ? slate.notes
    : [];
  if (notes.length > 0)
    pushViolation(
      violations,
      "type",
      `${slateRoot}.notes`,
      "open review notes must be cleared before committing a film",
      notes,
    );
  if (!isRecord(film) || !Array.isArray(film.shots)) return;
  const sequenceShotIds = new Set(
    film.shots
      .filter(isRecord)
      .map((entry) => entry.shot)
      .filter((shot): shot is string => typeof shot === "string"),
  );
  if (script !== null)
    script.beats.forEach((beat, i) => {
      const shot = shotIdOf(beat.id);
      if (!committedShots.some((entry) => entry.shot.id === shot))
        pushViolation(
          violations,
          "type",
          `${slateRoot}.shots`,
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
  if (scene !== null)
    committedShots.forEach(({ shot, index }) => {
      if (shot.scene !== scene.id)
        pushViolation(
          violations,
          "type",
          `${slateRoot}.shots[${index}].scene`,
          `committed shot scene must match scene "${scene.id}"`,
          shot.scene,
        );
    });
};
