import {
  AutoMovieRenderAnalysisStatus,
  AutoMovieRenderMetric,
} from "./AutoMovieRenderMetric";

/**
 * What one frame of a production actually costs the renderer, measured from the
 * compiled artifact rather than guessed from the design.
 *
 * The inventory is the evidence a budget is checked against, and it is
 * deliberately separate from that check so that a headless capture and a live
 * viewer can read one measurement instead of each counting for itself. The
 * render job's budget preflight measures it. Nothing on the viewer side does:
 * the viewer package answers the other question instead, counting what a scene
 * graph actually submitted, and nothing holds the two answers against each
 * other, so a disagreement between them is a defect the report could name
 * rather than one it does. Nothing here is an observation of a frame that was
 * drawn; these are the exact quantities the compiled artifact commits the
 * renderer to, so the numbers exist before any GPU does.
 *
 * The three per-kind arrays below are not a complete decomposition of the
 * totals. A cloth panel, a planting cluster and a water surface are none of a
 * model, a texture or an instance set, so their cost reaches a reader through
 * {@link totals}, {@link owners} and {@link gaps} alone; summing the arrays would
 * come up short by exactly the things a room is furnished with.
 *
 * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `IAutoMovieRenderInventory` as the portable data boundary for the rendering frame total budget requirement.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `IAutoMovieRenderInventory` for the spec render budget preflight system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderInventory {
  /**
   * Inventory format.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `version` as the portable data boundary for the rendering frame total budget requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `version` for the spec render budget preflight system contract.
   */
  version: 1;

  /**
   * Per-model geometry cost, ascending by model id.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `models` as the portable data boundary for the rendering frame total budget requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `models` for the spec render budget preflight system contract.
   */
  models: IAutoMovieRenderModelCost[];

  /**
   * Unique texture assets cited by drawn materials, ascending by asset id.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `textures` as the portable data boundary for the rendering frame total budget requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `textures` for the spec render budget preflight system contract.
   */
  textures: IAutoMovieRenderTextureCost[];

  /**
   * Per-instance-set batching cost, ascending by set id.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `instanceSets` as the portable data boundary for the rendering frame total budget requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `instanceSets` for the spec render budget preflight system contract.
   */
  instanceSets: IAutoMovieRenderInstanceSetCost[];

  /**
   * Exact scalar totals; a metric with no measurement is `null`.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `totals` as the portable data boundary for the rendering frame total budget requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `totals` for the spec render budget preflight system contract.
   */
  totals: IAutoMovieRenderTotals;

  /**
   * Owners of each metric's cost, ascending by owner id.
   *
   * The report bounds this into a short dominant-contributor list; the
   * inventory keeps the complete attribution so a consumer can sum it back to
   * the total.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `owners` as the portable data boundary for the rendering frame total budget requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `owners` for the spec render budget preflight system contract.
   */
  owners: IAutoMovieRenderOwnerCost[];

  /**
   * Analyses that did not produce a number, and why.
   *
   * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Exposes `gaps` as the portable data boundary for the rendering frame total budget requirement.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `gaps` for the spec render budget preflight system contract.
   */
  gaps: IAutoMovieRenderAnalysisGap[];
}

/**
 * Every metric's measured value, or `null` when it was not measured.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderTotals` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderTotals` for the spec render artifact lifecycle system contract.
 */
export type IAutoMovieRenderTotals = {
  [metric in AutoMovieRenderMetric]: number | null;
};

/**
 * One model's exact geometry cost at one level of detail.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderModelCost` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderModelCost` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderModelCost {
  /**
   * Runtime model id.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `model` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `model` for the spec render artifact lifecycle system contract.
   */
  model: string;

  /**
   * Level-of-detail tier this row measures, or `null` for a model placed
   * directly by a scene node rather than selected by distance.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `tier` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `tier` for the spec render artifact lifecycle system contract.
   */
  tier: "hero" | "near" | "far" | null;

  /**
   * Exact drawable part count; one part is one draw submission.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `parts` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `parts` for the spec render artifact lifecycle system contract.
   */
  parts: number;

  /**
   * Exact vertex count over every part.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `vertices` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `vertices` for the spec render artifact lifecycle system contract.
   */
  vertices: number;

  /**
   * Exact triangle count over every part.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `triangles` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `triangles` for the spec render artifact lifecycle system contract.
   */
  triangles: number;

  /**
   * Distinct material ids cited by the parts.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `materials` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `materials` for the spec render artifact lifecycle system contract.
   */
  materials: string[];

  /**
   * Estimated device bytes of vertex attributes and indices.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `geometryBytes` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `geometryBytes` for the spec render artifact lifecycle system contract.
   */
  geometryBytes: number;
}

