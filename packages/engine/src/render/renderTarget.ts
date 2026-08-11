import {
  AutoMovieContentDigest,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
  IAutoMovieRenderTargetAsset,
  IAutoMovieRenderTargetRenderer,
  IAutoMovieRenderTargetSettings,
} from "@automovie/interface";

import {
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
} from "./renderDigest";

/**
 * Seal one render target: the renderer, its settings, and the exact asset bytes
 * a frame will read.
 *
 * The digest is taken over a field stream with explicit separators rather than
 * over `JSON.stringify`, because property order is an implementation detail of
 * whoever built the object and a fingerprint that changes with it would call
 * every second capture stale. Assets are sorted by UTF-16 code unit, never by
 * locale collation: a Turkish host must not fingerprint a different frame than
 * an English one, and `localeCompare` is exactly how that happens.
 *
 * Every field is validated. A zero-width buffer, a negative exposure, or a
 * malformed digest is an authoring or adapter defect, and a fingerprint that
 * accepted it would be a stable name for something that cannot be rendered.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-canonical-fingerprint Seals renderer identity, frame-affecting settings, and sorted asset digests into one canonical target fingerprint.
 * @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-cache-identity-integrity Binds reusable render evidence to the protocol, renderer, frame settings, and sorted dependency digests that determine its content.
 * @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-stale-cache-invalidation Makes any canonical renderer, setting, dependency membership, or dependency digest change produce a different target identity.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Implements the versioned render-target closure against which reports are measured and reused.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-target-fingerprint-protocol Includes the protocol revision and ordered field encoding in the fingerprint input rather than relying on object serialization.
 * @evidence specifications/execution-and-recovery/checkpoints-resume-cache-and-dependencies.md#execution-cache-identity-invalidation Seals the exact render inputs and sorted asset content identities used to invalidate a prior report after dependency drift.
 * @author Samchon
 */
export const sealAutoMovieRenderTarget = (props: {
  /** Who draws the frame. */
  renderer: IAutoMovieRenderTargetRenderer;
  /** Configuration that changes what a frame costs. */
  settings: IAutoMovieRenderTargetSettings;
  /** Assets the drawn frame depends on; order is normalized here. */
  assets: readonly IAutoMovieRenderTargetAsset[];
}): IAutoMovieRenderTarget => {
  const { renderer, settings } = props;
  for (const [field, value] of [
    ["api", renderer.api],
    ["vendor", renderer.vendor],
    ["device", renderer.device],
  ] as const)
    if (value.trim().length === 0)
      throw new Error(`render target renderer.${field} must be non-blank`);
  for (const [field, value] of [
    ["width", settings.width],
    ["height", settings.height],
  ] as const)
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(
        `render target settings.${field} must be a positive integer, but was ${value}`,
      );
  for (const [field, value] of [
    ["pixelRatio", settings.pixelRatio],
    ["exposure", settings.exposure],
  ] as const)
    if (!Number.isFinite(value) || value <= 0)
      throw new Error(
        `render target settings.${field} must be finite and above zero, but was ${value}`,
      );
  if (settings.shadows === (settings.shadowType === "none"))
    throw new Error(
      `render target settings.shadowType "${settings.shadowType}" contradicts shadows=${settings.shadows}`,
    );
  const assets = [...props.assets].sort((left, right) =>
    compareAutoMovieRenderIds(left.path, right.path),
  );
  const paths = new Set<string>();
  for (const asset of assets) {
    if (asset.path.trim().length === 0)
      throw new Error("render target asset path must be non-blank");
    if (paths.has(asset.path))
      throw new Error(
        `render target asset "${asset.path}" is declared more than once`,
      );
    paths.add(asset.path);
    if (/^sha256:[0-9a-f]{64}$/.test(asset.digest) === false)
      throw new Error(
        `render target asset "${asset.path}" must carry one exact lowercase SHA-256 digest, but carried "${asset.digest}"`,
      );
  }
  return {
    protocol: "automovie.render-target.v1",
    renderer,
    settings,
    assets,
    digest: autoMovieRenderDigest(
      [
        "automovie.render-target.v1",
        `renderer\t${renderer.api}\t${renderer.vendor}\t${renderer.device}`,
        `settings\t${settings.width}\t${settings.height}\t${settings.pixelRatio}\t${settings.shadows}\t${settings.shadowType}\t${settings.toneMapping}\t${settings.exposure}`,
        ...assets.map((asset) => `asset\t${asset.path}\t${asset.digest}`),
      ].join("\n"),
    ),
  };
};

/**
 * Why a report no longer describes the target in front of a consumer.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Records the concrete target difference that invalidates prior render evidence.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Makes freshness failure actionable without treating a changed target as equivalent.
 */
