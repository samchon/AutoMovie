import { IAutoMovieClip } from "../core/IAutoMovieTrack";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieInteractionEvent } from "./IAutoMovieInteractionEvent";

/**
 * A shot: one continuous take (a scene, the camera that frames it, the camera's
 * move, and what every placed node performs) over a local time range. This is
 * the unit an LLM renders ("render this shot") and the rung above a single clip
 * on the road to assembling a film from objects and motion.
 *
 * Time is local to the shot (origin 0, seconds); a {@link IAutoMovieSequence}
 * composes shots into a global timeline. The camera is a scene node, so its
 * move is an ordinary {@link IAutoMovieClip} of transform (and FOV) tracks: no
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
   * The camera's move for this shot: a clip of the camera node's transform (and
   * FOV) tracks. `null` for a locked-off (static) camera.
   */
  cameraMotion: IAutoMovieClip | null;

  /** Per scene-node performances for this shot. */
  performances: IAutoMovieShotPerformance[];

  /**
   * Node-transform clips for **non-skeletal scene objects** the shot animates
   * (a launched projectile's baked flight, a prop carried along a path), each
   * an ordinary {@link IAutoMovieClip} keyed to its object's scene node.
   * Distinct from `performances` (skeletal pose motions played through a rig)
   * and from `cameraMotion` (the one live camera): a projectile has no
   * skeleton, so it moves the same way the camera does: a clip of transform
   * tracks. Empty when the shot animates no such object.
   */
  objectMotions: IAutoMovieClip[];

  /**
   * Clips changing this shot's LIGHTING over its local clock: a candle going
   * out, a sunset. Each track addresses one staged light by pointer channel
   * (`/lights/<id>/intensity`); the PERFORMANCE guide states the grammar.
   * Absent means legacy; an empty array means constant light.
   */
  lightMotions?: IAutoMovieClip[];

  /**
   * Computed or scripted interactions on this shot's local clock. `performShot`
   * emits this for contacts, hits, falls, and attach handoffs so downstream
   * tools can follow the same timing the engine used. Absent means legacy or
   * no-event data; an empty array means the shot was assembled and had none.
   */
  events?: IAutoMovieInteractionEvent[];

  /**
   * The camera's directorial intent per frame span (#1187): framing, move, the
   * resolved focus point, and the lens intent. Structural guide metadata a
   * diffusion/render host reads beside `cameraMotion`, exactly as it reads
   * `events`. The deterministic camera solve never consumes it. Absent means
   * legacy; an empty array means the shot was assembled with no frame actions.
   */
  cameraIntent?: IAutoMovieCameraIntent[];

  /**
   * The alternate camera takes covering the same beat (#1187): one staged
   * camera per additional angle, each with its own compiled move and intent.
   * The hero take stays the singular `camera`/`cameraMotion` every consumer
   * already reads; coverage rides beside it as structural guide metadata a
   * diffusion/render host uses to render the beat from the other staged angles,
   * exactly as it reads `cameraIntent`. The cut is untouched: coverage takes
   * are alternates of THIS shot, never separate timeline entries. Absent means
   * legacy or single-camera data; an empty array means the shot was assembled
   * with one camera.
   */
  coverage?: IAutoMovieShotCoverage[];

  /** Shot length in seconds (local time origin = 0). */
  duration: number;
}

/**
 * One frame span's directorial camera intent (#1187): what the take frames and
 * how, plus the two lens intents the fixed move grammar could not carry: the
 * focus subject (resolved to a world point) and the focal length. INTENT only:
 * `fovY` on the scene camera stays the geometric truth, and depth-of-field blur
 * is deliberately out of scope (diffusion's job).
 */
export interface IAutoMovieCameraIntent {
  /** Shot-local start (seconds) of the frame span this intent covers. */
  start: number;

  /** How tight the framing is. */
  framing: "wide" | "full" | "medium" | "close";

  /** How the camera behaves over the span. */
  move: "static" | "follow" | "orbit" | "push-in" | "truck" | "whip";

  /** Resolved world focus point, or `null` when the action named none. */
  focus: IAutoMovieVector3 | null;

  /** Lens intent in millimetres, or `null` when the action named none. */
  focalLength: number | null;
}

/**
 * One alternate camera take covering the shot's beat (#1187): the staged camera
 * that plays the angle, its compiled move, and its per-span directorial intent.
 * Same contract as the hero take, plural: a beat blocked for several angles
 * assembles one take per staged camera, and a render/diffusion host picks or
 * intercuts them without re-performing the shot.
 */
export interface IAutoMovieShotCoverage {
  /** Id of the scene camera this take plays on (never the hero `camera`). */
  camera: string;

  /**
   * The covering camera's move: a clip of its transform tracks, compiled by the
   * same framing grammar as the hero `cameraMotion`. `null` for a locked-off
   * (static) covering camera.
   */
  cameraMotion: IAutoMovieClip | null;

  /**
   * This take's directorial intent per frame span, the same record the hero
   * take carries on `cameraIntent`. Empty when the angle had no frame actions.
   */
  cameraIntent: IAutoMovieCameraIntent[];
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
