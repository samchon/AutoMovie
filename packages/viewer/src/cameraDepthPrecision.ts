import type { IAutoMovieCamera } from "@automovie/interface";
import * as THREE from "three";

/**
 * Observable viewer capability result for one resolved production camera.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Reports whether the viewer applies the authored clip range on a standard depth buffer with at least the declared bit capability.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Preserves the renderer capability and source-to-Three projection parity beside the engine's standard fixed-point metric.
 * @author Samchon
 */
export interface IAutoMovieViewerCameraDepthPrecisionReport {
  /** Stable resolved camera identity. */
  camera: string;

  /** Authored near distance in camera-space metres, or null when non-finite. */
  sourceNear: number | null;

  /** Authored far distance in camera-space metres, or null when non-finite. */
  sourceFar: number | null;

  /** Near distance installed on the Three camera, or null when non-finite. */
  realizedNear: number | null;

  /** Far distance installed on the Three camera, or null when non-finite. */
  realizedFar: number | null;

  /** Authored minimum fixed-point depth bits, or null when non-finite. */
  minimumDepthBits: number | null;

  /** Default-framebuffer `DEPTH_BITS`, or null when the query is not numeric. */
  observedDepthBits: number | null;

  /** Depth projection mode observed from the renderer. */
  projection: "standard" | "logarithmic" | "reversed" | "logarithmic-reversed";

  /** Closed capability and parity outcome. */
  status:
    | "satisfied"
    | "invalid-source"
    | "projection-mismatch"
    | "nonstandard-projection"
    | "invalid-capability"
    | "insufficient-capability";

  /** Whether clip, projection mode, and depth bits match the declaration. */
  passed: boolean;
}

const finiteOrNull = (value: number): number | null =>
  Number.isFinite(value) ? value : null;

/**
 * Observe the default framebuffer and compare it with one resolved camera.
 *
 * The engine's metric is conservative at `minimumDepthBits`; a standard viewer
 * with at least that many actual bits can only provide equal or finer adjacent
 * steps. Logarithmic and reversed projection are refused because they implement
 * a different metric rather than silently appearing as extra capability.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Applies the same authored near, far, and minimum depth bits to the actual viewer camera and default framebuffer.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Observes `DEPTH_BITS` and standard projection mode while checking source-to-runtime clip parity.
 */
export const evaluateAutoMovieViewerCameraDepthPrecision = (props: {
  /** Viewer renderer whose default framebuffer will draw the shot. */
  renderer: THREE.WebGLRenderer;
  /** Portable resolved camera declaration. */
  source: Pick<IAutoMovieCamera, "id" | "near" | "far" | "depthPrecision">;
  /** Three camera built from that declaration. */
  realized: THREE.PerspectiveCamera;
}): IAutoMovieViewerCameraDepthPrecisionReport => {
  const logarithmic = props.renderer.capabilities.logarithmicDepthBuffer;
  const reversed = props.renderer.capabilities.reverseDepthBuffer;
  const projection: IAutoMovieViewerCameraDepthPrecisionReport["projection"] =
    logarithmic
      ? reversed
        ? "logarithmic-reversed"
        : "logarithmic"
      : reversed
        ? "reversed"
        : "standard";
  const context = props.renderer.getContext();
  const observed = context.getParameter(context.DEPTH_BITS) as unknown;
  const observedDepthBits =
    typeof observed === "number" && Number.isFinite(observed) ? observed : null;
  const base = {
    camera: props.source.id,
    sourceNear: finiteOrNull(props.source.near),
    sourceFar: finiteOrNull(props.source.far),
    realizedNear: finiteOrNull(props.realized.near),
    realizedFar: finiteOrNull(props.realized.far),
    minimumDepthBits: finiteOrNull(
      props.source.depthPrecision.minimumDepthBits,
    ),
    observedDepthBits,
    projection,
  };
  const levels = 2 ** props.source.depthPrecision.minimumDepthBits - 1;
  if (
    props.source.id.trim().length === 0 ||
    !Number.isFinite(props.source.near) ||
    props.source.near <= 0 ||
    !Number.isFinite(props.source.far) ||
    props.source.far <= props.source.near ||
    !Number.isSafeInteger(props.source.depthPrecision.minimumDepthBits) ||
    props.source.depthPrecision.minimumDepthBits <= 0 ||
    !Number.isSafeInteger(levels) ||
    !Number.isFinite(props.source.depthPrecision.maximumStepMeters) ||
    props.source.depthPrecision.maximumStepMeters <= 0
  )
    return { ...base, status: "invalid-source", passed: false };
  if (
    props.realized.near !== props.source.near ||
    props.realized.far !== props.source.far
  )
    return { ...base, status: "projection-mismatch", passed: false };
  if (projection !== "standard")
    return { ...base, status: "nonstandard-projection", passed: false };
  if (
    observedDepthBits === null ||
    !Number.isSafeInteger(observedDepthBits) ||
    observedDepthBits < 0
  )
    return { ...base, status: "invalid-capability", passed: false };
  if (observedDepthBits < props.source.depthPrecision.minimumDepthBits)
    return { ...base, status: "insufficient-capability", passed: false };
  return { ...base, status: "satisfied", passed: true };
};

/**
 * Refuse a viewer that cannot reproduce the engine's declared depth metric.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Prevents a frame from rendering after clip, projection mode, or depth capability diverges from the evaluated camera.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Makes viewer parity an executable gate rather than an informational capability string.
 */
export const assertAutoMovieViewerCameraDepthPrecision = (
  props: Parameters<typeof evaluateAutoMovieViewerCameraDepthPrecision>[0],
): IAutoMovieViewerCameraDepthPrecisionReport => {
  const report = evaluateAutoMovieViewerCameraDepthPrecision(props);
  if (report.passed === false)
    throw new Error(
      `Camera depth precision refused "${report.camera}": ${report.status}; ` +
        `clip ${String(report.sourceNear)}..${String(report.sourceFar)}m became ` +
        `${String(report.realizedNear)}..${String(report.realizedFar)}m on ` +
        `${report.projection} depth with ${String(report.observedDepthBits)} bits ` +
        `(minimum ${String(report.minimumDepthBits)}).`,
    );
  return report;
};
