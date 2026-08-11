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
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Supplies the package's primitive blocking builders while hosts remain free to add mesh builders.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Exposes the deterministic builders that consume explicit shape and scale facts.
 * @author Samchon
 */
export const AUTOMOVIE_PRIMITIVE_ARCHETYPES: readonly IAutoMovieModelArchetype[] =
  [STICKMAN_ARCHETYPE, PRIMITIVE_PROP_ARCHETYPE];
