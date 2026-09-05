import { lowerWaterFeature, validateWaterFeatures } from "@automovie/engine";
import type {
  IAutoMovieFluidDomain,
  IAutoMovieVector3,
  IAutoMovieWaterFeature,
} from "@automovie/interface";

import { ExampleBuilding } from "./buildings";

/**
 * Water in a building, as two records that know nothing about each other.
 *
 * ## The one rule this example exists to teach
 *
 * The solver is not part of the building. A fluid domain is a lattice, a step
 * and a depth field; it names no room, no wall and no storey, so the same
 * record describes a courtyard channel, a fountain basin and a tank in a
 * production world with no building at all. The building's half is the
 * _binding_ below: it says which logical space is the basin, which boundaries
 * are its rim, and which domain fills it. Two records, one seam, and that seam
 * is the only place the two vocabularies meet : which is also the only place
 * they can be checked against each other.
 *
 * Turn that around and the cost is obvious. A pond modelled as a child of a
 * room would be a different object the moment the same water had to appear in a
 * shot no building owns, and every consumer would have to learn both
 * spellings.
 *
 * ## What the numbers below are, and are not
 *
 * They are the degrees of freedom a basin has, exposed as `props` so the whole
 * lattice moves when one of them is edited. They are not a pond this template
 * supplies. The room the binding cites belongs to `examples/buildings.ts`;
 * replace it with your own space and rim, keep the shape of the two records.
 *
 * ## The step is derived, never typed
 *
 * An explicit shallow-water solve is stable only while `dt·√(g·H)·√(1/dx² +
 * 1/dz²) ≤ 1`. Typing a step beside a cell size is how a basin that validated
 * yesterday stops validating the moment somebody refines the lattice, so the
 * step here is computed from the lattice it has to integrate. Halve the cell
 * and the step halves with it, with no second number to remember.
 */
export const exampleBasinDomain = (
  props: {
    /** Stable identity the binding below cites. */
    id?: string;
    /** Lattice cells along `+x`. */
    columns?: number;
    /** Lattice cells along `+z`. */
    rows?: number;
    /** Square cell size in metres. */
    cell?: number;
    /**
     * Minimum corner of the lattice, and the datum every bed value is measured
     * above. It has to stand inside the basin space the binding cites.
     */
    origin?: IAutoMovieVector3;
    /** Height of the still free surface above the bed datum, in metres. */
    surfaceLevel?: number;
    /** How far the bed rises toward the rim of the basin, in metres. */
    rimRise?: number;
    /** Deepest water the domain is designed for; bounds every depth. */
    referenceDepth?: number;
    /**
     * Fraction of the stability limit the derived step takes. Below `1` by
     * design: sitting exactly on the limit leaves no room for an author to
     * nudge one number without the domain becoming unintegrable.
     */
    courant?: number;
  } = {},
): IAutoMovieFluidDomain => {
  const id = props.id ?? "example-basin-water";
  const columns = props.columns ?? 16;
  const rows = props.rows ?? 12;
  const cell = props.cell ?? 0.25;
  const origin = props.origin ?? { x: 1, y: 0.1, z: -1.5 };
  const surfaceLevel = props.surfaceLevel ?? 0.18;
  const rimRise = props.rimRise ?? 0.08;
  const referenceDepth = props.referenceDepth ?? 0.5;
  const courant = props.courant ?? 0.5;
  const gravity = 9.81;

  // Row-major throughout, `row * columns + column`, which is the one indexing
  // rule every cell-shaped array in the record shares. Writing it once as a
  // helper is what stops a bed and a depth array from being filled in two
  // different orders that nothing would notice until the water ran uphill.
  const cellCount = columns * rows;
  // A dished floor: flat in the middle, rising toward the rim. Any law works
  // here : a survey, a fall toward a drain, a stepped shelf : because the bed
  // is data rather than a shape the solver knows about.
  const bed = Array.from({ length: cellCount }, (_unused, index) => {
    const column = index % columns;
    const row = (index - column) / columns;
    const acrossX = columns === 1 ? 0 : (2 * column) / (columns - 1) - 1;
    const acrossZ = rows === 1 ? 0 : (2 * row) / (rows - 1) - 1;
    const reach = Math.max(Math.abs(acrossX), Math.abs(acrossZ));
    return rimRise * reach * reach;
  });
  // Still water over an uneven floor is a computed array, not a constant. The
  // free surface is level, so the depth of a cell is whatever is left above its
  // own bed, and a cell whose bed already stands above the surface is dry
  // rather than negative.
  const depth = bed.map((elevation) => Math.max(0, surfaceLevel - elevation));

  return {
    version: 1,
    id,
    units: "meter",
    grid: { columns, rows, cellX: cell, cellZ: cell, origin: { ...origin } },
    solver: {
      fixedStepSeconds:
        courant /
        (Math.sqrt(gravity * referenceDepth) * Math.sqrt(2 / (cell * cell))),
      gravity,
      // A basin loses momentum to its own floor; `0` would be a frictionless
      // pool that sloshes forever after the jet is switched off.
      drag: 0.6,
      dryDepth: 0.001,
      referenceDepth,
      maxSteps: 4_000,
    },
    // A basin retains its water on all four sides. One `open` edge is how a
    // channel that runs off the lattice is spelled, and the volume that leaves
    // is counted rather than lost.
    boundaries: { xMin: "wall", xMax: "wall", zMin: "wall", zMax: "wall" },
    bed,
    depth,
    // No pier, no island, no channel wall stands in this basin. The flag is
    // per cell because a solid cell holds no water and reflects every face
    // touching it, which is how an obstacle is stated without modelling one.
    solid: Array.from({ length: cellCount }, () => false),
    sources: [
      {
        id: "jet",
        column: Math.floor(columns / 2),
        row: Math.floor(rows / 2),
        flowRate: 0.02,
        start: 0,
        end: null,
      },
    ],
    drains: [
      {
        id: "overflow",
        column: columns - 1,
        row: rows - 1,
        flowRate: 0.05,
        // A weir, not a plughole: the drain stays shut until the jet has
        // actually raised the level past the sill, so the basin fills before
        // it spills. A plain floor gully would state the bed elevation here.
        sillLevel: surfaceLevel + 0.02,
        start: 0,
        end: null,
      },
    ],
    sprays: [
      {
        id: "jet-mist",
        column: Math.floor(columns / 2),
        row: Math.floor(rows / 2),
        rate: 220,
        lifetime: 1.1,
        speed: 2.4,
        direction: { x: 0, y: 1, z: 0 },
        spread: 0.18,
        size: 0.05,
        seed: 8_311,
        // Bounded twice, and neither bound is decoration: the cap is what a
        // budget prices, and the LOD distance is what keeps a distant fountain
        // from costing what a close one does.
        maxParticles: 512,
        lodDistance: 30,
      },
    ],
  };
};

