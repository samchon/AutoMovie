import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";
import { AutoMovieRenderMetric } from "./AutoMovieRenderMetric";
import { IAutoMovieRenderTarget } from "./IAutoMovieRenderTarget";

/**
 * A bounded verdict: every budgeted render cost, what it measured, and who pays
 * for it.
 *
 * The report is deliberately O(1) in the size of the production. It carries one
 * finding per metric and at most
 * {@link AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS} dominant owners per finding,
 * with the remainder counted rather than listed. A report that grew with the
 * scene would be the thing nobody reads on the artifact that most needs
 * reading, and truncating silently would make it a lie, so the omitted owners
 * and their omitted cost are both stated.
 *
 * A finding never reports a missing analysis as a pass. `unsupported` and
 * `not-run` are first-class outcomes that make the whole report `incomplete`,
 * because "we did not look" and "we looked and it was fine" are different facts
 * and only one of them clears an artifact.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderReport` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderReport` for the spec render artifact lifecycle system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderReport {
  /**
   * Report format.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `version` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `version` for the spec render artifact lifecycle system contract.
   */
  version: 1;

  /**
   * Versioned report protocol.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `protocol` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `protocol` for the spec render artifact lifecycle system contract.
   */
  protocol: "automovie.render-report.v1";

  /**
   * Quality tier the budget declared.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `tier` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `tier` for the spec render artifact lifecycle system contract.
   */
  tier: string;

  /**
   * Worst outcome across findings: `over` when any budgeted metric exceeds its
   * limit, otherwise `incomplete` when any metric is `unsupported` or
   * `not-run`, otherwise `within`.
   *
   * `within` means exactly "nothing measured exceeded a declared limit and no
   * analysis is missing". It does NOT mean the production is budgeted: a legacy
   * production that declares no budget reports `within` with every finding
   * `unbudgeted` and the tier spelled `unbudgeted`, which is the documented
   * default and is deliberately distinguishable from a production that declared
   * limits and met them.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `status` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `status` for the spec render artifact lifecycle system contract.
   */
  status: "within" | "over" | "incomplete";

  /**
   * One finding per metric, in the fixed metric order.
   *
   * Fixed length, so the report's size never depends on how large the
   * production is.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `findings` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `findings` for the spec render artifact lifecycle system contract.
   */
  findings: IAutoMovieRenderFinding[];

  /**
   * Digest of the semantic mask this report is evidence beside.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `mask` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `mask` for the spec render artifact lifecycle system contract.
   */
  mask: AutoMovieContentDigest;

  /**
   * Renderer, settings and assets the measurement is bound to.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `target` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `target` for the spec render artifact lifecycle system contract.
   */
  target: IAutoMovieRenderTarget;

  /**
   * Digest over the protocol, tier, findings, mask digest and target digest.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `digest` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `digest` for the spec render artifact lifecycle system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * How one metric came out.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `AutoMovieRenderFindingStatus` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `AutoMovieRenderFindingStatus` for the spec render artifact lifecycle system contract.
 */
export type AutoMovieRenderFindingStatus =
  | "within"
  | "over"
  | "unbudgeted"
  | "unsupported"
  | "not-run";

/**
 * One metric's measurement, limit, dominant owners, and way back.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderFinding` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderFinding` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderFinding {
  /**
   * Metric this finding answers for.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `metric` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `metric` for the spec render artifact lifecycle system contract.
   */
  metric: AutoMovieRenderMetric;

  /**
   * Outcome.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `status` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `status` for the spec render artifact lifecycle system contract.
   */
  status: AutoMovieRenderFindingStatus;

  /**
   * Measured value, or `null` when the analysis produced none.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `measured` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `measured` for the spec render artifact lifecycle system contract.
   */
  measured: number | null;

  /**
   * Inclusive declared limit, or `null` when the metric is unbudgeted.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `limit` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `limit` for the spec render artifact lifecycle system contract.
   */
  limit: number | null;

  /**
   * How far above the limit the measurement is; zero unless `over`.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `excess` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `excess` for the spec render artifact lifecycle system contract.
   */
  excess: number;

  /**
   * Dominant owners, descending by cost then ascending by owner id.
   *
   * Bounded by {@link AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS}. Ties break on
   * the id so the list is deterministic rather than dependent on the order the
   * inventory happened to visit owners.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `contributors` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `contributors` for the spec render artifact lifecycle system contract.
   */
  contributors: IAutoMovieRenderContributor[];

  /**
   * Owners the bound left out.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `omittedContributors` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `omittedContributors` for the spec render artifact lifecycle system contract.
   */
  omittedContributors: number;

  /**
   * Total cost carried by the owners the bound left out.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `omittedCost` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `omittedCost` for the spec render artifact lifecycle system contract.
   */
  omittedCost: number;

  /**
   * Exactly what to change, or `null` when nothing is wrong.
   *
   * Present for `over`, `unsupported` and `not-run`; absent for `within` and
   * `unbudgeted`.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `recovery` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `recovery` for the spec render artifact lifecycle system contract.
   */
  recovery: string | null;
}

/**
 * One owner's share of one metric, as the report states it.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderContributor` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderContributor` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderContributor {
  /**
   * Stable owner id.
   *
   * For a cost that paints pixels this is a semantic-mask id, so the report and
   * the mask name the same thing. Shared resources that draw nothing of their
   * own carry a `model:`, `material:`, `texture:` or `light:` identity instead:
   * attributing one shared texture to every node that binds it would count its
   * bytes once per node and describe a memory cost nobody pays.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `owner` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `owner` for the spec render artifact lifecycle system contract.
   */
  owner: string;

  /**
   * Editable source location the author changes to lower this cost.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `source` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `source` for the spec render artifact lifecycle system contract.
   */
  source: string;

  /**
   * Exact contribution in the metric's unit.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `cost` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `cost` for the spec render artifact lifecycle system contract.
   */
  cost: number;
}
