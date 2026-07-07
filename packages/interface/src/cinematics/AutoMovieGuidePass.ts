/**
 * One diffusion-guide render pass over the same deterministic frame.
 *
 * A automovie render is not the final image — it is the stable performance a
 * generative video pass paints over. Each pass name selects what the viewer
 * draws for a frame so a diffusion workflow (ControlNet-style conditioning) can
 * follow the structure automovie computed:
 *
 * - `beauty` — the ordinary shaded render (the default preview).
 * - `depth` — depth-to-grayscale (near bright, far dark), the depth hint.
 * - `mask` — per-scene-node flat silhouette colors, the segmentation hint.
 * - `outline` — the normal-based edge source: an unlit surface-normal render from
 *   which line extraction is a cheap host post-process (a true vector outline
 *   pass is a later refinement).
 * - `pose` — the skeleton overlay: bone segments over a flat background, the pose
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
  /** Normal-based edge-source pass (line extraction is a host post-process). */
  | "outline"
  /** Skeleton-overlay pose pass. */
  | "pose";
