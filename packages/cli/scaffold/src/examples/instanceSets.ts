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
 * A three-dimensional lattice: one prototype repeated on a regular grid.
 *
 * This is the layout to reach for whenever a placement is a regular repetition
 * — panels on a ceiling, modules on a wall, bays down a length — because it
 * states the rule instead of the result. The set holds three counts and one
 * spacing no matter how many members it produces, so changing `rows`,
 * `columns`, or spacing stays ordinary TypeScript and the compiler still keeps
 * the result as bounded instance chunks rather than expanding ten thousand
 * repeats into scene nodes.
 *
 * The prototype is the caller's own model recipe and the constants below are
 * illustrative values to edit, not a shape this template supplies.
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
 * Windows on a raked facade, placed on the leaning plane they belong to.
 *
 * A rake is why a facade needs full three-dimensional placement rather than a
 * ground grid with one shared heading: every opening is both moved back as it
 * rises and tilted by the same angle, so its own rotation is part of its
 * placement. Each window still costs one instance matrix, and the whole
 * elevation stays one bounded set instead of one node per opening.
 *
 * The prototype is the caller's own model recipe and the dimensions are
 * illustrative parameters to edit; what this shows is the technique, not a
 * facade the template supplies.
 */
export const slopedFacadeWindows = (
  modelRecipe: string,
  props: {
    /** Openings across one floor. */
    columns?: number;
    /** Floors up the elevation. */
    floors?: number;
    /** Center-to-center horizontal bay in meters. */
    bay?: number;
    /** Floor-to-floor rise along the raked plane, in meters. */
    floorHeight?: number;
    /** Rake of the elevation from vertical, in degrees. */
    rakeDeg?: number;
  } = {},
): IAutoMovieInstanceSetDesign => {
  const columns = props.columns ?? 12;
  const floors = props.floors ?? 9;
  const bay = props.bay ?? 1.8;
  const floorHeight = props.floorHeight ?? 3.4;
  const rakeDeg = props.rakeDeg ?? 12;
  const rake = (rakeDeg * Math.PI) / 180;
  return {
    id: "sloped-facade-windows",
    modelRecipe,
    count: columns * floors,
    layout: {
      kind: "explicit",
      transforms: Array.from({ length: columns * floors }, (_, slot) => {
        const floor = Math.floor(slot / columns);
        const column = slot % columns;
        const rise = floor * floorHeight;
        return {
          id: `window-${String(floor).padStart(2, "0")}-${String(
            column,
          ).padStart(2, "0")}`,
          translation: {
            x: (column - (columns - 1) / 2) * bay,
            y: rise * Math.cos(rake),
            z: -rise * Math.sin(rake),
          },
          // The opening leans with its wall: one rotation about the facade's
          // horizontal axis, stated as the exact unit quaternion rather than a
          // heading the placement law would have to reinterpret.
          rotation: {
            x: Math.sin(rake / 2),
            y: 0,
            z: 0,
            w: Math.cos(rake / 2),
          },
          scale: { x: 1.1, y: 1.6, z: 0.14 },
        };
      }),
    },
    anchor: { x: 0, y: 0.9, z: 0 },
    facingDeg: 0,
    seed: 1_459,
    variation: {
      scale: { min: 1, max: 1 },
      palette: ["#8fa7b8"],
      traits: [],
    },
  };
};

/**
 * An explicit transform block: a placement law written as a program.
 *
 * The compact layouts state a rule the compiler already knows. When the rule is
 * the author's own — a helix here, but equally a vault rib, a catenary, a
 * measured survey, or anything else a function can produce — this is how it is
 * expressed without inventing new layout vocabulary: emit one exact
 * translation, unit quaternion, and per-axis scale per slot, keep a stable id
 * on each, and the whole block still compiles to bounded instance chunks.
 *
 * The constants below are illustrative values to edit; the prototype is the
 * caller's own model recipe.
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
