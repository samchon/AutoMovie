import type { IAutoMovieModelRecipe } from "@automovie/interface";

/**
 * The sentinel's measured facts, as one recipe the production derives its
 * design record from.
 *
 * Height is the production's reference human scale, so every other subject
 * states its size against this number rather than against a second opinion.
 *
 * @evidence docs/characters/sentinel.md Implements the silhouette, scale, and
 *   single capability that specification states, and claims nothing it does
 *   not.
 */
export const sentinel = (): IAutoMovieModelRecipe => ({
  id: "sentinel",
  role: "performer",
  archetype: "stickman",
  parameters: { height: 1.8, headRadius: 0.16, limbRadius: 0.06 },
  palette: { body: "#d7b56d" },
  lod: [{ tier: "hero", maxDistance: null, recipe: "sentinel" }],
  capabilities: ["signal"],
  attachments: [],
});
