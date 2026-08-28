import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * One camera-local spherical volume used for physical clearance.
 *
 * A sphere is intentionally conservative. Its size does not shrink while the
 * camera or its host rig rotates, so an interval swept from two fixed-clock
 * states cannot expose a corner the declared envelope forgot to carry.
 * `center` permits an asymmetric camera body or a rig extending behind the
 * optical origin without turning the portable boundary into renderer geometry.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance Exposes the camera-local body or rig volume whose contact with current scene geometry is refused.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Types the rotation-invariant physical envelope sampled by the camera-path clearance gate.
 * @author Samchon
 */
export interface IAutoMovieCameraClearanceSphere {
  /** Camera-local centre in metres. */
  center: IAutoMovieVector3;

  /** Conservative physical radius in metres, finite and greater than zero. */
  radius: number;
}

/**
 * Physical envelopes carried by one authored and resolved camera.
 *
 * The camera body always has an envelope. A parent rig is explicit when the
 * camera rides a dolly, crane, vehicle mount, stabilizer, or other support whose
 * volume can collide even while the camera body itself remains clear.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance Makes camera-body and optional parent-rig clearance independently declarable.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Preserves the two physical owners the path evaluator reports separately.
 * @author Samchon
 */
export interface IAutoMovieCameraClearanceEnvelope {
  /** Optical body, lens, cage, and immediately carried camera hardware. */
  body: IAutoMovieCameraClearanceSphere;

  /** Parent support rig, or `null` when the camera has no separate host rig. */
  parentRig: IAutoMovieCameraClearanceSphere | null;
}

/**
 * One conservative contact found over a fixed-clock camera interval.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-dynamic-spatial-sampling Exposes the exact interval, envelope owner, and scene obstacle that failed the swept comparison.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Types the addressed finding returned instead of accepting a penetrating camera path.
 * @author Samchon
 */
export interface IAutoMovieCameraClearanceFinding {
  /** Camera or parent-rig envelope that contacted scene geometry. */
  part: "body" | "parent-rig";

  /** Stable scene-node identity whose current bound was contacted. */
  obstacle: string;

  /** Inclusive shot-local interval start in seconds. */
  start: number;

  /** Inclusive shot-local interval end in seconds. */
  end: number;
}

/**
 * Reproducible physical-clearance result for one realized camera take.
 *
 * The report binds the exact geometry revision and endpoint-inclusive fixed
 * clock used for evaluation. A stale report is never a clear report, even when
 * its old geometry happened to contain no contact.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-geometry-revision Prevents clearance measured from an obsolete scene revision from becoming current evidence.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Carries the deterministic sample plan and addressed contact set used to admit or refuse the take.
 * @author Samchon
 */
export interface IAutoMovieCameraClearanceReport {
  /** Scene camera identity evaluated. */
  camera: string;

  /** Scene geometry revision read by the evaluator. */
  revision: string;

  /** Revision the caller declared current at evaluation time. */
  currentRevision: string;

  /** Endpoint-inclusive inspection samples per second. */
  sampleRate: number;

  /** Number of adjacent sample intervals evaluated. */
  intervals: number;

  /** Whether current geometry was clear, blocked, or stale. */
  status: "clear" | "blocked" | "stale";

  /** Stable interval-ordered contacts; empty for clear and stale reports. */
  findings: IAutoMovieCameraClearanceFinding[];
}

/**
 * A perspective camera: the viewpoint a frame is rendered from.
 *
 * The camera is what turns a posed scene into the image/video output that
 * motivates automovie as a diffusion alternative: place the rig, place the
 * camera, and the deterministic renderer bakes the frame. Fields map onto
 * `three.js` `PerspectiveCamera`.
 *
 * **An arbitrary clipping plane is deliberately not a field here.** `near` and
 * `far` are the only clipping this camera declares, and a cutaway — the cut
 * that removes a roof or a wall so a floor plan can be read in one image — is
 * owned by inspection instead (`IAutoMovieSectionPlane` and
 * `classifyAutoMovieSectionPlaneBox` in `@automovie/engine`,
 * `applyAutoMovieSectionPlanes` in `@automovie/viewer`). The reason is which
 * picture is on trial: a shot is judged on the image it delivers, so an
 * observation made after a wall was removed is a diagram about the production
 * and not evidence about that image, exactly as the subject-review surface
 * already says of an angle the work did not author. Admitting a plane here
 * would also make delivery acceptance depend on it — a required subject sliced
 * in half could no longer be counted as read — and would oblige every guide
 * pass to agree on the same section, all of it paid in the delivery lane for a
 * frame nothing delivers. It reopens the day a production must deliver a
 * cutaway AS a shot; at that point the plane becomes an authored field here,
 * `realizeShotContract` must count clipped-away subjects as unreadable, and the
 * `outline`, `mask` and `depth` passes must be shown to cut identically.
 *
 * **Nothing fills the exposed section either.** A cut wall reads as an open
 * shell rather than a solid, because capping it is a boolean against watertight
 * solids and a new cap material per mesh — a modelling operation, not a viewing
 * one — while a blocking-pass reviewer is reading placement, extent and
 * clearance, which an open shell shows correctly. That reopens with the same
 * condition: a delivered cutaway frame, where a hollow shell would be a defect.
 *
 * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `IAutoMovieCamera` as the portable data boundary for the camera focal fov requirement.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `IAutoMovieCamera` for the clv lens basis consistency system contract.
 * @author Samchon
 */
export interface IAutoMovieCamera {
  /**
   * Stable id.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `id` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `id` for the clv lens basis consistency system contract.
   */
  id: string;

  /**
   * World placement of the camera (it looks down its local −Z, glTF
   * convention).
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `transform` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `transform` for the clv lens basis consistency system contract.
   */
  transform: IAutoMovieTransform;

  /**
   * Vertical field of view in degrees, `(0, 180)`.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `fovY` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `fovY` for the clv lens basis consistency system contract.
   */
  fovY: number;

  /**
   * Near clip plane distance, meters.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `near` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `near` for the clv lens basis consistency system contract.
   */
  near: number;

  /**
   * Far clip plane distance, meters. Must exceed `near`.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `far` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `far` for the clv lens basis consistency system contract.
   */
  far: number;

  /**
   * Physical camera-body and optional parent-rig clearance envelopes.
   *
   * Optional for legacy scenes. When present, a shot compiler must evaluate
   * this camera on the current scene revision before publishing the take.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance Carries the declared physical body and support volumes into the resolved scene.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Supplies the envelopes consumed by deterministic swept-path refusal.
   */
  clearance?: IAutoMovieCameraClearanceEnvelope;
}
