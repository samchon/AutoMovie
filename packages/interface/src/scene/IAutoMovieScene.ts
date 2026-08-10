import { IAutoMovieStage } from "../authoring/IAutoMovieAuthoring";
import { IAutoMovieCamera } from "./IAutoMovieCamera";
import { IAutoMovieFog } from "./IAutoMovieFog";
import { IAutoMovieLight } from "./IAutoMovieLight";
import { IAutoMovieSceneEnvironment } from "./IAutoMovieSceneEnvironment";
import { IAutoMovieSceneNode } from "./IAutoMovieSceneNode";
import { IAutoMovieSpace } from "./IAutoMovieSpace";

/**
 * A scene: placed characters, cameras, and lights, the top-level container the
 * viewer plays and the renderer bakes frames from.
 *
 * The scene is the composition layer above individual rigs: it says _where_
 * characters stand, _what_ they are doing (which motion/pose), and _how_ the
 * frame is lit and framed. A structured building owns rooms and lowers the
 * world transforms of its visible elements here, while actors and props remain
 * ordinary scene nodes in that same frame.
 *
 * @author Samchon
 */
export interface IAutoMovieScene {
  /** Stable id. */
  id: string;

  /** Human / LLM readable name. Null if unnamed. */
  name: string | null;

  /** Placed characters and what each is doing. */
  nodes: IAutoMovieSceneNode[];

  /** Cameras; the first is the default render viewpoint when unspecified. */
  cameras: IAutoMovieCamera[];

  /** Scene lights. */
  lights: IAutoMovieLight[];

  /** Optional physical render environment; omitted preserves legacy output. */
  environment?: IAutoMovieSceneEnvironment | null;

  /**
   * The scene's space: standable surfaces and walkability (#605). Absent or
   * `null` means no declared space: the engine falls back to the scalar ground
   * plane it assumed before the space layer existed. Optional (`?`) rather than
   * required so every pre-space scene stays valid, the evolving-schema pattern
   * {@link IAutoMovieShot.events} uses.
   *
   * Staging authors it ({@link IAutoMovieStage.space}) and the viewer draws it:
   * each surface becomes a real mesh, so the ground reaches the structural
   * guide passes instead of leaving actors over a void (#1173).
   */
  space?: IAutoMovieSpace | null;

  /**
   * The scene's atmosphere: exponential distance fog ({@link IAutoMovieFog}),
   * the depth cue an exterior needs and the only one that costs no particles.
   *
   * Absent or `null` means no atmosphere, and a scene that says nothing about
   * fog renders exactly as it did before the field existed: the viewer leaves
   * `scene.fog` unset and every offline consumer derives a transmittance of
   * one. Optional (`?`) rather than required for the same evolving-schema
   * reason {@link space} is, so no committed scene has to be rewritten.
   *
   * The viewer builds it once ({@link applySceneFog}) and the offline side
   * derives the identical number from the identical declaration
   * ({@link sceneFogTransmittance}); the two cannot disagree, because a review
   * frame that lies about the film's atmosphere is worse than no frame.
   * Structural guide passes suspend it: a depth or mask pass describes
   * geometry, and fogging it would tint the very channel the pass exists to
   * state exactly.
   */
  fog?: IAutoMovieFog | null;
}
