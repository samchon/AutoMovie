/**
 * How a track interpolates between its keyframes, mirroring glTF animation
 * sampler interpolation so clips round-trip with glTF/VRMA.
 *
 * - `linear` — straight blend (slerp for rotation channels).
 * - `step` — hold the previous keyframe's value until the next (snappy /
 *   robotic).
 * - `cubicspline` — Hermite spline; the track's `values` carry three elements per
 *   keyframe (in-tangent, value, out-tangent), tangents scaled by segment
 *   duration, per the glTF convention.
 *
 * @author Samchon
 */
export type MoticaInterpolation = "linear" | "step" | "cubicspline";
