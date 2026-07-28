/**
 * Compatibility name for the coding-agent-first production application.
 *
 * New code should use {@link AutoMovieApplication}. The old 47-operation
 * authoring facade is now {@link AutoMovieLegacyApplication}.
 */
export { AutoMovieApplication as AutoMovieProductionApplication } from "./AutoMovieApplication";
