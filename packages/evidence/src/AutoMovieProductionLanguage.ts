/**
 * Production-authoring languages with a complete bundled contract pack.
 *
 * @evidence requirements/agent-authoring/production-language.md#agent-production-language-contract Defines the exact supported creation-time choices without a host default.
 * @evidence specifications/authoring-and-authority/production-language.md#spec-authoring-production-language-module Owns the canonical tuple consumed by every language selector.
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
 * @evidence requirements/agent-authoring/production-language.md#agent-production-language-contract Carries one supported language identity through tracked project input.
 * @evidence specifications/authoring-and-authority/production-language.md#spec-authoring-production-language-module Types exactly one member of the canonical module inventory.
 * @author Samchon
 */
export type AutoMovieProductionLanguage =
  (typeof AUTO_MOVIE_PRODUCTION_LANGUAGES)[number];

/**
 * True when a value selects one complete bundled language contract.
 *
 * @evidence requirements/agent-authoring/production-language.md#agent-production-language-contract Refuses values outside the supported production-language modules.
 * @evidence specifications/authoring-and-authority/production-language.md#spec-authoring-production-language-module Implements the closed predicate against the canonical tuple.
 * @author Samchon
 */
export const isAutoMovieProductionLanguage = (
  value: unknown,
): value is AutoMovieProductionLanguage =>
  typeof value === "string" &&
  (AUTO_MOVIE_PRODUCTION_LANGUAGES as readonly string[]).includes(value);
