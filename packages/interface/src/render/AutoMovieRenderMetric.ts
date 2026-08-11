/**
 * The closed set of render costs a production can budget and a report can
 * answer for.
 *
 * The list is closed on purpose. A budget whose metric names are free strings
 * cannot be checked: a typo silently becomes an unbudgeted quantity, and a
 * report cannot state that an analysis is missing because it never knew the
 * analysis existed. Every metric here appears in every report exactly once,
 * carrying either a measured number or the reason there is none, which is what
 * makes the report a bounded, complete answer rather than a variable-length
 * dump of whatever happened to be computed.
 *
 * Units:
 *
 * - `materials`, `textures`, `lights`, `shadowMaps`, `nodes`, `instanceSets`,
 *   `instanceChunks` and `fluidCells` are exact counts.
 * - `drawCalls` is an UPPER BOUND on the draw submissions one frame can issue,
 *   never an observed number: culling only ever lowers it.
 * - `triangles`, `vertices` and `instanceSlots` are exact for anything whose
 *   shape the design fixes, and UPPER BOUNDS wherever runtime state chooses how
 *   much of it draws: a slot picks a level of detail by distance, a fern bed
 *   grows to at most its recipe's worst case, and a water quad is skipped
 *   unless all four of its cells are wet. Every such choice only lowers the
 *   number, which is the one direction a budget can be checked in.
 * - `fluidParticles` is the declared emitter cap, likewise an upper bound: a
 *   spray never exceeds it and distance thinning cuts it further.
 * - `textureBytes` and `geometryBytes` are estimated device bytes.
 *
 * @evidence requirements/rendering/budgets.md#rendering-geometry-memory-budget Exposes `AutoMovieRenderMetric` as the portable data boundary for the rendering geometry memory budget requirement.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `AutoMovieRenderMetric` for the spec render budget preflight system contract.
 * @author Samchon
 */
export type AutoMovieRenderMetric =
  | "triangles"
  | "vertices"
  | "drawCalls"
  | "materials"
  | "textures"
  | "textureBytes"
  | "geometryBytes"
  | "lights"
  | "shadowMaps"
  | "nodes"
  | "instanceSets"
  | "instanceSlots"
  | "instanceChunks"
  | "fluidCells"
  | "fluidParticles";

/**
 * Every metric, in the fixed order a report lists them.
 *
 * A pure type package cannot hold a runtime array, so the ordering lives here
 * as a tuple type and the engine derives its single runtime constant from it.
 * Report order is fixed so two reports of the same production diff line by
 * line.
 *
 * @evidence requirements/rendering/budgets.md#rendering-runtime-budget-enforcement Exposes `AutoMovieRenderMetricOrder` as the portable data boundary for the rendering runtime budget enforcement requirement.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Types `AutoMovieRenderMetricOrder` for the spec render budget preflight system contract.
 */
export type AutoMovieRenderMetricOrder = [
  "triangles",
  "vertices",
  "drawCalls",
  "materials",
  "textures",
  "textureBytes",
  "geometryBytes",
  "lights",
  "shadowMaps",
  "nodes",
  "instanceSets",
  "instanceSlots",
  "instanceChunks",
  "fluidCells",
  "fluidParticles",
];

/**
 * Why a metric carries no measured number.
 *
 * - `unsupported`: this repository has no analysis for the quantity the design
 *   declares. A water body without a fluid solver is unsupported, and saying so
 *   is the whole point: an absent analysis reported as a passing budget is a
 *   false capability claim.
 * - `not-run`: the analysis exists but its input was not supplied, so it did not
 *   execute. Texture bytes without texture dimensions is the canonical case.
 *
 * Neither is ever collapsed into zero, and neither is ever collapsed into
 * `within`.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-texture-decode Exposes `AutoMovieRenderAnalysisStatus` as the portable data boundary for the rendering texture decode requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `AutoMovieRenderAnalysisStatus` for the spec render material color system contract.
 */
export type AutoMovieRenderAnalysisStatus = "unsupported" | "not-run";
