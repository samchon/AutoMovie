import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
  IAutoMovieModelArchetype,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";

export type { AutoMovieModelArchetypeRegistry, IAutoMovieModelArchetype };
export { AUTOMOVIE_PRIMITIVE_ARCHETYPES, createAutoMovieArchetypeRegistry };

/**
 * The archetype catalogue this server registers, and the only one it assumes.
 *
 * This is the registration seam. The design gate and the materializer resolve
 * `archetype` through a registry they are handed; they never name a member. A
 * host that ships a different catalogue registers it here or passes its own
 * registry to `AutoMovieProductionProject.open`, and every recipe naming
 * something outside it is refused with a diagnostic rather than silently
 * built.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Publishes the actual registered archetype set so typed production hosts can replace or extend the catalogue explicitly.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Makes catalogue registration a code seam consumed by compiler and materializer rather than a hidden tool inventory.
 */
export const AUTOMOVIE_REGISTERED_ARCHETYPES: AutoMovieModelArchetypeRegistry =
  createAutoMovieArchetypeRegistry(AUTOMOVIE_PRIMITIVE_ARCHETYPES);
