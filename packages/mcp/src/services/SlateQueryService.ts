import { readSlateContext } from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieShot,
  IAutoMovieSlate,
} from "@automovie/interface";

import { AutoMovieContext } from "../AutoMovieContext";
import {
  IAutoMovieGetBeatEndOutput,
  IAutoMovieGetNotesOutput,
  IAutoMovieGetSceneOutput,
  IAutoMovieGetScriptOutput,
  IAutoMovieGetShotOutput,
  IAutoMovieGetSlateOutput,
  IAutoMovieMcpStoredSlate,
  IAutoMovieMcpWritableSlate,
} from "../dto";

/**
 * Read-only slate queries, the stored-context reads behind the `get*` tools.
 * The MCP contract (names, schemas, tool descriptions) lives on the
 * {@link AutoMovieApplication} facade; this service owns the execution.
 */
export class SlateQueryService {
  public constructor(private readonly context?: AutoMovieContext) {}

  /**
   * The slate a query reads: the explicit one when given, else the resident
   * project's stored slices (#614), with the context's actionable error when
   * neither exists.
   */
  private stored(
    slate: IAutoMovieMcpStoredSlate | undefined,
    caller: string,
  ): StoredSlateSource {
    if (slate !== undefined) return { slate, root: "$input.slate" };
    return {
      slate: this.context!.requireProject(caller).storedSlate(),
      // The `$`-prefixed root matches CommitService/RenderService and the
      // guides' addressing convention (#995): resident diagnostics read
      // `$slate...`, explicit ones `$input.slate...`.
      root: "$slate",
    };
  }

  /**
   * The whole writable slate in one read, every slice plus the film. The
   * explicit form echoes the slate the caller passed; the resident form reads
   * all slices from the project. This is what the cross-session revision guard
   * (#1133) points a refused commit at ("re-read via getSlate").
   */
  public getSlate(props: {
    slate?: IAutoMovieMcpWritableSlate;
  }): IAutoMovieGetSlateOutput {
    assertSlateQueryRequestRoot(props);
    if (props.slate !== undefined) return { slate: props.slate };
    return {
      slate: this.context!.requireProject("getSlate").writableSlate(),
    };
  }

  public getScript(props: {
    slate?: IAutoMovieMcpWritableSlate;
  }): IAutoMovieGetScriptOutput {
    assertSlateQueryRequestRoot(props);
    const source = this.stored(props.slate, "getScript");
    assertStoredSlateRoot(source.slate, source.root);
    return {
      script: readSlateContext(toStoredSlate(source.slate), {
        type: "getScript",
      }) as IAutoMovieScript | null,
    };
  }

  public getScene(props: {
    slate?: IAutoMovieMcpWritableSlate;
  }): IAutoMovieGetSceneOutput {
    assertSlateQueryRequestRoot(props);
    const source = this.stored(props.slate, "getScene");
    assertStoredSlateRoot(source.slate, source.root);
    return {
      scene: readSlateContext(toStoredSlate(source.slate), {
        type: "getScene",
      }) as IAutoMovieScene | null,
    };
  }

  public getShot(props: {
    slate?: IAutoMovieMcpWritableSlate;
    beat: string;
  }): IAutoMovieGetShotOutput {
    assertSlateQueryRequestRoot(props);
    assertRequiredQueryBeat(props.beat);
    const source = this.stored(props.slate, "getShot");
    assertStoredSlateRoot(source.slate, source.root);
    assertStoredSlateCollection(
      source.slate.shots,
      `${source.root}.shots`,
      "stored slate shots",
    );
    assertUniqueStoredSlateEntries(
      source.slate.shots,
      "id",
      `${source.root}.shots`,
      "shot id",
    );
    return {
      shot: readSlateContext(toStoredSlate(source.slate), {
        type: "getShot",
        beat: props.beat,
      }) as IAutoMovieShot | null,
    };
  }

