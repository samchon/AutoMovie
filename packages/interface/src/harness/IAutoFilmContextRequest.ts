import { IAutoFilmGetBeatEndRequest } from "./IAutoFilmGetBeatEndRequest";
import { IAutoFilmGetNotesRequest } from "./IAutoFilmGetNotesRequest";
import { IAutoFilmGetReachRequest } from "./IAutoFilmGetReachRequest";
import { IAutoFilmGetResolvedPoseRequest } from "./IAutoFilmGetResolvedPoseRequest";
import { IAutoFilmGetSceneRequest } from "./IAutoFilmGetSceneRequest";
import { IAutoFilmGetScriptRequest } from "./IAutoFilmGetScriptRequest";
import { IAutoFilmGetShotRequest } from "./IAutoFilmGetShotRequest";
import { IAutoFilmMeasureDistanceRequest } from "./IAutoFilmMeasureDistanceRequest";

/**
 * A **query tool**: the agent reads instead of writing this turn, and the
 * engine answers. Two families share this union:
 *
 * - **Stored context** ({@link IAutoFilmGetScriptRequest} /
 *   {@link IAutoFilmGetSceneRequest} / {@link IAutoFilmGetShotRequest} /
 *   {@link IAutoFilmGetNotesRequest} / {@link IAutoFilmGetBeatEndRequest}) —
 *   AutoBe's "preliminary" pattern: pull a slice of the production state
 *   (script, staged scene, a sibling shot, the open review notes, where a prior
 *   beat left everyone) rather than guessing or inventing it.
 * - **Engine queries** ({@link IAutoFilmGetReachRequest} /
 *   {@link IAutoFilmGetResolvedPoseRequest} /
 *   {@link IAutoFilmMeasureDistanceRequest}) — interrogate the engine's
 *   _resolved geometry_ so the agent grounds its next move in fact, not hope.
 *   This is the harness's "the engine is the strong controller" principle as a
 *   read surface: before staging a strike the agent asks whether the actor can
 *   actually reach the target (so it _lands_ rather than mimes at air), and
 *   reads where a hand truly ends up before chaining the next action onto it.
 *
 * In the autonomous toolbox these are tools the agent calls in any order and to
 * any depth — not a fixed pipeline step. Keeping them explicit and exhaustible
 * stops the model inventing context it could have asked the engine for.
 *
 * @author Samchon
 */
export type IAutoFilmContextRequest =
  | IAutoFilmGetScriptRequest
  | IAutoFilmGetSceneRequest
  | IAutoFilmGetShotRequest
  | IAutoFilmGetNotesRequest
  | IAutoFilmGetReachRequest
  | IAutoFilmGetResolvedPoseRequest
  | IAutoFilmMeasureDistanceRequest
  | IAutoFilmGetBeatEndRequest;
