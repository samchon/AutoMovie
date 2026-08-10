import { IAutoMovieModelArchetype } from "./IAutoMovieModelArchetype";
import { PRIMITIVE_PROP_ARCHETYPE } from "./primitivePropArchetype";
import { STICKMAN_ARCHETYPE } from "./stickmanArchetype";

/**
 * The primitive archetypes this package ships, in registration order.
 *
 * A host registers a catalogue; it does not inherit one. This is the catalogue
 * automovie ships with, and a production is free to register more, fewer, or
 * entirely different definitions alongside it.
 *
 * A list rather than a registry, deliberately. Every consumer composes its own
 * lookup through `createAutoMovieArchetypeRegistry`, because each of those
 * places is the seam where a host substitutes, extends, or drops definitions:
 * the server's registration point and the two scripts a scaffolded production
 * owns. A pre-registered lookup beside this list would be a second spelling of
 * the same catalogue that none of them can use without giving that seam up.
 */
export const AUTOMOVIE_PRIMITIVE_ARCHETYPES: readonly IAutoMovieModelArchetype[] =
  [STICKMAN_ARCHETYPE, PRIMITIVE_PROP_ARCHETYPE];
