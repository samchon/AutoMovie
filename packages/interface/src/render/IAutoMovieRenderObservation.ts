import { AutoMovieRenderMetric } from "./AutoMovieRenderMetric";

/**
 * Renderer-observed cost of one already drawn frame.
 *
 * This record carries measurements only. It does not choose a budget, infer a
 * renderer, or decide whether a production passes. A `null` field means that
 * the renderer cannot report that dimension for this frame; it must remain
 * unchecked instead of being approximated from scene membership.
 *
 * @evidence requirements/rendering/budgets.md#rendering-runtime-budget-enforcement Carries the current-frame observations that can be compared with a declared budget.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Represents the observed side of the planned-versus-rendered budget audit.
 * @author Samchon
 */
export interface IAutoMovieRenderObservation {
  /**
   * Rendered mesh count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-geometry-memory-budget Reports observed geometry work without choosing its limit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  meshes: number | null;
  /**
   * Submitted draw-call count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Reports observed per-frame submission work.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  drawCalls: number | null;
  /**
   * Rendered triangle count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-geometry-memory-budget Reports observed geometry work without choosing its limit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  triangles: number | null;
  /**
   * Distinct material count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Reports one observed per-frame resource count.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  materials: number | null;
  /**
   * Distinct texture count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-geometry-memory-budget Reports observed texture pressure without choosing its limit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  textures: number | null;
  /**
   * Active light count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Reports one observed per-frame resource count.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  lights: number | null;
  /**
   * Active shadow-map count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Reports one observed per-frame resource count.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  shadowMaps: number | null;
  /**
   * Addressed instance-slot count.
   *
   * @evidence requirements/rendering/budgets.md#rendering-expansion-bounds Reports the observed bounded expansion of instanced content.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries one observed budget metric.
   */
  instanceSlots: number | null;
}

/**
 * One observed metric that exceeds its preflight inventory bound.
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-refusal Names the exact observed metric and boundary involved in a refusal.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries a deterministic comparison result without selecting the budget.
 * @author Samchon
 */
export interface IAutoMovieRenderObservationBreach {
  /**
   * Metric whose observation exceeded its bound.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-refusal Identifies the budget dimension responsible for the breach.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Joins the observed value to the corresponding report metric.
   */
  metric: AutoMovieRenderMetric;
  /**
   * Exact or conservative preflight estimate recorded as `finding.measured`.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision Preserves the exact or conservative estimated value used for comparison.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries the preflight inventory bound rather than the production's maximum limit.
   */
  bound: number;
  /**
   * Renderer-observed value.
   *
   * @evidence requirements/rendering/budgets.md#rendering-runtime-budget-enforcement Preserves the runtime observation used for comparison.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Carries the observed side of the comparison.
   */
  observed: number;
}
