import { IAutoMovieClip } from "../core/IAutoMovieTrack";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieCameraClearanceReport } from "../scene/IAutoMovieCamera";
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
 * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `IAutoMovieShot` as the portable data boundary for the camera path time sampling requirement.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `IAutoMovieShot` for the clv camera path direct sampling system contract.
 * @author Samchon
 */
export interface IAutoMovieShot {
  /**
   * Stable id.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `id` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `id` for the clv camera path direct sampling system contract.
   */
  id: string;

  /**
   * Human / LLM readable name. Null if unnamed.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `name` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `name` for the clv camera path direct sampling system contract.
   */
  name: string | null;

  /**
   * Id of the scene (placed models, lights, cameras) this shot renders.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `scene` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `scene` for the clv camera path direct sampling system contract.
   */
  scene: string;

  /**
   * Id of the scene camera that is live for this shot.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `camera` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `camera` for the clv camera path direct sampling system contract.
   */
  camera: string;

  /**
   * The camera's move for this shot: a clip of the camera node's transform (and
   * FOV) tracks. `null` for a locked-off (static) camera.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `cameraMotion` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `cameraMotion` for the clv camera path direct sampling system contract.
   */
  cameraMotion: IAutoMovieClip | null;

  /**
   * Per scene-node performances for this shot.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `performances` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `performances` for the clv camera path direct sampling system contract.
   */
  performances: IAutoMovieShotPerformance[];

  /**
   * Node-transform clips for **non-skeletal scene objects** the shot animates
   * (a launched projectile's baked flight, a prop carried along a path), each
   * an ordinary {@link IAutoMovieClip} keyed to its object's scene node.
   * Distinct from `performances` (skeletal pose motions played through a rig)
   * and from `cameraMotion` (the one live camera): a projectile has no
   * skeleton, so it moves the same way the camera does: a clip of transform
   * tracks. Empty when the shot animates no such object.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `objectMotions` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `objectMotions` for the clv camera path direct sampling system contract.
   */
  objectMotions: IAutoMovieClip[];

  /**
   * Clips changing this shot's LIGHTING over its local clock: a candle going
   * out, a sunset. Each track addresses one staged light by pointer channel
   * (`/lights/<id>/intensity`); the PERFORMANCE guide states the grammar.
   * Absent means legacy; an empty array means constant light.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `lightMotions` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `lightMotions` for the clv camera path direct sampling system contract.
   */
  lightMotions?: IAutoMovieClip[];

  /**
   * Computed or scripted interactions on this shot's local clock. `performShot`
   * emits this for contacts, hits, falls, and attach handoffs so downstream
   * tools can follow the same timing the engine used. Absent means legacy or
   * no-event data; an empty array means the shot was assembled and had none.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `events` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `events` for the clv camera path direct sampling system contract.
   */
  events?: IAutoMovieInteractionEvent[];

  /**
   * The camera's directorial intent per frame span (#1187): framing, move, the
   * resolved focus point, and the lens intent. Structural guide metadata a
   * diffusion/render host reads beside `cameraMotion`, exactly as it reads
   * `events`. The deterministic camera solve never consumes it. Absent means
   * legacy; an empty array means the shot was assembled with no frame actions.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `cameraIntent` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `cameraIntent` for the clv camera path direct sampling system contract.
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
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `coverage` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `coverage` for the clv camera path direct sampling system contract.
   */
  coverage?: IAutoMovieShotCoverage[];

  /**
   * Current-revision swept-clearance reports for the hero and alternate takes
   * whose staged cameras declared physical envelopes.
   *
   * Omitted preserves legacy shots whose cameras make no clearance claim. A
   * present list contains only clear reports: blocked or stale evaluation is a
   * performance refusal and no shot artifact is published.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-dynamic-spatial-sampling Carries the fixed-clock swept result beside the exact camera motion it evaluated.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Preserves accepted current-revision reports in the compiled take instead of dropping the gate's evidence.
   */
  cameraClearance?: IAutoMovieCameraClearanceReport[];

  /**
   * Shot length in seconds (local time origin = 0).
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `duration` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `duration` for the clv camera path direct sampling system contract.
   */
  duration: number;
}