/**
 * The building-owned half: this room is the basin, this rim retains it.
 *
 * Nothing here restates geometry. The basin's extent is the logical space's
 * own, the lattice's extent is the domain's own, and the engine checks that the
 * one really sits inside the other rather than trusting two numbers that were
 * typed to agree.
 *
 * `mode` is the field worth reading twice. `static` always reads the authored
 * step-0 state, which is how a mirror pool holds still through a whole cut;
 * `flowing` and `simulated` both read the fixed-step solve and differ only in
 * whether the renderer is told to scroll ripples along it. None of the three is
 * a different solve, so two features over one domain can never disagree about
 * where the water is.
 */
export const exampleBasinFeature = (
  props: {
    /** Stable feature identity. */
    id?: string;
    /** Id of the built environment that owns the basin. */
    environment?: string;
    /** Logical space acting as the basin. */
    space?: string;
    /** Fluid domain filling it. */
    domain?: string;
    /** Boundaries forming the rim that retains the water. */
    boundaries?: string[];
  } = {},
): IAutoMovieWaterFeature => ({
  id: props.id ?? "example-basin",
  environment: props.environment ?? "example-building",
  space: props.space ?? "tower-room-0",
  domain: props.domain ?? "example-basin-water",
  // A label for a reader; the solver selects nothing from it.
  kind: "pond",
  mode: "flowing",
  boundaries: props.boundaries ?? ["tower-partition-boundary-0"],
  // `null` is how "the renderer's own water" is spelled. A blank string would
  // be a citation of a material nobody can find, and is refused rather than
  // quietly read as the default.
  material: null,
});

/**
 * Check the binding against the building, and the lowering against the binding.
 *
 * Both halves are needed and neither implies the other. The first refuses a
 * basin space that does not resolve, a rim boundary that bounds some other
 * room, a domain nobody supplied, and a lattice hanging out over a space the
 * author never meant to flood. The second proves the record can actually be
 * turned into a frame: one vertex per cell, at the step the shot second snaps
 * down to, with the spray sampled from the very same clock.
 */
export const checkExampleWaterFeature = (): void => {
  const environment = new ExampleBuilding().design();
  const domain = exampleBasinDomain();
  const feature = exampleBasinFeature();

  const bound = validateWaterFeatures({
    environment,
    features: [feature],
    domains: [domain],
  });
  if (bound.success === false)
    throw new Error(
      `the example water feature does not bind: ${bound.violations[0]!.path}`,
    );

  const frame = lowerWaterFeature({ feature, domain, time: 2 });
  if (frame.feature !== feature.id)
    throw new Error(
      `the lowered frame describes "${frame.feature}", not "${feature.id}"`,
    );
  const cells = domain.grid.columns * domain.grid.rows;
  if (frame.surface.mesh.positions.length !== cells * 3)
    throw new Error(
      `the free surface carries one vertex per cell, so ${cells} cells owe ${cells * 3} coordinates, but it carried ${frame.surface.mesh.positions.length}`,
    );
  if (frame.spray.step !== frame.surface.step)
    throw new Error(
      `the spray was sampled at step ${frame.spray.step} while the surface was drawn at step ${frame.surface.step}`,
    );
};
