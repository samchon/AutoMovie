/**
 * The interpolation curve used to blend from one keyframe to the next.
 *
 * Motion in automovie is **sparse keyframes + easing**, not dense per-frame
 * emission. The model places a handful of key poses and names how to glide
 * between them; the engine samples the curve at the consumer's frame rate. This
 * is what makes motion both cheap (few tokens) and temporally coherent (the
 * curve removes jitter that independent per-frame emission would introduce).
 *
 * The named curves cover the common ergonomic cases; `cubicBezier` is the
 * escape hatch for an explicit curve (control points carried on the keyframe).
 *
 * @author Samchon
 */
export type automovieEasing =
  /** Constant-rate linear blend. */
  | "linear"
  /** Slow start. */
  | "easeIn"
  /** Slow stop. */
  | "easeOut"
  /** Slow start and stop (most natural for body motion). */
  | "easeInOut"
  /** No blend ??hold, then jump at the next keyframe (snappy / robotic). */
  | "step"
  /** Explicit cubic B챕zier; control points supplied on the keyframe. */
  | "cubicBezier";
