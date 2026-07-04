import { IAutoMovieClip } from "../core/IAutoMovieTrack";

/**
 * A shot: one continuous take — a scene, the camera that frames it, the
 * camera's move, and what every placed node performs — over a local time range.
 * This is the unit an LLM renders ("render this shot") and the rung above a
 * single clip on the road to assembling a film from objects and motion.
 *
 * Time is local to the shot (origin 0, seconds); a {@link IAutoMovieSequence}
 * composes shots into a global timeline. The camera is a scene node, so its
 * move is an ordinary {@link IAutoMovieClip} of transform (and FOV) tracks — no
 * special camera-animation concept.
 *
 * @author Samchon
 */
export interface IAutoMovieShot {
  /** Stable id. */
  id: string;

  /** Human / LLM readable name. Null if unnamed. */
  name: string | null;

  /** Id of the scene (placed models, lights, cameras) this shot renders. */
  scene: string;

  /** Id of the scene camera that is live for this shot. */
  camera: string;

  /**
   * The camera's move for this shot — a clip of the camera node's transform
   * (and FOV) tracks. `null` for a locked-off (static) camera.
   */
  cameraMotion: IAutoMovieClip | null;

  /** Per scene-node performances for this shot. */
  performances: IAutoMovieShotPerformance[];

  /**
   * Node-transform clips for **non-skeletal scene objects** the shot animates —
   * a launched projectile's baked flight, a prop carried along a path — each an
   * ordinary {@link IAutoMovieClip} keyed to its object's scene node. Distinct
   * from `performances` (skeletal pose motions played through a rig) and from
   * `cameraMotion` (the one live camera): a projectile has no skeleton, so it
   * moves the same way the camera does — a clip of transform tracks. Empty when
   * the shot animates no such object.
   */
  objectMotions: IAutoMovieClip[];

  /** Shot length in seconds (local time origin = 0). */
  duration: number;
}

/** What one scene node does during a shot. */
export interface IAutoMovieShotPerformance {
  /** Id of the scene node performing. */
  node: string;

  /** Id of the motion clip it plays, or `null` to hold its pose. */
  motion: string | null;

  /** Seconds into the shot at which this performance begins. */
  startOffset: number;
}
