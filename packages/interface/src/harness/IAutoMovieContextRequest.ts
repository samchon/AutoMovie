import { IautomovieGetBeatEndRequest } from "./IautomovieGetBeatEndRequest";
import { IautomovieGetNotesRequest } from "./IautomovieGetNotesRequest";
import { IautomovieGetReachRequest } from "./IautomovieGetReachRequest";
import { IautomovieGetResolvedPoseRequest } from "./IautomovieGetResolvedPoseRequest";
import { IautomovieGetSceneRequest } from "./IautomovieGetSceneRequest";
import { IautomovieGetScriptRequest } from "./IautomovieGetScriptRequest";
import { IautomovieGetShotRequest } from "./IautomovieGetShotRequest";
import { IautomovieMeasureDistanceRequest } from "./IautomovieMeasureDistanceRequest";

/**
 * A **query tool**: the agent reads instead of writing this turn, and the
 * engine answers. Two families share this union:
 *
 * - **Stored context** ({@link IautomovieGetScriptRequest} /
 *   {@link IautomovieGetSceneRequest} / {@link IautomovieGetShotRequest} /
 *   {@link IautomovieGetNotesRequest} / {@link IautomovieGetBeatEndRequest}) ?? *   AutoBe's "preliminary" pattern: pull a slice of the production state
 *   (script, staged scene, a sibling shot, the open review notes, where a prior
 *   beat left everyone) rather than guessing or inventing it.
 * - **Engine queries** ({@link IautomovieGetReachRequest} /
 *   {@link IautomovieGetResolvedPoseRequest} /
 *   {@link IautomovieMeasureDistanceRequest}) ??interrogate the engine's
 *   _resolved geometry_ so the agent grounds its next move in fact, not hope.
 *   This is the harness's "the engine is the strong controller" principle as a
 *   read surface: before staging a strike the agent asks whether the actor can
 *   actually reach the target (so it _lands_ rather than mimes at air), and
 *   reads where a hand truly ends up before chaining the next action onto it.
 *
 * In the autonomous toolbox these are tools the agent calls in any order and to
 * any depth ??not a fixed pipeline step. Keeping them explicit and exhaustible
 * stops the model inventing context it could have asked the engine for.
 *
 * @author Samchon
 */
export type IautomovieContextRequest =
  | IautomovieGetScriptRequest
  | IautomovieGetSceneRequest
  | IautomovieGetShotRequest
  | IautomovieGetNotesRequest
  | IautomovieGetReachRequest
  | IautomovieGetResolvedPoseRequest
  | IautomovieMeasureDistanceRequest
  | IautomovieGetBeatEndRequest;
