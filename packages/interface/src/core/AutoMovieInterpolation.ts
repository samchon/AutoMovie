/**
 * How a track interpolates between its keyframes, mirroring glTF animation
 * sampler interpolation so clips round-trip with glTF/VRMA.
 *
 * - `linear`: straight blend (slerp for rotation channels).
 * - `step`: hold the previous keyframe's value until the next (snappy / robotic).
 * - `cubicspline`: Hermite spline; the track's `values` carry three elements per
 *   keyframe (in-tangent, value, out-tangent), tangents scaled by segment
 *   duration, per the glTF convention.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation Exposes `AutoMovieInterpolation` as the portable data boundary for the motion interpolation requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `AutoMovieInterpolation` for the performance motion clip keytime interpolation system contract.
 * @author Samchon
 */
export type AutoMovieInterpolation = "linear" | "step" | "cubicspline";
