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

/**
 * Coffered-ceiling panels authored as one compact 3D lattice.
 *
 * Changing `rows`, `columns`, or spacing remains ordinary TypeScript; the
 * compiler keeps the result as bounded instance chunks instead of expanding ten
 * thousand repeated panels into scene nodes.
 */
export const cofferedCeiling = (
  modelRecipe: string,
  rows = 8,
  columns = 12,
): IAutoMovieInstanceSetDesign => ({
  id: "coffered-ceiling",
  modelRecipe,
  count: rows * columns,
  layout: {
    kind: "lattice",
    rows,
    columns,
    layers: 1,
    spacing: { x: 1.2, y: 1, z: 1.2 },
  },
  anchor: { x: 0, y: 4.8, z: 0 },
  facingDeg: 0,
  seed: 1_451,
  variation: {
    scale: { min: 1, max: 1 },
    scale3: {
      min: { x: 1, y: 0.12, z: 1 },
      max: { x: 1, y: 0.12, z: 1 },
    },
    palette: ["#d8cdbb"],
    traits: [],
  },
});

/**
 * Spiral-stair balusters with exact per-slot transforms and stable identities.
 *
 * This is the escape hatch for sloped facades, vault ribs, railings, historic
 * ornament, and any other placement law that is clearer as a program than as a
 * fixed layout vocabulary.
 */
export const spiralBalusters = (
  modelRecipe: string,
  count = 48,
): IAutoMovieInstanceSetDesign => ({
  id: "spiral-balusters",
  modelRecipe,
  count,
  layout: {
    kind: "explicit",
    transforms: Array.from({ length: count }, (_, slot) => {
      const turn = (slot / Math.max(1, count - 1)) * Math.PI * 4;
      return {
        id: `baluster-${String(slot).padStart(3, "0")}`,
        translation: {
          x: Math.cos(turn) * 2,
          y: slot * 0.16,
          z: Math.sin(turn) * 2,
        },
        rotation: {
          x: 0,
          y: Math.sin(turn / 2),
          z: 0,
          w: Math.cos(turn / 2),
        },
        scale: { x: 0.12, y: 1.1, z: 0.12 },
      };
    }),
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1_457,
  variation: {
    scale: { min: 1, max: 1 },
    palette: ["#363330"],
    traits: [],
  },
});
