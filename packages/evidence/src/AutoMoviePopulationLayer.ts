/**
 * An authored film layer whose unit-file population can participate in a
 * vertical-slice authoring scope.
 *
 * Treatments remain flat because they own no delivery partition. Scripts
 * design that partition, and screenplays inherit it exactly.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the scoped authored population an explicit project-owned input.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Names the closed narrative-layer vocabulary accepted by the population selector.
 */
export type AutoMoviePopulationLayer = "screenplays" | "scripts" | "treatments";
