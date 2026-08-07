import type { IAutoMovieModelRecipe } from "@automovie/interface";

/**
 * One member of the army, at hero detail, with its two coarser tiers.
 *
 * A member is a head shorter than the sentinel so the two subjects read apart
 * in one frame, and the LOD ladder exists because the unit is seen at every
 * distance from a close rank to the far edge of the field.
 *
 * @evidence docs/characters/army.md Implements the member scale and the
 *   rank-and-file readability that specification requires at every distance.
 */
export const armyHero = (): IAutoMovieModelRecipe => ({
  id: "army-hero",
  role: "performer",
  archetype: "stickman",
  parameters: { height: 1.7, headRadius: 0.14, limbRadius: 0.05 },
  palette: { body: "#8f9d74" },
  lod: [
    { tier: "hero", maxDistance: 5, recipe: "army-hero" },
    { tier: "near", maxDistance: 12, recipe: "army-near" },
    { tier: "far", maxDistance: null, recipe: "army-far" },
  ],
  capabilities: ["signal"],
  attachments: [],
});
