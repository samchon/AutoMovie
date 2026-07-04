import {
  IAutoMovieBeatEndState,
  IAutoMovieContextRequest,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieShot,
  IAutoMovieSlate,
} from "@automovie/interface";

type AutoMovieStoredContextType =
  | "getScript"
  | "getScene"
  | "getShot"
  | "getNotes"
  | "getBeatEnd";

export type IAutoMovieStoredContextRequest = Extract<
  IAutoMovieContextRequest,
  { type: AutoMovieStoredContextType }
>;

export type IAutoMovieStoredContext =
  | IAutoMovieScript
  | IAutoMovieScene
  | IAutoMovieShot
  | IAutoMovieReviewNote[]
  | IAutoMovieBeatEndState
  | null;

/**
 * Answer stored-context requests from the production slate. Geometry-dependent
 * engine queries (`getReach`, `getResolvedPose`, `measureDistance`) need their
 * own resolver inputs, so this helper intentionally covers only state already
 * present on {@link IAutoMovieSlate}.
 */
export const readSlateContext = (
  slate: IAutoMovieSlate,
  request: IAutoMovieStoredContextRequest,
): IAutoMovieStoredContext => {
  switch (request.type) {
    case "getScript":
      return slate.script;
    case "getScene":
      return slate.scene;
    case "getShot":
      return (
        slate.shots.find((shot) => shot.id === `shot:${request.beat}`) ?? null
      );
    case "getNotes":
      return request.beat === undefined
        ? slate.notes
        : slate.notes.filter((note) => note.beat === request.beat);
    case "getBeatEnd":
      return slate.beatEnds.find((end) => end.beat === request.beat) ?? null;
  }
};
