import { IAutoMovieGetBeatEndRequest } from "./IAutoMovieGetBeatEndRequest";
import { IAutoMovieGetNotesRequest } from "./IAutoMovieGetNotesRequest";
import { IAutoMovieGetReachRequest } from "./IAutoMovieGetReachRequest";
import { IAutoMovieGetResolvedPoseRequest } from "./IAutoMovieGetResolvedPoseRequest";
import { IAutoMovieGetSceneRequest } from "./IAutoMovieGetSceneRequest";
import { IAutoMovieGetScriptRequest } from "./IAutoMovieGetScriptRequest";
import { IAutoMovieGetShotRequest } from "./IAutoMovieGetShotRequest";
import { IAutoMovieMeasureDistanceRequest } from "./IAutoMovieMeasureDistanceRequest";

/**
 * A **query tool**: the agent reads instead of writing this turn, and the
 * engine answers. Two families share this union:
 *
 * - **Stored context** ({@link IAutoMovieGetScriptRequest} /
 *   {@link IAutoMovieGetSceneRequest} / {@link IAutoMovieGetShotRequest} /
 *   {@link IAutoMovieGetNotesRequest} / {@link IAutoMovieGetBeatEndRequest}),
 *   AutoBe's "preliminary" pattern: pull a slice of the production state
 *   (script, staged scene, a sibling shot, the open review notes, where a prior
 *   beat left everyone) rather than guessing or inventing it.
 * - **Engine queries** ({@link IAutoMovieGetReachRequest} /
 *   {@link IAutoMovieGetResolvedPoseRequest} /
 *   {@link IAutoMovieMeasureDistanceRequest}): interrogate the engine's
 *   _resolved geometry_ so the agent grounds its next move in fact, not hope.
 *   This is the harness's "the engine is the strong controller" principle as a
 *   read surface: before staging a strike the agent asks whether the actor can
 *   actually reach the target (so it _lands_ rather than mimes at air), and
 *   reads where a hand truly ends up before chaining the next action onto it.
 *
 * In the autonomous toolbox these are tools the agent calls in any order and to
 * any depth, not a fixed pipeline step. Keeping them explicit and exhaustible
 * stops the model inventing context it could have asked the engine for.
 *
 * @author Samchon
 */
export type IAutoMovieContextRequest =
  | IAutoMovieGetScriptRequest
  | IAutoMovieGetSceneRequest
  | IAutoMovieGetShotRequest
  | IAutoMovieGetNotesRequest
  | IAutoMovieGetReachRequest
  | IAutoMovieGetResolvedPoseRequest
  | IAutoMovieMeasureDistanceRequest
  | IAutoMovieGetBeatEndRequest;