  public getNotes(props: {
    slate?: IAutoMovieMcpWritableSlate;
    beat?: string;
  }): IAutoMovieGetNotesOutput {
    assertSlateQueryRequestRoot(props);
    assertOptionalQueryBeat(props.beat);
    const source = this.stored(props.slate, "getNotes");
    assertStoredSlateRoot(source.slate, source.root);
    assertStoredSlateCollection(
      source.slate.notes,
      `${source.root}.notes`,
      "stored slate notes",
    );
    return {
      notes: readSlateContext(toStoredSlate(source.slate), {
        type: "getNotes",
        beat: props.beat,
      }) as IAutoMovieReviewNote[],
    };
  }

  public getBeatEnd(props: {
    slate?: IAutoMovieMcpWritableSlate;
    beat: string;
  }): IAutoMovieGetBeatEndOutput {
    assertSlateQueryRequestRoot(props);
    assertRequiredQueryBeat(props.beat);
    const source = this.stored(props.slate, "getBeatEnd");
    assertStoredSlateRoot(source.slate, source.root);
    assertStoredSlateCollection(
      source.slate.beatEnds,
      `${source.root}.beatEnds`,
      "stored slate beat ends",
    );
    assertUniqueStoredSlateEntries(
      source.slate.beatEnds,
      "beat",
      `${source.root}.beatEnds`,
      "beat end",
    );
    return {
      beatEnd: readSlateContext(toStoredSlate(source.slate), {
        type: "getBeatEnd",
        beat: props.beat,
      }) as IAutoMovieBeatEndState | null,
    };
  }
}

type StoredSlateSource = {
  slate: IAutoMovieMcpStoredSlate;
  root: string;
};

function assertSlateQueryRequestRoot(
  props: unknown,
): asserts props is Record<string, unknown> {
  if (typeof props === "object" && props !== null && !Array.isArray(props))
    return;
  throw new Error("slate query request at $input must be a JSON object");
}

function assertRequiredQueryBeat(beat: unknown): asserts beat is string {
  if (typeof beat === "string" && beat.trim().length > 0) return;
  throw new Error("slate query beat at $input.beat must be a non-empty string");
}

function assertOptionalQueryBeat(
  beat: unknown,
): asserts beat is string | undefined {
  if (beat === undefined) return;
  assertRequiredQueryBeat(beat);
}

const toStoredSlate = (slate: IAutoMovieMcpStoredSlate): IAutoMovieSlate => ({
  brief: "",
  script: slate.script,
  scene: slate.scene,
  shots: slate.shots,
  beatEnds: slate.beatEnds,
  notes: slate.notes,
  film: null,
});

function assertStoredSlateRoot(
  slate: unknown,
  path: string,
): asserts slate is IAutoMovieMcpStoredSlate {
  if (typeof slate === "object" && slate !== null && !Array.isArray(slate))
    return;
  throw new Error(`stored slate at ${path} must be a JSON object`);
}

const assertStoredSlateCollection = (
  value: unknown,
  path: string,
  label: string,
): void => {
  if (!Array.isArray(value))
    throw new Error(`${label} at ${path} must be an array`);
  value.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      throw new Error(
        `${label} entry at ${path}[${index}] must be a JSON object`,
      );
  });
};

const assertUniqueStoredSlateEntries = (
  value: readonly unknown[],
  key: string,
  path: string,
  label: string,
): void => {
  const seen = new Map<string, number>();
  value.forEach((entry, index) => {
    // Precondition: every getShot/getBeatEnd caller runs
    // assertStoredSlateCollection first, which throws on any non-object entry,
    // so this uniqueness scan only ever sees objects, no dead type guard to
    // hide behind a c8-ignore (#1040, #1252). A non-string id is still handled
    // below (a stored slice with the wrong key shape is not this scan's fault).
    const id = (entry as Record<string, unknown>)[key];
    if (typeof id !== "string") return;
    const first = seen.get(id);
    if (first !== undefined)
      throw new Error(
        `duplicate ${label} "${id}" at ${path}[${index}].${key}; first occurrence at ${path}[${first}].${key}`,
      );
    seen.set(id, index);
  });
};
