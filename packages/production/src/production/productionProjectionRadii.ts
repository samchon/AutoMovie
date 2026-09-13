import { IAutoMovieModelRecipe } from "@automovie/interface";

import type { IAutoMovieExternalModelRuntimeBinding } from "./materializeProduction";
import {
  AUTOMOVIE_REGISTERED_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
} from "./productionArchetypes";

/**
 * Conservative member radius of every recipe a population can draw.
 *
 * The engine's population kernels read radii as a table, because what
 * measures a recipe is this host's composition: an adopted external model is
 * measured by its byte-grounded measurement proxy, and a generated recipe by
 * the archetype catalogue the production registers. A recipe neither answers
 * for is left out, and the kernel falls back to its base recipe's radius and
 * then to half a metre.
 *
 * Public because the builder is no longer its only caller. A derivation script
 * that compiles an instance set outside the builder needs the same table, and
 * the alternative was for it to restate how a box measurement becomes a radius
 * — the drift this package exists to prevent. The builder still hands the table
 * to the engine inventories and to the compiled-shot join.
 */
export const productionProjectionRadii = (
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
  externalModels: ReadonlyMap<
    string,
    IAutoMovieExternalModelRuntimeBinding
  > = new Map(),
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): ReadonlyMap<string, number> => {
  const radii = new Map<string, number>();
  for (const id of new Set([...recipes.keys(), ...externalModels.keys()])) {
    const radius = recipeProjectionRadius(
      recipes.get(id),
      externalModels.get(id),
      archetypes,
    );
    if (radius !== null) radii.set(id, radius);
  }
  return radii;
};

/** One recipe's radius from its adopted proxy or its registered archetype. */
const recipeProjectionRadius = (
  recipe: IAutoMovieModelRecipe | undefined,
  external: IAutoMovieExternalModelRuntimeBinding | undefined,
  archetypes: AutoMovieModelArchetypeRegistry,
): number | null => {
  if (external !== undefined)
    return external.measurement.recipe === "box-v1"
      ? Math.hypot(
          external.measurement.parameters.width,
          external.measurement.parameters.height,
          external.measurement.parameters.depth,
        ) / 2
      : Math.hypot(
          Math.max(
            external.measurement.parameters.shoulderWidth,
            external.measurement.parameters.hipWidth,
          ),
          external.measurement.parameters.height,
        ) / 2;
  if (recipe === undefined) return null;
  // An unregistered archetype has no measurement of its own, and selection runs
  // before the design gate can refuse it. Answering "unknown" lets the caller
  // fall back to its declared default instead of inventing a bound here.
  const archetype = archetypes.get(recipe.archetype);
  return archetype === undefined
    ? null
    : archetype.projectionRadius(recipe.parameters);
};
