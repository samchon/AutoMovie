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
 * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `IAutoMovieScene` as the portable data boundary for the map host scene placement requirement.
 * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `IAutoMovieScene` for the world site host placement failure system contract.
 * @author Samchon
 */
export interface IAutoMovieScene {
  /**
   * Stable id.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `id` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `id` for the world site host placement failure system contract.
   */
  id: string;

  /**
   * Human / LLM readable name. Null if unnamed.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `name` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `name` for the world site host placement failure system contract.
   */
  name: string | null;

  /**
   * Placed characters and what each is doing.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `nodes` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `nodes` for the world site host placement failure system contract.
   */
  nodes: IAutoMovieSceneNode[];

  /**
   * Cameras; the first is the default render viewpoint when unspecified.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `cameras` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `cameras` for the world site host placement failure system contract.
   */
  cameras: IAutoMovieCamera[];

  /**
   * Scene lights.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `lights` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `lights` for the world site host placement failure system contract.
   */
  lights: IAutoMovieLight[];

  /**
   * Optional physical render environment; omitted preserves legacy output.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `environment` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `environment` for the world site host placement failure system contract.
   */
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
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `space` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `space` for the world site host placement failure system contract.
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
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `fog` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `fog` for the world site host placement failure system contract.
   */
  fog?: IAutoMovieFog | null;
}
