/**
 * Production-authoring languages with a complete bundled contract pack.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Names the exact language-specific authoring routes the scaffold can publish.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Exposes the finite language-contract capability inventory without supplying production content.
 */
export const AUTO_MOVIE_PRODUCTION_LANGUAGES = [
  "chinese",
  "english",
  "japanese",
  "korean",
] as const;

/**
 * One exact language contract selected by a generated production.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Keeps the selected authoring language in portable tracked input.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Makes language selection an explicit source input rather than a host default.
 */
export type AutoMovieProductionLanguage =
  (typeof AUTO_MOVIE_PRODUCTION_LANGUAGES)[number];

/**
 * True when a value selects one complete bundled language contract.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery Refuses an unknown language rather than routing to an undeclared authoring surface.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-failure-gap Distinguishes a supported contract pack from an unavailable language capability.
 */
export const isAutoMovieProductionLanguage = (
  value: unknown,
): value is AutoMovieProductionLanguage =>
  typeof value === "string" &&
  (AUTO_MOVIE_PRODUCTION_LANGUAGES as readonly string[]).includes(value);
