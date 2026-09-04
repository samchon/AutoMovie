import type {
  IAutoMovieInstanceSetDesign,
  IAutoMovieVector3,
} from "@automovie/interface";

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
 * : panels on a ceiling, modules on a wall, bays down a length : because it
 * states the rule instead of the result. The set holds three counts and one
 * spacing no matter how many members it produces, so changing a count or the
 * spacing stays ordinary TypeScript and the compiler still keeps the result as
 * bounded instance chunks rather than expanding ten thousand repeats into scene
 * nodes.
 *
 * The name is the technique and not a part, because what the members turn out
 * to be is the caller's decision: the prototype is the caller's own model
 * recipe, and the parameters below are the degrees of freedom this placement
 * has. The seed and palette are illustrative values to edit, not a finish this
 * template supplies.
 */
export const latticeRepeat = (
  modelRecipe: string,
  props: {
    /** Members along the lattice's local Z. */
    rows?: number;
    /** Members along the lattice's local X. */
    columns?: number;
    /** Stacked repetitions of the whole grid, along local Y. */
    layers?: number;
    /** Center-to-center spacing on each local axis, in meters. */
    spacing?: IAutoMovieVector3;
    /** Height of the lattice anchor above the set origin, in meters. */
    elevation?: number;
    /** Per-axis scale every member is stamped at. */
    memberScale?: IAutoMovieVector3;
  } = {},
): IAutoMovieInstanceSetDesign => {
  const rows = props.rows ?? 8;
  const columns = props.columns ?? 12;
  const layers = props.layers ?? 1;
  const spacing = props.spacing ?? { x: 1.2, y: 1, z: 1.2 };
  const elevation = props.elevation ?? 4.8;
  const memberScale = props.memberScale ?? { x: 1, y: 0.12, z: 1 };
  return {
    id: "lattice-repeat",
    modelRecipe,
    count: rows * columns * layers,
    layout: { kind: "lattice", rows, columns, layers, spacing },
    anchor: { x: 0, y: elevation, z: 0 },
    facingDeg: 0,
    seed: 1_451,
    variation: {
      scale: { min: 1, max: 1 },
      // One scale stated as both bounds is a fixed stamp rather than a range;
      // the two objects are separate so editing a bound cannot move the other.
      scale3: { min: { ...memberScale }, max: { ...memberScale } },
      palette: ["#d8cdbb"],
      traits: [],
    },
  };
};

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
 * the author's own; a helix here, but equally a vault rib, a catenary, a
 * measured survey, or anything else a function can produce; this is how it is
 * expressed without inventing new layout vocabulary: emit one exact
 * translation, unit quaternion, and per-axis scale per slot, keep a stable id
 * on each, and the whole block still compiles to bounded instance chunks.
 *
 * The law below is a helix because a helix is the shortest law to read, not
 * because a helix is what this template supplies. Its parameters are that one
 * law's degrees of freedom: replace the body with your own law and everything
 * around it; the slot loop, the stable ids, the exact per-slot transform; is
 * unchanged, which is the part worth copying.
 */
export const explicitPlacementLaw = (
  modelRecipe: string,
  props: {
    /** Slots the law is evaluated at. */
    count?: number;
    /** Full turns the law completes across those slots. */
    turns?: number;
    /** Distance of a slot from the axis it turns about, in meters. */
    radius?: number;
    /** Rise from one slot to the next, in meters. */
    rise?: number;
    /** Per-axis scale every member is stamped at. */
    memberScale?: IAutoMovieVector3;
  } = {},
): IAutoMovieInstanceSetDesign => {
  const count = props.count ?? 48;
  const turns = props.turns ?? 2;
  const radius = props.radius ?? 2;
  const rise = props.rise ?? 0.16;
  const memberScale = props.memberScale ?? { x: 0.12, y: 1.1, z: 0.12 };
  return {
    id: "explicit-placement-law",
    modelRecipe,
    count,
    layout: {
      kind: "explicit",
      transforms: Array.from({ length: count }, (_, slot) => {
        // The parameter runs 0 to 1 across the slots, so the last one lands
        // exactly on the final turn. The guard is what keeps a single-slot
        // block dividing by one instead of by zero.
        const turn = (slot / Math.max(1, count - 1)) * Math.PI * 2 * turns;
        return {
          id: `slot-${String(slot).padStart(3, "0")}`,
          translation: {
            x: Math.cos(turn) * radius,
            y: slot * rise,
            z: Math.sin(turn) * radius,
          },
          rotation: {
            x: 0,
            y: Math.sin(turn / 2),
            z: 0,
            w: Math.cos(turn / 2),
          },
          scale: { ...memberScale },
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
  };
};
