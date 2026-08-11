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
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Exposes `IAutoMovieTrack` as the portable data boundary for the motion sparse channel default requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieTrack` for the performance motion clip keytime interpolation system contract.
 * @author Samchon
 */
export interface IAutoMovieTrack {
  /**
   * The channel this track animates.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Exposes `channel` as the portable data boundary for the motion sparse channel default requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `channel` for the performance motion clip keytime interpolation system contract.
   */
  channel: IAutoMovieChannel;

  /**
   * Keyframe timestamps in seconds. Strictly increasing, first `>= 0`; the
   * engine's temporal validator enforces this (not the rough type).
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Exposes `times` as the portable data boundary for the motion sparse channel default requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `times` for the performance motion clip keytime interpolation system contract.
   */
  times: number[];

  /**
   * Keyframe values, flattened. Length is `times.length × channelWidth` (× 3
   * for `cubicspline`). The channel's value type sets `channelWidth`.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Exposes `values` as the portable data boundary for the motion sparse channel default requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `values` for the performance motion clip keytime interpolation system contract.
   */
  values: number[];

  /**
   * How to interpolate between keyframes.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Exposes `interpolation` as the portable data boundary for the motion sparse channel default requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `interpolation` for the performance motion clip keytime interpolation system contract.
   */
  interpolation: AutoMovieInterpolation;
}

/**
 * A clip: a named bundle of flat-accessor tracks sharing one local-seconds
 * timeline. The general track form: its tracks may drive a character's bones, a
 * camera's transform and FOV, a prop's hinge, and a face's morph weights all at
 * once.
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
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `IAutoMovieClip` as the portable data boundary for the motion clip refusal requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieClip` for the performance motion clip keytime interpolation system contract.
 * @author Samchon
 */
export interface IAutoMovieClip {
  /**
   * Stable id.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `id` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `id` for the performance motion clip keytime interpolation system contract.
   */
  id: string;

  /**
   * Human / LLM readable name. Null if unnamed.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `name` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `name` for the performance motion clip keytime interpolation system contract.
   */
  name: string | null;

  /**
   * Total length in seconds. Every track time should be `<= duration`.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `duration` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `duration` for the performance motion clip keytime interpolation system contract.
   */
  duration: number;

  /**
   * Whether the clip loops seamlessly.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `loop` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `loop` for the performance motion clip keytime interpolation system contract.
   */
  loop: boolean;

  /**
   * The tracks; each targets one channel.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `tracks` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `tracks` for the performance motion clip keytime interpolation system contract.
   */
  tracks: IAutoMovieTrack[];
}
