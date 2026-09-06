/**
 * The authored Markdown families shared by production graphs and readers.
 *
 * Contracts and population accounts describe obligations on this population;
 * they are not themselves authored work to include in an edition or reference
 * response. Keeping the family identity here lets both readers select the same
 * work without executing the graph declaration.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Names the authored document families whose actual hosts participate in production ownership.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Gives graph and reader selection one authored family identity without executing a project declaration.
 */
export const AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS = [
  "briefs",
  "instances",
  "maps",
  "materials",
  "models",
  "motions",
  "research",
  "screenplays",
  "scripts",
  "settings",
  "spaces",
  "systems",
  "treatments",
] as const;

/**
 * One authored Markdown family selected by a graph, edition, or reference read.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Types the authored family whose actual hosts are selected.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Shares the same family identity across graph selection and reference adapters.
 */
export type AutoMovieAuthoredDocumentLayer =
  (typeof AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS)[number];
