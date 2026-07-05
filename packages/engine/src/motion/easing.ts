import { AutoMovieEasing } from "@automovie/interface";

/**
 * Evaluate a normalized easing curve: maps a linear progress `t` in `[0, 1]`
 * between two keyframes to an eased progress in `[0, 1]`.
 *
 * Covers the named {@link AutoMovieEasing} curves. `cubicBezier` is handled
 * separately by {@link cubicBezierEasing} since it needs the keyframe's control
 * points; passing `"cubicBezier"` here falls back to linear.
 *
 * @author Samchon
 */
export const ease = (curve: AutoMovieEasing, t: number): number => {
  if (!Number.isFinite(t)) throw new Error("easing progress must be finite");
  const x = Math.min(1, Math.max(0, t));
  switch (curve) {
    case "linear":
      return x;
    case "easeIn":
      return x * x;
    case "easeOut":
      return 1 - (1 - x) * (1 - x);
    case "easeInOut":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "step":
      return x < 1 ? 0 : 1;
    case "cubicBezier":
      return x; // needs control points — see cubicBezierEasing
  }
  throw new Error(`unknown easing curve "${String(curve)}"`);
};

/**
 * Evaluate a CSS-style cubic Bézier easing `[x1, y1, x2, y2]` at progress `t`.
 *
 * Solves the parametric x(s) = t for the curve parameter `s` (Newton with a
 * bisection fallback), then returns y(s). Endpoints are fixed at (0,0)–(1,1).
 *
 * @author Samchon
 */
export const cubicBezierEasing = (
  control: readonly [number, number, number, number],
  t: number,
): number => {
  if (!Number.isFinite(t)) throw new Error("easing progress must be finite");
  for (const value of control)
    if (!Number.isFinite(value))
      throw new Error("cubic bezier control points must be finite");

  const [x1, y1, x2, y2] = control;
  const x = Math.min(1, Math.max(0, t));
  const bez = (a: number, b: number, s: number): number => {
    const c = 3 * a;
    const d = 3 * (b - a) - c;
    const e = 1 - c - d;
    return ((e * s + d) * s + c) * s;
  };
  const dbez = (a: number, b: number, s: number): number => {
    const c = 3 * a;
    const d = 3 * (b - a) - c;
    const e = 1 - c - d;
    return (3 * e * s + 2 * d) * s + c;
  };

  let s = x;
  for (let i = 0; i < 8; ++i) {
    const dx = bez(x1, x2, s) - x;
    if (Math.abs(dx) < 1e-5) break;
    const slope = dbez(x1, x2, s);
    if (Math.abs(slope) < 1e-6) break;
    s -= dx / slope;
  }
  s = Math.min(1, Math.max(0, s));
  return bez(y1, y2, s);
};
