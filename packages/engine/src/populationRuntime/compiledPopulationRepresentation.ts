import {
  IAutoMovieCompiledFormationLod,
  IAutoMovieModelRecipe,
} from "@automovie/interface";

import { productionRuntimeModelId } from "../productionIdentity";
import { compiledLodRecipeDigest } from "./compiledLodRecipeDigest";

/**
 * The compiled tiers and conservative member radius of one population prototype.
 *
 * A formation's anonymous members and each prototype of an instance set are
 * drawn the same way: through the recipe's declared tiers, or through one `near`
 * tier of the base recipe when it declares none, each bound to its recipe
 * digest and runtime model id. The member radius is the largest radius over
 * those tiers, where a tier whose recipe has no known radius borrows the base
 * recipe's, and one with neither is half a metre; no member is ever smaller
 * than a centimetre for projection.
 *
 * Radii are supplied by the host. The archetype catalogue that measures a
 * generated recipe and the adopted proxy that measures an external model are
 * the host's composition, so this reads a table and never a registry.
 *
 * The caller chooses which declared tiers apply: a formation's anonymous batch
 * drops the `hero` tier, which is drawn by named nodes, while an instance set
 * has no heroes and keeps every tier. Shared by both kernels; package-private.
 */
export const compiledPopulationRepresentation = (props: {
  /** Base model recipe the population prototype names. */
  modelRecipe: string;
  /** Declared tiers that apply to this population, before the default. */
  tiers: IAutoMovieModelRecipe["lod"];
  /** Model recipes keyed by id, for tier digests. */
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>;
  /** Conservative member radius in metres keyed by recipe id. */
  projectionRadii: ReadonlyMap<string, number>;
}): { lod: IAutoMovieCompiledFormationLod[]; projectionRadius: number } => {
  const lod = (
    props.tiers.length === 0
      ? [
          {
            tier: "near" as const,
            maxDistance: null,
            recipe: props.modelRecipe,
          },
        ]
      : props.tiers
  ).map((item) => ({
    ...item,
    recipeDigest: compiledLodRecipeDigest(props.recipes, item.recipe),
    model: productionRuntimeModelId(item.recipe),
  }));
  return {
    lod,
    projectionRadius: Math.max(
      0.01,
      ...lod.map(
        (item) =>
          props.projectionRadii.get(item.recipe) ??
          props.projectionRadii.get(props.modelRecipe) ??
          0.5,
      ),
    ),
  };
};
