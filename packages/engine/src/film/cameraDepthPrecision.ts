import {
  IAutoMovieCameraDepthPrecisionConstraint,
  IAutoMovieCameraDepthPrecisionReport,
} from "@automovie/interface";

const finiteOrNull = (value: number): number | null =>
  Number.isFinite(value) ? value : null;

/**
 * Evaluate the worst adjacent standard perspective depth step intersecting one
 * required camera-space range.
 *
 * For `levels = 2^bits - 1`, normalized depth is
 * `q(z) = (1/near - 1/z) / (1/near - 1/far)`. Its reciprocal inverse gives the
 * exact eye-space depth at an integer code. Adjacent spacing grows monotonically
 * with depth, so the cell ending at or containing `requiredFar` is the unique
 * worst cell the closed required range needs. Equality with the authored
 * maximum passes.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Measures the current required camera-space range against the authored near, far, minimum bit capability, and maximum adjacent step in metres.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Produces the addressed deterministic required-range depth precision report for a standard fixed-point perspective buffer.
 */
export const evaluateAutoMovieCameraDepthPrecision = (props: {
  /** Stable scene camera identity. */
  camera: string;
  /** Shot-local sample time. */
  time: number;
  /** Positive near clip distance in metres. */
  near: number;
  /** Ordered far clip distance in metres. */
  far: number;
  /** Nearest required camera-space depth. */
  requiredNear: number;
  /** Farthest required camera-space depth. */
  requiredFar: number;
  /** Authored measurable depth precision boundary. */
  constraint: IAutoMovieCameraDepthPrecisionConstraint;
}): IAutoMovieCameraDepthPrecisionReport => {
  const base = {
    camera: props.camera,
    time: finiteOrNull(props.time),
    metric: "maximum-adjacent-depth-step" as const,
    unit: "meters" as const,
    near: finiteOrNull(props.near),
    far: finiteOrNull(props.far),
    requiredNear: finiteOrNull(props.requiredNear),
    requiredFar: finiteOrNull(props.requiredFar),
    minimumDepthBits: finiteOrNull(props.constraint.minimumDepthBits),
    maximumStepMeters: finiteOrNull(props.constraint.maximumStepMeters),
  };
  const levels = 2 ** props.constraint.minimumDepthBits - 1;
  if (
    props.camera.trim().length === 0 ||
    !Number.isFinite(props.time) ||
    props.time < 0 ||
    !Number.isFinite(props.near) ||
    props.near <= 0 ||
    !Number.isFinite(props.far) ||
    props.far <= props.near ||
    !Number.isFinite(props.requiredNear) ||
    !Number.isFinite(props.requiredFar) ||
    props.requiredNear > props.requiredFar ||
    !Number.isSafeInteger(props.constraint.minimumDepthBits) ||
    props.constraint.minimumDepthBits <= 0 ||
    !Number.isSafeInteger(levels) ||
    !Number.isFinite(props.constraint.maximumStepMeters) ||
    props.constraint.maximumStepMeters <= 0
  )
    return {
      ...base,
      lowerCode: null,
      upperCode: null,
      measuredStepMeters: null,
      status: "invalid",
      passed: false,
    };
  if (props.requiredNear < props.near || props.requiredFar > props.far)
    return {
      ...base,
      lowerCode: null,
      upperCode: null,
      measuredStepMeters: null,
      status: "outside-clipping-range",
      passed: false,
    };
  const reciprocalNear = 1 / props.near;
  const reciprocalSpan = reciprocalNear - 1 / props.far;
  const normalized = (reciprocalNear - 1 / props.requiredFar) / reciprocalSpan;
  const upperCode = Math.ceil(Math.min(1, Math.max(0, normalized)) * levels);
  const lowerCode = Math.max(0, upperCode - 1);
  const depthAtCode = (code: number): number =>
    1 / (reciprocalNear - (code / levels) * reciprocalSpan);
  const measuredStepMeters = depthAtCode(upperCode) - depthAtCode(lowerCode);
  if (!Number.isFinite(measuredStepMeters) || measuredStepMeters < 0)
    return {
      ...base,
      lowerCode: null,
      upperCode: null,
      measuredStepMeters: null,
      status: "invalid",
      passed: false,
    };
  const passed = measuredStepMeters <= props.constraint.maximumStepMeters;
  return {
    ...base,
    lowerCode,
    upperCode,
    measuredStepMeters,
    status: passed ? "satisfied" : "insufficient-precision",
    passed,
  };
};
