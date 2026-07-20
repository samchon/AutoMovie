import { AutoMovieInterpolation } from "./AutoMovieInterpolation";
import { IAutoMovieChannel } from "./IAutoMovieChannel";

/**
 * One animation track: a stream of keyframes driving a single channel over
 * time. Mirrors a glTF animation channel+sampler pair, generalized so the
 * target is any {@link IAutoMovieChannel} (node TRS, morph weights, or a
 * pointer-addressed property like a camera FOV or material factor).
 *
 * `times` and `values` are parallel flat arrays (glTF accessor style): `times`
 * is keyframe timestamps in seconds; `values` is the keyframe values flattened,
 * its width per keyframe set by the channel's value type (and ×3 for
 * `cubicspline`, which stores in-tangent/value/out-tangent triplets).
 *
 * @author Samchon
 */
export interface IAutoMovieTrack {
  /** The channel this track animates. */
  channel: IAutoMovieChannel;

  /**
   * Keyframe timestamps in seconds. Strictly increasing, first `>= 0`; the
   * engine's temporal validator enforces this (not the rough type).
   */
  times: number[];

  /**
   * Keyframe values, flattened. Length is `times.length × channelWidth` (× 3
   * for `cubicspline`). The channel's value type sets `channelWidth`.
   */
  values: number[];

  /** How to interpolate between keyframes. */
  interpolation: AutoMovieInterpolation;
}

/**
 * A clip: a named bundle of flat-accessor tracks sharing one local-seconds
 * timeline. The general track form: its tracks may drive a character's bones,
 * a camera's transform and FOV, a prop's hinge, and a face's morph weights all
 * at once.
 *
 * Clip **coexists with** {@link IAutoMovieMotion}, it does not replace it: they
 * are two live forms for two jobs. Motion is the semantic keyframe-pose vehicle
 * an actor performs (`perform` produces it, `validateMotion` checks it, and
 * `IAutoMovieShot.performances` reference it by id); Clip is the general
 * flat-array track form the same shot carries for its `cameraMotion` and
 * `objectMotions` (a projectile or a prop has no skeleton, so it moves by
 * transform tracks, not a pose motion). A humanoid Motion lowers onto a Clip
 * through `motionToClip`: a clip whose tracks target bone-rotation channels
 * under the humanoid profile's retarget discipline (rotation-only except the
 * root), so one shot legitimately holds both representations at once.
 *
 * @author Samchon
 */
export interface IAutoMovieClip {
  /** Stable id. */
  id: string;

  /** Human / LLM readable name. Null if unnamed. */
  name: string | null;

  /** Total length in seconds. Every track time should be `<= duration`. */
  duration: number;

  /** Whether the clip loops seamlessly. */
  loop: boolean;

  /** The tracks; each targets one channel. */
  tracks: IAutoMovieTrack[];
}
