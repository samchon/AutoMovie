import type { IAutoMovieFormationDesign } from "@automovie/interface";

/**
 * The army as one unit, not as two thousand authored actors.
 *
 * Count, layout, anchor, facing, and seed derive every member, so the compiler
 * stores bounded chunks instead of scene nodes and the ranks regenerate from
 * index and seed alone. The seed is declared here rather than chosen in source
 * so the same design always materializes the same army.
 *
 * @evidence docs/characters/army.md Implements the ranks-and-files silhouette
 *   and the cohesion that specification requires while the signal is given.
 */
export const army = (): IAutoMovieFormationDesign => ({
  id: "army",
  modelRecipe: "army-hero",
  count: 2049,
  layout: {
    kind: "line",
    ranks: 33,
    files: 64,
    spacing: { lateral: 0.5, depth: 1 },
  },
  anchor: { x: 0, y: 0, z: -5 },
  facingDeg: 180,
  seed: 1415,
  capabilities: ["advance", "break"],
  heroOverrides: [
    { slot: 31, actor: "captain" },
    { slot: 1055, actor: "lieutenant" },
  ],
});
