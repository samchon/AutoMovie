import { IAutoFilmCamera } from "./IAutoFilmCamera";
import { IAutoFilmLight } from "./IAutoFilmLight";
import { IAutoFilmSceneNode } from "./IAutoFilmSceneNode";

/**
 * A scene: placed characters, cameras, and lights — the top-level container the
 * viewer plays and the renderer bakes frames from.
 *
 * The scene is the composition layer above individual rigs: it says _where_
 * characters stand, _what_ they are doing (which motion/pose), and _how_ the
 * frame is lit and framed. It is the natural integration point with a spatial
 * host such as interia, which would own the room and hand autofilm the world
 * frame its nodes live in.
 *
 * @author Samchon
 */
export interface IAutoFilmScene {
  /** Stable id. */
  id: string;

  /** Human / LLM readable name. Null if unnamed. */
  name: string | null;

  /** Placed characters and what each is doing. */
  nodes: IAutoFilmSceneNode[];

  /** Cameras; the first is the default render viewpoint when unspecified. */
  cameras: IAutoFilmCamera[];

  /** Scene lights. */
  lights: IAutoFilmLight[];
}
