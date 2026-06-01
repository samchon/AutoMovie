import { IMoticaChannel } from "./IMoticaChannel";
import { MoticaInterpolation } from "./MoticaInterpolation";

/**
 * One animation track: a stream of keyframes driving a single channel over
 * time. Mirrors a glTF animation channel+sampler pair, generalized so the
 * target is any {@link IMoticaChannel} (node TRS, morph weights, or a
 * pointer-addressed property like a camera FOV or material factor).
 *
 * `times` and `values` are parallel flat arrays (glTF accessor style): `times`
 * is keyframe timestamps in seconds; `values` is the keyframe values flattened,
 * its width per keyframe set by the channel's value type (and ×3 for
 * `cubicspline`, which stores in-tangent/value/out-tangent triplets).
 *
 * @author Samchon
 */
export interface IMoticaTrack {
  /** The channel this track animates. */
  channel: IMoticaChannel;

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
  interpolation: MoticaInterpolation;
}

/**
 * A clip: a named bundle of tracks sharing one local-seconds timeline. The
 * universal motion unit — its tracks may drive a character's bones, a camera's
 * transform and FOV, a prop's hinge, and a face's morph weights all at once.
 *
 * Replaces the humanoid-only motion type as the general form; a humanoid clip
 * is one whose tracks target bone-rotation channels under the humanoid
 * profile's retarget discipline (rotation-only except the root).
 *
 * @author Samchon
 */
export interface IMoticaClip {
  /** Stable id. */
  id: string;

  /** Human / LLM readable name. Null if unnamed. */
  name: string | null;

  /** Total length in seconds. Every track time should be `<= duration`. */
  duration: number;

  /** Whether the clip loops seamlessly. */
  loop: boolean;

  /** The tracks; each targets one channel. */
  tracks: IMoticaTrack[];
}
