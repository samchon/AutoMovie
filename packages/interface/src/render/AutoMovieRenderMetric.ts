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
 * - `triangles`, `vertices`, `materials`, `textures`, `lights`, `shadowMaps`,
 *   `nodes`, `instanceSets`, `instanceSlots`, `instanceChunks`, `fluidCells`
 *   and `fluidParticles` are exact counts.
 * - `drawCalls` is an UPPER BOUND on the draw submissions one frame can issue,
 *   never an observed number: culling only ever lowers it.
 * - `textureBytes` and `geometryBytes` are estimated device bytes.
 *
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
 */
export type AutoMovieRenderAnalysisStatus = "unsupported" | "not-run";
