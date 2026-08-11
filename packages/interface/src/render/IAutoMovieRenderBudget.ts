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
 * The check runs where the frame is made, not where the design is compiled. No
 * compile scope reads `renderBudgets`; the render job does, selecting the tier
 * it targets, measuring each shot against it, and failing rather than shipping
 * an `over` tier. A compile therefore never reports a budget breach, and a
 * design that compiles clean has not been cleared to render.
 *
 * Limits are inclusive: a measurement exactly equal to its limit is inside the
 * budget. An omitted metric is unbudgeted, which the report states explicitly
 * so an author can tell "allowed to be large" from "nobody thought about it".
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision Exposes `IAutoMovieRenderBudget` as the portable data boundary for the rendering budget decision requirement.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `IAutoMovieRenderBudget` for the spec render budget preflight system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderBudget {
  /**
   * Budget format.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision Exposes `version` as the portable data boundary for the rendering budget decision requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `version` for the spec render budget preflight system contract.
   */
  version: 1;

  /**
   * Non-blank quality tier this budget describes, such as `review` or
   * `delivery`. One production may declare several tiers and check an artifact
   * against the one a render job targets.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision Exposes `tier` as the portable data boundary for the rendering budget decision requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `tier` for the spec render budget preflight system contract.
   */
  tier: string;

  /**
   * Inclusive maximum per metric. An omitted metric is unbudgeted.
   *
   * Every value is a finite number at or above zero. The engine range-checks
   * them, because a negative or fractional triangle limit is an authoring
   * mistake that would otherwise read as a permanently failing budget.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision Exposes `limits` as the portable data boundary for the rendering budget decision requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `limits` for the spec render budget preflight system contract.
   */
  limits: Partial<Record<AutoMovieRenderMetric, number>>;
}
