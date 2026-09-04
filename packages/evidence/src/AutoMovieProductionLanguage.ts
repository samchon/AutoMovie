/**
 * Production-authoring languages with a complete bundled contract pack.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Names the exact language-specific authoring routes the scaffold can publish.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-production-language-contract Defines the closed creation-time language selection.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Exposes the finite language-contract capability inventory without supplying production content.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-production-language-module Defines the exact supported module vocabulary.
 * @author Samchon
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
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-production-language-contract Keeps the choice to one supported production language.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Makes language selection an explicit source input rather than a host default.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-production-language-module Carries the closed module selection into scaffold derivation.
 * @author Samchon
 */
export type AutoMovieProductionLanguage =
  (typeof AUTO_MOVIE_PRODUCTION_LANGUAGES)[number];

/**
 * True when a value selects one complete bundled language contract.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery Refuses an unknown language rather than routing to an undeclared authoring surface.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-production-language-contract Rejects values outside the supported production-language modules.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-failure-gap Distinguishes a supported contract pack from an unavailable language capability.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-production-language-module Implements the closed language-module predicate.
 * @author Samchon
 */
export const isAutoMovieProductionLanguage = (
  value: unknown,
): value is AutoMovieProductionLanguage =>
  typeof value === "string" &&
  (AUTO_MOVIE_PRODUCTION_LANGUAGES as readonly string[]).includes(value);