/**
 * One frame span's directorial camera intent (#1187): what the take frames and
 * how, plus the two lens intents the fixed move grammar could not carry: the
 * focus subject (resolved to a world point) and the focal length. INTENT only:
 * `fovY` on the scene camera stays the geometric truth, and depth-of-field blur
 * is deliberately out of scope (diffusion's job).
 *
 * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Exposes `IAutoMovieCameraIntent` as the portable data boundary for the camera grammar time sampling requirement.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Types `IAutoMovieCameraIntent` for the clv grammar sampling findings system contract.
 */
export interface IAutoMovieCameraIntent {
  /**
   * Shot-local start (seconds) of the frame span this intent covers.
   *
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Exposes `start` as the portable data boundary for the camera grammar time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Types `start` for the clv grammar sampling findings system contract.
   */
  start: number;

  /**
   * How tight the framing is.
   *
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Exposes `framing` as the portable data boundary for the camera grammar time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Types `framing` for the clv grammar sampling findings system contract.
   */
  framing: "wide" | "full" | "medium" | "close";

  /**
   * How the camera behaves over the span.
   *
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Exposes `move` as the portable data boundary for the camera grammar time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Types `move` for the clv grammar sampling findings system contract.
   */
  move: "static" | "follow" | "orbit" | "push-in" | "truck" | "whip";

  /**
   * Resolved world focus point, or `null` when the action named none.
   *
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Exposes `focus` as the portable data boundary for the camera grammar time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Types `focus` for the clv grammar sampling findings system contract.
   */
  focus: IAutoMovieVector3 | null;

  /**
   * Lens intent in millimetres, or `null` when the action named none.
   *
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-grammar-time-sampling Exposes `focalLength` as the portable data boundary for the camera grammar time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-grammar-sampling-findings Types `focalLength` for the clv grammar sampling findings system contract.
   */
  focalLength: number | null;
}

/**
 * One alternate camera take covering the shot's beat (#1187): the staged camera
 * that plays the angle, its compiled move, and its per-span directorial intent.
 * Same contract as the hero take, plural: a beat blocked for several angles
 * assembles one take per staged camera, and a render/diffusion host picks or
 * intercuts them without re-performing the shot.
 *
 * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `IAutoMovieShotCoverage` as the portable data boundary for the camera path time sampling requirement.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `IAutoMovieShotCoverage` for the clv camera path direct sampling system contract.
 */
export interface IAutoMovieShotCoverage {
  /**
   * Id of the scene camera this take plays on (never the hero `camera`).
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `camera` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `camera` for the clv camera path direct sampling system contract.
   */
  camera: string;

  /**
   * The covering camera's move: a clip of its transform tracks, compiled by the
   * same framing grammar as the hero `cameraMotion`. `null` for a locked-off
   * (static) covering camera.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `cameraMotion` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `cameraMotion` for the clv camera path direct sampling system contract.
   */
  cameraMotion: IAutoMovieClip | null;

  /**
   * This take's directorial intent per frame span, the same record the hero
   * take carries on `cameraIntent`. Empty when the angle had no frame actions.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `cameraIntent` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `cameraIntent` for the clv camera path direct sampling system contract.
   */
  cameraIntent: IAutoMovieCameraIntent[];
}

/**
 * What one scene node does during a shot.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Exposes `IAutoMovieShotPerformance` as the portable data boundary for the camera framing delivery gate requirement.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-sensor-gate-delivery-mapping Types `IAutoMovieShotPerformance` for the clv sensor gate delivery mapping system contract.
 */
export interface IAutoMovieShotPerformance {
  /**
   * Id of the scene node performing.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Exposes `node` as the portable data boundary for the camera framing delivery gate requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-sensor-gate-delivery-mapping Types `node` for the clv sensor gate delivery mapping system contract.
   */
  node: string;

  /**
   * Id of the motion clip it plays, or `null` to hold its pose.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Exposes `motion` as the portable data boundary for the camera framing delivery gate requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-sensor-gate-delivery-mapping Types `motion` for the clv sensor gate delivery mapping system contract.
   */
  motion: string | null;

  /**
   * Seconds into the shot at which this performance begins.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Exposes `startOffset` as the portable data boundary for the camera framing delivery gate requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-sensor-gate-delivery-mapping Types `startOffset` for the clv sensor gate delivery mapping system contract.
   */
  startOffset: number;
}
