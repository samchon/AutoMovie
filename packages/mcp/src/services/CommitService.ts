import { toValidation } from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieConstraintViolation,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";

import { AutoMovieContext } from "../AutoMovieContext";
import {
  IAutoMovieCommitOutput,
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
  IAutoMovieMcpWritableSlate,
} from "../dto";
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
 * downstream slice. The MCP contract lives on the {@link AutoMovieApplication}
 * facade; this service owns the execution.
 */
export class CommitService {
  public constructor(private readonly context?: AutoMovieContext) {}

  /**
   * The slate a commit transforms: the explicit one when given (the tool stays
   * a pure transform), else the resident project's slate (#614). Resident-based
   * successful commits write through — the project files mirror the returned
   * slate, including the invalidation cascade (cleared slices disappear).
   */
  private base(
    slate: IAutoMovieMcpWritableSlate | undefined,
    caller: string,
  ): { slate: IAutoMovieMcpWritableSlate; resident: boolean } {
    if (slate !== undefined) return { slate, resident: false };
    return {
      slate: this.context!.requireProject(caller).writableSlate(),
      resident: true,
    };
  }

  private finish(
    output: IAutoMovieCommitOutput,
    resident: boolean,
  ): IAutoMovieCommitOutput {
    if (resident && output.committed)
      this.context!.requireProject("commit").saveSlate(output.slate);
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
    if (slate.scene !== null)
      appendValidation(
        violations,
        validateShotArtifact(props.shot, slate.scene, props.motions),
      );
    const validation = toValidation(violations);
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

  const beat = shotBeatId(shot.id);
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
  if (beatEnd.shot !== `shot:${beatEnd.beat}`)
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot must equal "shot:${beatEnd.beat}"`,
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
    if (!shotIds.has(`shot:${note.beat}`))
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
      const shot = `shot:${beat.id}`;
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

const shotBeatId = (shot: string): string | null => {
  if (!shot.startsWith("shot:")) return null;
  const beat = shot.slice("shot:".length);
  return beat.length === 0 ? null : beat;
};
