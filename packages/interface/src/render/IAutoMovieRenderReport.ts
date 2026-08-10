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
 * @author Samchon
 */
export interface IAutoMovieRenderReport {
  /** Report format. */
  version: 1;

  /** Versioned report protocol. */
  protocol: "automovie.render-report.v1";

  /** Quality tier the budget declared. */
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
   */
  status: "within" | "over" | "incomplete";

  /**
   * One finding per metric, in the fixed metric order.
   *
   * Fixed length, so the report's size never depends on how large the
   * production is.
   */
  findings: IAutoMovieRenderFinding[];

  /** Digest of the semantic mask this report is evidence beside. */
  mask: AutoMovieContentDigest;

  /** Renderer, settings and assets the measurement is bound to. */
  target: IAutoMovieRenderTarget;

  /** Digest over the protocol, tier, findings, mask digest and target digest. */
  digest: AutoMovieContentDigest;
}

/** How one metric came out. */
export type AutoMovieRenderFindingStatus =
  | "within"
  | "over"
  | "unbudgeted"
  | "unsupported"
  | "not-run";

/** One metric's measurement, limit, dominant owners, and way back. */
export interface IAutoMovieRenderFinding {
  /** Metric this finding answers for. */
  metric: AutoMovieRenderMetric;

  /** Outcome. */
  status: AutoMovieRenderFindingStatus;

  /** Measured value, or `null` when the analysis produced none. */
  measured: number | null;

  /** Inclusive declared limit, or `null` when the metric is unbudgeted. */
  limit: number | null;

  /** How far above the limit the measurement is; zero unless `over`. */
  excess: number;

  /**
   * Dominant owners, descending by cost then ascending by owner id.
   *
   * Bounded by {@link AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS}. Ties break on
   * the id so the list is deterministic rather than dependent on the order the
   * inventory happened to visit owners.
   */
  contributors: IAutoMovieRenderContributor[];

  /** Owners the bound left out. */
  omittedContributors: number;

  /** Total cost carried by the owners the bound left out. */
  omittedCost: number;

  /**
   * Exactly what to change, or `null` when nothing is wrong.
   *
   * Present for `over`, `unsupported` and `not-run`; absent for `within` and
   * `unbudgeted`.
   */
  recovery: string | null;
}

/** One owner's share of one metric, as the report states it. */
export interface IAutoMovieRenderContributor {
  /**
   * Stable owner id.
   *
   * For a cost that paints pixels this is a semantic-mask id, so the report and
   * the mask name the same thing. Shared resources that draw nothing of their
   * own carry a `model:`, `material:`, `texture:` or `light:` identity instead:
   * attributing one shared texture to every node that binds it would count its
   * bytes once per node and describe a memory cost nobody pays.
   */
  owner: string;

  /** Editable source location the author changes to lower this cost. */
  source: string;

  /** Exact contribution in the metric's unit. */
  cost: number;
}
