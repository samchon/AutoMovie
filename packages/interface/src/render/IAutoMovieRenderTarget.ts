import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";

/**
 * The exact renderer, settings, and asset bytes a render report was measured
 * against.
 *
 * A budget verdict is only evidence while the thing it measured is still the
 * thing that will be drawn. Change the shadow filter, the pixel ratio, or one
 * texture's bytes and the same design costs something else, so a report that
 * outlives its target is not conservative, it is wrong in an unknown direction.
 * The fingerprint makes that detectable: a consumer compares the report's
 * target against the target in front of it and treats a mismatch as stale
 * rather than as a pass.
 *
 * Everything here is deterministic and platform-independent by construction. No
 * timestamps, no absolute paths, no locale-dependent ordering: two machines
 * that will draw the same frame produce byte-identical fingerprints.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderTarget {
  /** Versioned fingerprint protocol. */
  protocol: "automovie.render-target.v1";

  /** Who draws the frame. */
  renderer: IAutoMovieRenderTargetRenderer;

  /** Renderer configuration that changes what a frame costs. */
  settings: IAutoMovieRenderTargetSettings;

  /**
   * Every asset whose bytes the drawn frame depends on, ascending by path.
   *
   * Ordering is by UTF-16 code unit, never by locale collation, so a Turkish or
   * Swedish host does not fingerprint a different frame than an English one.
   */
  assets: IAutoMovieRenderTargetAsset[];

  /** Digest over the protocol and every field above. */
  digest: AutoMovieContentDigest;
}

/** Renderer identity: what the frame is drawn by. */
export interface IAutoMovieRenderTargetRenderer {
  /** Graphics API family, such as `webgl2`. */
  api: string;

  /** Reported hardware vendor, or `unknown` when the host withholds it. */
  vendor: string;

  /** Reported device or renderer string, or `unknown`. */
  device: string;
}

/** Renderer configuration that changes what a frame costs. */
export interface IAutoMovieRenderTargetSettings {
  /** Drawing-buffer width in pixels, a positive integer. */
  width: number;

  /** Drawing-buffer height in pixels, a positive integer. */
  height: number;

  /** Device pixel ratio applied to the drawing buffer, finite and above zero. */
  pixelRatio: number;

  /** Whether shadow maps are rendered at all. */
  shadows: boolean;

  /** Deterministic shadow-filter family, or `none` when shadows are off. */
  shadowType: "none" | "pcf" | "pcfSoft" | "vsm";

  /** Beauty-pass tone-mapping curve. */
  toneMapping: "none" | "acesFilmic";

  /** Renderer exposure multiplier, finite and above zero. */
  exposure: number;
}

/** One asset the drawn frame depends on. */
export interface IAutoMovieRenderTargetAsset {
  /** Canonical project-relative path. */
  path: string;

  /** SHA-256 of the exact bytes the frame will read. */
  digest: AutoMovieContentDigest;
}
