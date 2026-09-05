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
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderTarget` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderTarget` for the spec render artifact lifecycle system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderTarget {
  /**
   * Versioned fingerprint protocol.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `protocol` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `protocol` for the spec render artifact lifecycle system contract.
   */
  protocol: "automovie.render-target.v1";

  /**
   * Who draws the frame.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `renderer` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `renderer` for the spec render artifact lifecycle system contract.
   */
  renderer: IAutoMovieRenderTargetRenderer;

  /**
   * Renderer configuration that changes what a frame costs.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `settings` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `settings` for the spec render artifact lifecycle system contract.
   */
  settings: IAutoMovieRenderTargetSettings;

  /**
   * Every asset whose bytes the drawn frame depends on, ascending by path.
   *
   * Ordering is by UTF-16 code unit, never by locale collation, so a Turkish or
   * Swedish host does not fingerprint a different frame than an English one.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `assets` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `assets` for the spec render artifact lifecycle system contract.
   */
  assets: IAutoMovieRenderTargetAsset[];

  /**
   * Digest over the protocol and every field above.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `digest` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `digest` for the spec render artifact lifecycle system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * Renderer identity: what the frame is drawn by.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-identity-collision-corruption Exposes `IAutoMovieRenderTargetRenderer` as the portable data boundary for the rendering identity collision corruption requirement.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Types `IAutoMovieRenderTargetRenderer` for the spec render frame identity system contract.
 */
export interface IAutoMovieRenderTargetRenderer {
  /**
   * Graphics API family, such as `webgl2`.
   *
   * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-identity-collision-corruption Exposes `api` as the portable data boundary for the rendering identity collision corruption requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Types `api` for the spec render frame identity system contract.
   */
  api: string;

  /**
   * Reported hardware vendor, or `unknown` when the host withholds it.
   *
   * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-identity-collision-corruption Exposes `vendor` as the portable data boundary for the rendering identity collision corruption requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Types `vendor` for the spec render frame identity system contract.
   */
  vendor: string;

  /**
   * Reported device or renderer string, or `unknown`.
   *
   * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-identity-collision-corruption Exposes `device` as the portable data boundary for the rendering identity collision corruption requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Types `device` for the spec render frame identity system contract.
   */
  device: string;
}

/**
 * Renderer configuration that changes what a frame costs.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderTargetSettings` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderTargetSettings` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderTargetSettings {
  /**
   * Drawing-buffer width in pixels, a positive integer.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `width` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `width` for the spec render artifact lifecycle system contract.
   */
  width: number;

  /**
   * Drawing-buffer height in pixels, a positive integer.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `height` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `height` for the spec render artifact lifecycle system contract.
   */
  height: number;

  /**
   * Device pixel ratio applied to the drawing buffer, finite and above zero.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `pixelRatio` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `pixelRatio` for the spec render artifact lifecycle system contract.
   */
  pixelRatio: number;

  /**
   * Whether shadow maps are rendered at all.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `shadows` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `shadows` for the spec render artifact lifecycle system contract.
   */
  shadows: boolean;

  /**
   * Deterministic shadow-filter family, or `none` when shadows are off.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `shadowType` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `shadowType` for the spec render artifact lifecycle system contract.
   */
  shadowType: "none" | "pcf" | "pcfSoft" | "vsm";

  /**
   * Beauty-pass tone-mapping curve.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `toneMapping` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `toneMapping` for the spec render artifact lifecycle system contract.
   */
  toneMapping: "none" | "acesFilmic";

  /**
   * Renderer exposure multiplier, finite and above zero.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `exposure` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `exposure` for the spec render artifact lifecycle system contract.
   */
  exposure: number;
}

/**
 * One asset the drawn frame depends on.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderTargetAsset` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderTargetAsset` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderTargetAsset {
  /**
   * Canonical project-relative path.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `path` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `path` for the spec render artifact lifecycle system contract.
   */
  path: string;

  /**
   * SHA-256 of the exact bytes the frame will read.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `digest` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `digest` for the spec render artifact lifecycle system contract.
   */
  digest: AutoMovieContentDigest;
}
