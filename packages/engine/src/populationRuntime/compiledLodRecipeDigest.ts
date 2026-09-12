import {
  AutoMovieContentDigest,
  IAutoMovieModelRecipe,
} from "@automovie/interface";

import { autoMovieRenderDigest } from "../render/renderDigest";
import { canonicalizeAutoMovieJson } from "../text/canonicalizeAutoMovieJson";

/**
 * Content digest for one LOD tier's model-recipe reference.
 *
 * The design gate refuses an absent recipe and a non-finite parameter alike, so
 * neither reaches a compiled population through a tracked model recipe. The
 * kernel still answers for both the bounded way it answers an unknown
 * projection radius: a reference that cannot be canonically encoded digests a
 * marker naming what the tier pointed at, instead of letting a canonical-JSON
 * refusal escape and discard the whole compiled formation or instance set.
 *
 * The digest is the SHA-256 of canonical JSON v2 computed without a Node
 * built-in, equal to the Node builder's digest of the same canonical bytes.
 * Shared by the compiled formation and instance-set kernels; package-private.
 */
export const compiledLodRecipeDigest = (
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
  id: string,
): AutoMovieContentDigest => {
  const recipe = recipes.get(id);
  if (recipe === undefined)
    return autoMovieRenderDigest(
      canonicalizeAutoMovieJson({ id, missing: true }),
    );
  try {
    return autoMovieRenderDigest(canonicalizeAutoMovieJson(recipe));
  } catch {
    return autoMovieRenderDigest(
      canonicalizeAutoMovieJson({ id, unencodable: true }),
    );
  }
};