/**
 * One unique texture asset and the device memory it is estimated to occupy.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-texture-decode Exposes `IAutoMovieRenderTextureCost` as the portable data boundary for the rendering texture decode requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `IAutoMovieRenderTextureCost` for the spec render material color system contract.
 */
export interface IAutoMovieRenderTextureCost {
  /**
   * Project asset id cited by a material binding.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-texture-decode Exposes `asset` as the portable data boundary for the rendering texture decode requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `asset` for the spec render material color system contract.
   */
  asset: string;

  /**
   * Material ids that bind this asset, ascending.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-texture-decode Exposes `materials` as the portable data boundary for the rendering texture decode requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `materials` for the spec render material color system contract.
   */
  materials: string[];

  /**
   * Estimated device bytes, or `null` when the asset's dimensions were not
   * supplied. A `null` here is what turns the `textureBytes` metric into
   * `not-run` instead of an invented number.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-texture-decode Exposes `bytes` as the portable data boundary for the rendering texture decode requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `bytes` for the spec render material color system contract.
   */
  bytes: number | null;
}

/**
 * One instance set's batching cost.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderInstanceSetCost` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderInstanceSetCost` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderInstanceSetCost {
  /**
   * Compiled instance-set id.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `instanceSet` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `instanceSet` for the spec render artifact lifecycle system contract.
   */
  instanceSet: string;

  /**
   * Exact designed slot count.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `slots` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `slots` for the spec render artifact lifecycle system contract.
   */
  slots: number;

  /**
   * Exact independently regenerable chunk count.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `chunks` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `chunks` for the spec render artifact lifecycle system contract.
   */
  chunks: number;

  /**
   * Exact prototype count; a legacy single-prototype set reports one.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `prototypes` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `prototypes` for the spec render artifact lifecycle system contract.
   */
  prototypes: number;

  /**
   * Upper bound on draw submissions: one per chunk, per prototype, per drawn
   * part of the prototype's most expensive level of detail. Frustum and LOD
   * selection only ever lower it.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `drawCallUpperBound` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `drawCallUpperBound` for the spec render artifact lifecycle system contract.
   */
  drawCallUpperBound: number;
}

/**
 * One owner's share of one metric.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderOwnerCost` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderOwnerCost` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderOwnerCost {
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
   * Metric this row contributes to.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `metric` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `metric` for the spec render artifact lifecycle system contract.
   */
  metric: AutoMovieRenderMetric;

  /**
   * Exact contribution in the metric's unit.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `cost` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `cost` for the spec render artifact lifecycle system contract.
   */
  cost: number;
}

/**
 * One analysis that produced no number, and the exact reason.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderAnalysisGap` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderAnalysisGap` for the spec render artifact lifecycle system contract.
 */
export interface IAutoMovieRenderAnalysisGap {
  /**
   * Metric left without a measurement.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `metric` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `metric` for the spec render artifact lifecycle system contract.
   */
  metric: AutoMovieRenderMetric;

  /**
   * Whether the analysis is missing entirely or merely did not execute.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `status` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `status` for the spec render artifact lifecycle system contract.
   */
  status: AutoMovieRenderAnalysisStatus;

  /**
   * Exactly what is absent, naming the declaration that needed it.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `reason` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `reason` for the spec render artifact lifecycle system contract.
   */
  reason: string;

  /**
   * Exactly what would make the analysis produce a number.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `remedy` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `remedy` for the spec render artifact lifecycle system contract.
   */
  remedy: string;
}
