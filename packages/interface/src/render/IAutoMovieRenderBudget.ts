import { AutoMovieRenderMetric } from "./AutoMovieRenderMetric";

/**
 * The hard render cost a production declares it will stay inside, per quality
 * tier.
 *
 * A budget is a design decision, not a measurement: it is authored beside the
 * production it constrains rather than read back off it. That direction
 * matters. Numbers derived from whatever the current scene happens to cost
 * would ratify every regression the moment it lands, so no limit here is ever
 * inferred from an inventory; a production that declares no budget is reported
 * as unbudgeted rather than silently given one.
 *
 * Declaring a budget is not a check running. No compile scope reads
 * `renderBudgets`, so nothing refuses an artifact for exceeding one; a
 * production's own code picks the tier a render targets and evaluates it with
 * `evaluateAutoMovieRenderBudget` against the engine's inventory.
 *
 * Limits are inclusive: a measurement exactly equal to its limit is inside the
 * budget. An omitted metric is unbudgeted, which the report states explicitly
 * so an author can tell "allowed to be large" from "nobody thought about it".
 *
 * @author Samchon
 */
export interface IAutoMovieRenderBudget {
  /** Budget format. */
  version: 1;

  /**
   * Non-blank quality tier this budget describes, such as `review` or
   * `delivery`. One production may declare several tiers and check an artifact
   * against the one a render job targets.
   */
  tier: string;

  /**
   * Inclusive maximum per metric. An omitted metric is unbudgeted.
   *
   * Every value is a finite number at or above zero. The engine range-checks
   * them, because a negative or fractional triangle limit is an authoring
   * mistake that would otherwise read as a permanently failing budget.
   */
  limits: Partial<Record<AutoMovieRenderMetric, number>>;
}
