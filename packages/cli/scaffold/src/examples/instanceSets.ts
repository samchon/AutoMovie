import type { IAutoMovieInstanceSetDesign } from "@automovie/interface";

/**
 * Non-formation onlookers with reproducible scale, palette, and pace traits.
 *
 * An instance set is the other way to put many bodies on screen: unlike a
 * formation it has no rows to keep, so it states a scatter and the per-member
 * variation the compiler draws from its seed. Nothing is expanded into scene
 * nodes.
 */
export const onlookerScatter = (
  modelRecipe: string,
): IAutoMovieInstanceSetDesign => ({
  id: "onlooker-scatter",
  modelRecipe,
  count: 100,
  layout: { kind: "scatter", radius: 14 },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1_421,
  variation: {
    scale: { min: 0.92, max: 1.08 },
    palette: ["#805d45", "#a77b5b", "#5f7088"],
    traits: [{ name: "pace", min: 0.8, max: 1.2 }],
  },
});

/** Non-formation planting with 1,000 reproducibly varied tree proxies. */
export const treeScatter = (
  modelRecipe: string,
): IAutoMovieInstanceSetDesign => ({
  id: "tree-scatter",
  modelRecipe,
  count: 1_000,
  layout: { kind: "scatter", radius: 75 },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1_435,
  variation: {
    scale: { min: 0.7, max: 1.35 },
    palette: ["#345b32", "#4f7138", "#6b7c3b"],
    traits: [{ name: "windPhase", min: 0, max: 1 }],
  },
});
