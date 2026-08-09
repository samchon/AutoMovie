/**
 * A catalogue of primitive model archetypes, behind one registration seam.
 *
 * The production core keeps the shape of a model recipe and never the
 * catalogue: it resolves `archetype` through a registry rather than through a
 * list it knows. This package supplies definitions to register, each one a
 * parameter schema with its bounds and a pure geometry builder.
 */
export * from "./IAutoMovieModelArchetype";
export * from "./archetypeRegistry";
export * from "./parameterValues";
export * from "./primitiveArchetypes";
export * from "./primitivePropArchetype";
export * from "./stickmanArchetype";
