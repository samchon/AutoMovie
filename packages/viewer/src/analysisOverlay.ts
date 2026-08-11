import { IAutoMovieAnalysisRun } from "@automovie/interface";
import * as THREE from "three";

/**
 * A viewer-owned field overlay bound to one analysis run.
 *
 * @author Samchon
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Displays a declared scalar analysis channel through a deterministic range and color mapping.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the same surface inside the declared render-product boundary.
 */
export interface IAutoMovieAnalysisOverlayObject {
  /**
   * Add these points to the current scene.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Displays the declared spatial samples of the analysis channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the same surface inside the declared render-product boundary.
   */
  object: THREE.Points;

  /**
   * Release the geometry, and the material when this object created it.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Releases the viewer resources used by the analysis-channel display.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the same surface inside the declared render-product boundary.
   */
  dispose: () => void;

  /**
   * Points drawn, one per spatial sample of the chosen metric.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Reports the spatial sample count drawn for the analysis channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the same surface inside the declared render-product boundary.
   */
  count: () => number;

  /**
   * The value range the colour ramp was normalized over.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Reports the numeric range used to encode the analysis channel.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the same surface inside the declared render-product boundary.
   */
  range: () => { min: number; max: number };
}

/**
 * Map a normalized `[0, 1]` position on the ramp to a colour.
 *
 * A three-stop blue-green-red ramp, interpolated linearly in each channel. It
 * is written out rather than sampled from a texture so the same input produces
 * the same colour in a live viewer and in a headless capture, on any host.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Maps the declared normalized analysis position to a deterministic display color.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the same surface inside the declared render-product boundary.
 */
export const autoMovieAnalysisRampColor = (
  position: number,
): { r: number; g: number; b: number } => {
  const t = Math.min(1, Math.max(0, position));
  if (t <= 0.5) {
    const local = t * 2;
    return { r: 0, g: local, b: 1 - local };
  }
  const local = (t - 0.5) * 2;
  return { r: local, g: 1 - local, b: 0 };
};

/**
 * Draw one analysis result as a field of coloured points.
 *
 * The overlay consumes exactly the artifact the report consumes, so a heatmap
 * and a verdict can never disagree about what was measured. That is also why it
 * refuses more than it draws: an `unsupported` or `not-run` run, a metric key
 * the run never carried, a metric that produced no value, and a metric with no
 * spatial field each throw with the run's own reason attached. A picture is the
 * most persuasive artifact a review sees, and a heatmap of an analysis nobody
 * ran would be the most effective way to launder a missing result.
 *
 * The ramp is normalized over the drawn samples unless the caller pins a
 * domain, which is what lets two instants of the same study be compared against
 * one scale instead of each being stretched to its own. A field whose values
 * are all equal is drawn at the middle of the ramp rather than dividing by a
 * zero span.
 *
 * @author Samchon
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Materializes declared scalar samples, range, and positions as an analysis-channel overlay.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps the same surface inside the declared render-product boundary.
 */
export const buildAnalysisOverlayObject = (props: {
  /** Run to draw. */
  run: IAutoMovieAnalysisRun;
  /** Metric key whose spatial field is drawn. */
  metric: string;
  /**
   * Point size in world metres for the material this call creates; defaults to
   * `0.1`. A lent {@link material} keeps its own size, because the caller that
   * built it already decided.
   */
  size?: number;
  /** Explicit ramp domain; defaults to the drawn samples' own range. */
  domain?: { min: number; max: number };
  /** Point material; a vertex-coloured default is created when absent. */
  material?: THREE.PointsMaterial;
}): IAutoMovieAnalysisOverlayObject => {
  const { run } = props;
  if (run.outcome.status !== "solved")
    throw new Error(
      `analysis run "${run.id}" is "${run.outcome.status}", so it has no field to draw: ${run.outcome.reason}`,
    );
  const metric = run.outcome.metrics.find(
    (entry) => entry.key === props.metric,
  );
  if (metric === undefined)
    throw new Error(
      `analysis run "${run.id}" carries no metric "${props.metric}" to draw`,
    );
  if (metric.value === null)
    throw new Error(
      `analysis run "${run.id}" produced no value for "${props.metric}", so it has no field to draw: ${metric.gap!.reason}`,
    );
  const samples = run.outcome.samples.filter(
    (sample) => sample.key === props.metric,
  );
  if (samples.length === 0)
    throw new Error(
      `analysis run "${run.id}" measured "${props.metric}" but recorded no spatial samples of it, so there is no field to draw`,
    );
  const size = props.size ?? 0.1;
  if (!Number.isFinite(size) || size <= 0)
    throw new Error(
      `an analysis overlay point size must be a finite number above zero, but was ${size}`,
    );

  const values = samples.map((sample) => sample.value);
  const min = props.domain?.min ?? Math.min(...values);
  const max = props.domain?.max ?? Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min)
    throw new Error(
      `an analysis overlay ramp domain must be a finite range with max at or above min, but was [${min}, ${max}]`,
    );
  const span = max - min;

  const positions = new Float32Array(samples.length * 3);
  const colors = new Float32Array(samples.length * 3);
  samples.forEach((sample, index) => {
    positions[index * 3] = sample.position.x;
    positions[index * 3 + 1] = sample.position.y;
    positions[index * 3 + 2] = sample.position.z;
    // A flat field has no spread to normalize, so it is drawn at the middle of
    // the ramp: the alternative is a division by zero that paints every sample
    // the same accidental colour.
    const color = autoMovieAnalysisRampColor(
      span === 0 ? 0.5 : (sample.value - min) / span,
    );
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const owned = props.material === undefined;
  const material =
    props.material ??
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      sizeAttenuation: true,
    });
  const object = new THREE.Points(geometry, material);
  object.name = `analysis:${run.id}:${props.metric}`;
  object.userData.autoMovieAnalysis = {
    run: run.id,
    domain: run.domain,
    metric: metric.key,
    unit: metric.unit,
    status: metric.status,
    min,
    max,
    digest: run.digest,
  };
  return {
    object,
    dispose: () => {
      geometry.dispose();
      if (owned) material.dispose();
    },
    count: () => samples.length,
    range: () => ({ min, max }),
  };
};
