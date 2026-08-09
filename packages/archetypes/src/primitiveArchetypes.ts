import {
  AutoMovieModelArchetypeRegistry,
  createAutoMovieArchetypeRegistry,
} from "./archetypeRegistry";
import { IAutoMovieModelArchetype } from "./IAutoMovieModelArchetype";
import { PRIMITIVE_PROP_ARCHETYPE } from "./primitivePropArchetype";
import { STICKMAN_ARCHETYPE } from "./stickmanArchetype";

/**
 * The primitive archetypes this package ships, in registration order.
 *
 * A host registers a catalogue; it does not inherit one. This is the catalogue
 * automovie ships with, and a production is free to register more, fewer, or
 * entirely different definitions alongside it.
 */
export const AUTOMOVIE_PRIMITIVE_ARCHETYPES: readonly IAutoMovieModelArchetype[] =
  [STICKMAN_ARCHETYPE, PRIMITIVE_PROP_ARCHETYPE];

/** The shipped primitive catalogue, registered as one lookup. */
export const AUTOMOVIE_PRIMITIVE_ARCHETYPE_REGISTRY: AutoMovieModelArchetypeRegistry =
  createAutoMovieArchetypeRegistry(AUTOMOVIE_PRIMITIVE_ARCHETYPES);
