/**
 * A catalogue of primitive model archetypes, behind one registration seam.
 *
 * The production core keeps the shape of a model recipe and never the
 * catalogue: it resolves `archetype` through a registry rather than through a
 * list it knows. This package supplies definitions to register, each one a
 * parameter schema with its bounds and a pure geometry builder.
 *
 * The gait tables live here for the same reason. The engine owns the gait
 * machinery, the phase/duty/amplitude/contact math that walks any jointed body;
 * which bones swing, at which phases, with which amplitudes is data about one
 * kind of body, so it belongs to the catalogue a host chooses.
 */
export * from "./IAutoMovieModelArchetype";
export * from "./archetypeRegistry";
export * from "./catGaits";
export * from "./horseGaits";
export * from "./humanoidGaits";
export * from "./parameterValues";
export * from "./primitiveArchetypes";
export * from "./primitivePropArchetype";
export * from "./stickmanArchetype";
//# sourceMappingURL=index.js.map