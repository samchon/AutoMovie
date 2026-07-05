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

const findUniqueOrNull = <T>(props: {
  items: readonly T[];
  matches: (item: T) => boolean;
  key: string;
  label: string;
  path: (index: number) => string;
}): T | null => {
  let found: { item: T; index: number } | null = null;
  for (let index = 0; index < props.items.length; index++) {
    const item = props.items[index]!;
    if (!props.matches(item)) continue;
    if (found !== null)
      throw new Error(
        `${props.label} "${props.key}" is duplicated at ${props.path(index)}; first declared at ${props.path(found.index)}`,
      );
    found = { item, index };
  }
  return found?.item ?? null;
};

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
      return findUniqueOrNull({
        items: slate.shots,
        matches: (shot) => shot.id === `shot:${request.beat}`,
        key: `shot:${request.beat}`,
        label: "shot id",
        path: (index) => `slate.shots[${index}].id`,
      });
    case "getNotes":
      return request.beat === undefined
        ? slate.notes
        : slate.notes.filter((note) => note.beat === request.beat);
    case "getBeatEnd":
      return findUniqueOrNull({
        items: slate.beatEnds,
        matches: (end) => end.beat === request.beat,
        key: request.beat,
        label: "beat end",
        path: (index) => `slate.beatEnds[${index}].beat`,
      });
  }
  const unknown = request as unknown as { type: unknown };
  throw new Error(`unknown slate context request "${String(unknown.type)}"`);
};
