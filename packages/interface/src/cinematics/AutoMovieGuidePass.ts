/**
 * One diffusion-guide render pass over the same deterministic frame.
 *
 * A automovie render is not the final image; it is the stable performance a
 * generative video pass paints over. Each pass name selects what the viewer
 * draws for a frame so a diffusion workflow (ControlNet-style conditioning) can
 * follow the structure automovie computed:
 *
 * - `beauty`: the ordinary shaded render (the default preview).
 * - `depth`: depth-to-grayscale on a scene-stable metric range, the depth hint.
 * - `mask`: per-scene-node flat silhouette colors, the segmentation hint.
 * - `normal`: the unlit surface-normal render, the normal-map hint (#1166).
 * - `outline`: real white silhouette edges on black (an inverted-hull contour),
 *   the line/edge hint (#1166); no host post-processing required.
 * - `pose`: the skeleton overlay: bone segments over a flat background, the pose
 *   hint.
 *
 * Closed union so an invalid pass name is structurally impossible at the LLM
 * surface; the render/viewer packages carry the matching runtime list.
 *
 * @author Samchon
 */
export type AutoMovieGuidePass =
  /** Ordinary shaded render. */
  | "beauty"
  /** Depth-to-grayscale conditioning pass. */
  | "depth"
  /** Per-node flat-color segmentation pass. */
  | "mask"
  /** Unlit surface-normal pass. */
  | "normal"
  /** Silhouette edge pass: white contour lines on black. */
  | "outline"
  /** Skeleton-overlay pose pass. */
  | "pose";
