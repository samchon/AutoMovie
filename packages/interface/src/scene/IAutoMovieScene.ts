import { IAutoMovieCamera } from "./IAutoMovieCamera";
import { IAutoMovieLight } from "./IAutoMovieLight";
import { IAutoMovieSceneNode } from "./IAutoMovieSceneNode";
import { IAutoMovieSpace } from "./IAutoMovieSpace";

/**
 * A scene: placed characters, cameras, and lights — the top-level container the
 * viewer plays and the renderer bakes frames from.
 *
 * The scene is the composition layer above individual rigs: it says _where_
 * characters stand, _what_ they are doing (which motion/pose), and _how_ the
 * frame is lit and framed. It is the natural integration point with a spatial
 * host such as interia, which would own the room and hand automovie the world
 * frame its nodes live in.
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

  /**
   * The scene's space — standable surfaces and walkability (#605). Absent or
   * `null` means no declared space: the engine falls back to the scalar ground
   * plane it assumed before the space layer existed. Optional (`?`) rather than
   * required so every pre-space scene stays valid — the evolving-schema pattern
   * {@link IAutoMovieShot.events} uses.
   */
  space?: IAutoMovieSpace | null;
}