export interface IAutoMovieRenderTargetDrift {
  /**
   * What changed: the renderer, one setting, or one asset's bytes.
   *
   * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Identifies the dependency field whose revision made the report stale.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Locates drift within the renderer, settings, or asset closure.
   */
  field: string;
  /**
   * The value the report was measured against.
   *
   * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Preserves the target value bound into the prior evidence.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Retains the reported side of a target-identity comparison.
   */
  reported: string;
  /**
   * The value the current target carries.
   *
   * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Exposes the replacement value that requires remeasurement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Retains the current side of a target-identity comparison.
   */
  current: string;
}

/**
 * Decide whether a report is still evidence about the target in front of you.
 *
 * A budget verdict is a claim about a specific renderer drawing specific bytes
 * at a specific size. Change any of that and the verdict is not conservative,
 * it is wrong in an unknown direction: a smaller shadow map makes a failing
 * report pass and a larger one makes a passing report fail, and neither
 * re-measured anything. So a mismatch is `stale`, never `pass`, and every
 * differing field is named so the drift is actionable instead of mysterious.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Rejects reuse when renderer, settings, asset membership, or asset bytes differ from the reported target.
 * @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-cache-identity-integrity Compares every sealed render-input and dependency field before treating a prior report as reusable evidence.
 * @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-stale-cache-invalidation Marks the prior report stale and names each renderer, setting, asset membership, or digest drift instead of reusing it.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Compares every field in the sealed target closure and returns stable ordered drift.
 * @evidence specifications/execution-and-recovery/checkpoints-resume-cache-and-dependencies.md#execution-cache-identity-invalidation Implements render-report invalidation from the sealed canonical target comparison without claiming ownership of a general cache store.
 */
export const compareAutoMovieRenderTarget = (props: {
  /** The report being re-used as evidence. */
  report: IAutoMovieRenderReport;
  /** The target a consumer is about to render with. */
  current: IAutoMovieRenderTarget;
}): {
  /** Whether the report still describes the current target. */
  fresh: boolean;
  /** Every differing field, ascending; empty when fresh. */
  drift: IAutoMovieRenderTargetDrift[];
} => {
  const reported = props.report.target;
  const current = props.current;
  const drift: IAutoMovieRenderTargetDrift[] = [];
  const compare = (field: string, left: unknown, right: unknown): void => {
    if (String(left) !== String(right))
      drift.push({ field, reported: String(left), current: String(right) });
  };
  compare("renderer.api", reported.renderer.api, current.renderer.api);
  compare("renderer.vendor", reported.renderer.vendor, current.renderer.vendor);
  compare("renderer.device", reported.renderer.device, current.renderer.device);
  for (const key of [
    "width",
    "height",
    "pixelRatio",
    "shadows",
    "shadowType",
    "toneMapping",
    "exposure",
  ] as const)
    compare(`settings.${key}`, reported.settings[key], current.settings[key]);
  const currentAssets = new Map(
    current.assets.map((asset) => [asset.path, asset.digest]),
  );
  for (const asset of reported.assets)
    compare(
      `assets["${asset.path}"]`,
      asset.digest,
      currentAssets.get(asset.path) ?? "absent",
    );
  const reportedAssets = new Map(
    reported.assets.map((asset) => [asset.path, asset.digest]),
  );
  for (const asset of current.assets)
    if (!reportedAssets.has(asset.path))
      drift.push({
        field: `assets["${asset.path}"]`,
        reported: "absent",
        current: asset.digest,
      });
  drift.sort((left, right) =>
    compareAutoMovieRenderIds(left.field, right.field),
  );
  return { fresh: drift.length === 0, drift };
};

/**
 * Assets shorthand: pair paths with digests already proved elsewhere.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-frame-dependency-closure Converts every named asset dependency into the path-digest records sealed by the render target.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Sorts the supplied dependency closure before target fingerprinting.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-target-dependency-fingerprint Canonicalizes the declared render-content closure as sorted path-and-byte-digest roles for target identity.
 */
export const autoMovieRenderTargetAssets = (
  entries: Readonly<Record<string, AutoMovieContentDigest>>,
): IAutoMovieRenderTargetAsset[] =>
  Object.keys(entries)
    .sort(compareAutoMovieRenderIds)
    .map((path) => ({ path, digest: entries[path]! }));

/**
 * Read the reported and current digests, for a one-line staleness log.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale Summarizes whether a report remains current and names each dependency drift when it does not.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Exposes the sealed report and current target identities in a deterministic recovery message.
 */
export const autoMovieRenderTargetSummary = (props: {
  report: IAutoMovieRenderReport;
  current: IAutoMovieRenderTarget;
}): string => {
  const { fresh, drift } = compareAutoMovieRenderTarget(props);
  return fresh
    ? `fresh: ${props.report.target.digest}`
    : `stale: report ${props.report.target.digest} against current ${props.current.digest}; ${drift
        .map((entry) => `${entry.field} ${entry.reported} -> ${entry.current}`)
        .join(", ")}`;
};
