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
  IAutoMovieMcpStoredSlate,
} from "../dto";

/**
 * Read-only slate queries — the stored-context reads behind the `get*` tools.
 * The MCP contract (names, schemas, tool descriptions) lives on the
 * {@link AutoMovieApplication} facade; this service owns the execution.
 */
export class SlateQueryService {
  public constructor(private readonly context?: AutoMovieContext) {}

  /**
   * The slate a query reads: the explicit one when given, else the resident
   * project's stored slices (#614) — with the context's actionable error when
   * neither exists.
   */
  private stored(
    slate: IAutoMovieMcpStoredSlate | undefined,
    caller: string,
  ): IAutoMovieMcpStoredSlate {
    if (slate !== undefined) return slate;
    return this.context!.requireProject(caller).storedSlate();
  }

  public getScript(props: {
    slate?: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetScriptOutput {
    return {
      script: readSlateContext(
        toStoredSlate(this.stored(props.slate, "getScript")),
        {
          type: "getScript",
        },
      ) as IAutoMovieScript | null,
    };
  }

  public getScene(props: {
    slate?: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetSceneOutput {
    return {
      scene: readSlateContext(
        toStoredSlate(this.stored(props.slate, "getScene")),
        {
          type: "getScene",
        },
      ) as IAutoMovieScene | null,
    };
  }

  public getShot(props: {
    slate?: IAutoMovieMcpStoredSlate;
    beat: string;
  }): IAutoMovieGetShotOutput {
    const slate = this.stored(props.slate, "getShot");
    assertStoredSlateCollection(
      slate.shots,
      "slate.shots",
      "stored slate shots",
    );
    return {
      shot: readSlateContext(toStoredSlate(slate), {
        type: "getShot",
        beat: props.beat,
      }) as IAutoMovieShot | null,
    };
  }

  public getNotes(props: {
    slate?: IAutoMovieMcpStoredSlate;
    beat?: string;
  }): IAutoMovieGetNotesOutput {
    const slate = this.stored(props.slate, "getNotes");
    assertStoredSlateCollection(
      slate.notes,
      "slate.notes",
      "stored slate notes",
    );
    return {
      notes: readSlateContext(toStoredSlate(slate), {
        type: "getNotes",
        beat: props.beat,
      }) as IAutoMovieReviewNote[],
    };
  }

  public getBeatEnd(props: {
    slate?: IAutoMovieMcpStoredSlate;
    beat: string;
  }): IAutoMovieGetBeatEndOutput {
    const slate = this.stored(props.slate, "getBeatEnd");
    assertStoredSlateCollection(
      slate.beatEnds,
      "slate.beatEnds",
      "stored slate beat ends",
    );
    return {
      beatEnd: readSlateContext(toStoredSlate(slate), {
        type: "getBeatEnd",
        beat: props.beat,
      }) as IAutoMovieBeatEndState | null,
    };
  }
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
