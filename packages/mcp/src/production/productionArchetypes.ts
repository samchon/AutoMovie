import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";

export type {
  AutoMovieModelArchetypeRegistry,
  IAutoMovieModelArchetype,
} from "@automovie/archetypes";
export {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";

/**
 * The archetype catalogue this server registers, and the only one it assumes.
 *
 * This is the registration seam. The design gate and the materializer resolve
 * `archetype` through a registry they are handed; they never name a member. A
 * host that ships a different catalogue registers it here or passes its own
 * registry to `AutoMovieProductionProject.open`, and every recipe naming
 * something outside it is refused with a diagnostic rather than silently
 * built.
 */
export const AUTOMOVIE_REGISTERED_ARCHETYPES: AutoMovieModelArchetypeRegistry =
  createAutoMovieArchetypeRegistry(AUTOMOVIE_PRIMITIVE_ARCHETYPES);
