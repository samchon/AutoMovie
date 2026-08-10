import {
  AutoMovieRenderAnalysisStatus,
  AutoMovieRenderMetric,
} from "./AutoMovieRenderMetric";

/**
 * What one frame of a production actually costs the renderer, measured from the
 * compiled artifact rather than guessed from the design.
 *
 * The inventory is the evidence a budget is checked against, and it is
 * deliberately separate from that check: the same numbers are read by the
 * headless capture path and by the live viewer, and a disagreement between the
 * two is a defect the report can name. Nothing here is an observation of a
 * frame that was drawn; these are the exact quantities the compiled artifact
 * commits the renderer to, so the numbers exist before any GPU does.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderInventory {
  /** Inventory format. */
  version: 1;

  /** Per-model geometry cost, ascending by model id. */
  models: IAutoMovieRenderModelCost[];

  /** Unique texture assets cited by drawn materials, ascending by asset id. */
  textures: IAutoMovieRenderTextureCost[];

  /** Per-instance-set batching cost, ascending by set id. */
  instanceSets: IAutoMovieRenderInstanceSetCost[];

  /** Exact scalar totals; a metric with no measurement is `null`. */
  totals: IAutoMovieRenderTotals;

  /**
   * Owners of each metric's cost, ascending by owner id.
   *
   * The report bounds this into a short dominant-contributor list; the
   * inventory keeps the complete attribution so a consumer can sum it back to
   * the total.
   */
  owners: IAutoMovieRenderOwnerCost[];

  /** Analyses that did not produce a number, and why. */
  gaps: IAutoMovieRenderAnalysisGap[];
}

/** Every metric's measured value, or `null` when it was not measured. */
export type IAutoMovieRenderTotals = {
  [metric in AutoMovieRenderMetric]: number | null;
};

/** One model's exact geometry cost at one level of detail. */
export interface IAutoMovieRenderModelCost {
  /** Runtime model id. */
  model: string;

  /**
   * Level-of-detail tier this row measures, or `null` for a model placed
   * directly by a scene node rather than selected by distance.
   */
  tier: "hero" | "near" | "far" | null;

  /** Exact drawable part count; one part is one draw submission. */
  parts: number;

  /** Exact vertex count over every part. */
  vertices: number;

  /** Exact triangle count over every part. */
  triangles: number;

  /** Distinct material ids cited by the parts. */
  materials: string[];

  /** Estimated device bytes of vertex attributes and indices. */
  geometryBytes: number;
}

/** One unique texture asset and the device memory it is estimated to occupy. */
export interface IAutoMovieRenderTextureCost {
  /** Project asset id cited by a material binding. */
  asset: string;

  /** Material ids that bind this asset, ascending. */
  materials: string[];

  /**
   * Estimated device bytes, or `null` when the asset's dimensions were not
   * supplied. A `null` here is what turns the `textureBytes` metric into
   * `not-run` instead of an invented number.
   */
  bytes: number | null;
}

/** One instance set's batching cost. */
export interface IAutoMovieRenderInstanceSetCost {
  /** Compiled instance-set id. */
  instanceSet: string;

  /** Exact designed slot count. */
  slots: number;

  /** Exact independently regenerable chunk count. */
  chunks: number;

  /** Exact prototype count; a legacy single-prototype set reports one. */
  prototypes: number;

  /**
   * Upper bound on draw submissions: one per chunk, per prototype, per drawn
   * part of the prototype's most expensive level of detail. Frustum and LOD
   * selection only ever lower it.
   */
  drawCallUpperBound: number;
}

/** One owner's share of one metric. */
export interface IAutoMovieRenderOwnerCost {
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

  /** Metric this row contributes to. */
  metric: AutoMovieRenderMetric;

  /** Exact contribution in the metric's unit. */
  cost: number;
}

/** One analysis that produced no number, and the exact reason. */
export interface IAutoMovieRenderAnalysisGap {
  /** Metric left without a measurement. */
  metric: AutoMovieRenderMetric;

  /** Whether the analysis is missing entirely or merely did not execute. */
  status: AutoMovieRenderAnalysisStatus;

  /** Exactly what is absent, naming the declaration that needed it. */
  reason: string;

  /** Exactly what would make the analysis produce a number. */
  remedy: string;
}
