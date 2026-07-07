import { readSlateContext } from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieShot,
  IAutoMovieSlate,
} from "@automovie/interface";

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
  public getScript(props: {
    slate: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetScriptOutput {
    return {
      script: readSlateContext(toStoredSlate(props.slate), {
        type: "getScript",
      }) as IAutoMovieScript | null,
    };
  }

  public getScene(props: {
    slate: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetSceneOutput {
    return {
      scene: readSlateContext(toStoredSlate(props.slate), {
        type: "getScene",
      }) as IAutoMovieScene | null,
    };
  }

  public getShot(props: {
    slate: IAutoMovieMcpStoredSlate;
    beat: string;
  }): IAutoMovieGetShotOutput {
    return {
      shot: readSlateContext(toStoredSlate(props.slate), {
        type: "getShot",
        beat: props.beat,
      }) as IAutoMovieShot | null,
    };
  }

  public getNotes(props: {
    slate: IAutoMovieMcpStoredSlate;
    beat?: string;
  }): IAutoMovieGetNotesOutput {
    return {
      notes: readSlateContext(toStoredSlate(props.slate), {
        type: "getNotes",
        beat: props.beat,
      }) as IAutoMovieReviewNote[],
    };
  }

  public getBeatEnd(props: {
    slate: IAutoMovieMcpStoredSlate;
    beat: string;
  }): IAutoMovieGetBeatEndOutput {
    return {
      beatEnd: readSlateContext(toStoredSlate(props.slate), {
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
