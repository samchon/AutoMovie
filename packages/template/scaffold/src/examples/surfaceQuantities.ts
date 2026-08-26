import type {
  IAutoMovieBuiltElement,
  IAutoMovieQuaternion,
} from "@automovie/interface";

/**
 * Making a surface say what it laid, so completeness is readable without a
 * frame.
 *
 * ## The one rule this example exists to teach
 *
 * A surface that covers itself with real pieces publishes the count of the
 * pieces it laid, beside the pieces themselves, derived from the same array it
 * emitted. Nothing below is typed by hand: every number in
 * {@link IExampleSurfaceQuantity} is counted from the elements the placement law
 * produced, which is the only version of this that cannot drift from the work
 * it describes.
 *
 * The reason is that a frame cannot answer the question. A wall carrying a flat
 * base colour because its modules are meant to supply the pattern, and a wall
 * carrying a flat base colour because nobody has laid the modules yet, are the
 * same pixels. Judging coverage by eye therefore confuses a finished surface
 * with an abandoned one in both directions, and the confusion survives any
 * number of extra camera angles.
 *
 * The engine does not answer it either. `builtEnvironmentSpaceFidelity` says
 * whether a logical volume is exact or faceted, which is a claim about the
 * space, not about what covers its faces. A production that wants surface
 * coverage checked has to count for itself, which is what this file shows how
 * to do.
 *
 * ## Three coverages, and why the third one exists
 *
 * {@link ExampleSurfaceCoverage} separates "clad with modules", "flat on
 * purpose" and "not clad yet". The third value is the whole point of declaring
 * any of them: an author who cannot say `unclad` writes `flat-substrate` for
 * both cases, and the ledger goes quiet about the work that is still owed.
 * {@link sumExampleSurfaceQuantities} therefore carries the unclad surfaces by
 * name rather than folding them into a total, for the same reason a render
 * budget reports an unmeasured cost as `not-run` instead of as zero.
 *
 * ## What to copy
 *
 * The bay below is one rectangle, one grid, one void and four reveal pieces,
 * scaled unit boxes throughout. Copy the shape of the return value, the counting
 * pass, and {@link checkExampleSurfaceQuantity}; the geometry is a placeholder
 * standing in for whatever your own surface actually lays.
 */
/** How a surface says it is meant to be covered, against which its count reads. */
export type ExampleSurfaceCoverage =
  /** Covered by discrete pieces this surface lays and counts. */
  | "modular"
  /** Deliberately one continuous face, carrying no pieces at all. */
  | "flat-substrate"
  /** Not covered yet, and saying so rather than reading as finished. */
  | "unclad";

/**
 * What one surface laid, in the categories a frame cannot tell apart.
 *
 * The split between whole and cut pieces is the load-bearing one. A surface
 * whose law never cuts is a surface that stopped at the last full course and
 * left its edges bare, and the two totals differ by nothing an image shows.
 */
export interface IExampleSurfaceQuantity {
  /** Id of the one complete visual surface these counts belong to. */
  surface: string;
  /** What the author declared this surface is meant to be. */
  coverage: ExampleSurfaceCoverage;
  /** Pieces laid at their full module size. */
  wholeModules: number;
  /** Pieces trimmed against an edge or a void. */
  cutModules: number;
  /** Pieces framing a void rather than covering the field. */
  revealElements: number;
  /** Pieces closing the perimeter of the field. */
  trimElements: number;
  /** Every element the surface emitted, whatever its category. */
  elements: number;
  /** Triangle cost the emitted elements commit the renderer to. */
  triangles: number;
}

/** Rolled-up counts across surfaces, plus what is still owed. */
export interface IExampleSurfaceLedger {
  surfaces: number;
  wholeModules: number;
  cutModules: number;
  revealElements: number;
  trimElements: number;
  elements: number;
  triangles: number;
  /**
   * Surfaces that declared themselves `unclad`, by id.
   *
   * A non-empty list means the totals beside it describe a partial building.
   * Reporting them by name rather than as a count is what lets the next session
   * pick up exactly where this one stopped.
   */
  outstanding: string[];
}

const NO_ROTATION: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Triangles one placeholder box costs.
 *
 * A production reads this from the model each piece actually cites instead of
 * assuming one number for the whole surface. It is a constant here only because
 * every element below is the same unit box.
 */
const PLACEHOLDER_BOX_TRIANGLES = 12;

/** Element kinds this surface emits, and the only kinds it counts. */
const MODULE_KINDS = {
  whole: "cladding-module",
  cut: "cladding-module-cut",
  reveal: "opening-reveal",
  trim: "perimeter-trim",
} as const;

const boxElement = (props: {
  id: string;
  kind: string;
  parent: string;
  space: string;
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}): IAutoMovieBuiltElement => ({
  id: props.id,
  kind: props.kind,
  parent: props.parent,
  transform: {
    translation: props.center,
    rotation: NO_ROTATION,
    scale: props.size,
  },
  model: "example-surface-box",
  space: props.space,
});

/** Whether two axis-aligned rectangles share any area at all. */
const overlaps = (
  a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number },
): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Whether the first rectangle lies wholly inside the second. */
const contained = (
  inner: { x0: number; x1: number; y0: number; y1: number },
  outer: { x0: number; x1: number; y0: number; y1: number },
): boolean =>
  inner.x0 >= outer.x0 &&
  inner.x1 <= outer.x1 &&
  inner.y0 >= outer.y0 &&
  inner.y1 <= outer.y1;

/**
 * One clad bay, and the count of what covering it took.
 *
 * The law is deliberately the simplest one that produces all three outcomes a
 * count has to keep apart: a module clear of the void is laid whole, a module
 * the void crosses is laid cut, and a module the void swallows is not laid at
 * all. Only the first two are elements, and only the count says which of them
 * happened.
 *
 * The surface's own plane is local X across and local Y up, with the thickness
 * on Z, so the whole bay is placed by its parent rather than by every piece
 * carrying a world position.
 */
export const exampleCladBay = (
  props: {
    /** Surface id these counts are published under. */
    surface?: string;
    /** Parent element the bay hangs from. */
    parent?: string;
    /** Logical space the surface faces. */
    space?: string;
    /** Bay width across the surface, in meters. */
    width?: number;
    /** Bay height up the surface, in meters. */
    height?: number;
    /** Module width across the surface, in meters. */
    moduleWidth?: number;
    /** Course height up the surface, in meters. */
    courseHeight?: number;
    /** Module thickness off the substrate, in meters. */
    moduleDepth?: number;
    /** The void this bay is laid around, or null for an unbroken field. */
    opening?: { x: number; y: number; width: number; height: number } | null;
  } = {},
): {
  elements: IAutoMovieBuiltElement[];
  quantity: IExampleSurfaceQuantity;
} => {
  const surface = props.surface ?? "example-clad-bay";
  const parent = props.parent ?? "example-surface-root";
  const space = props.space ?? "example-surface-space";
  const width = props.width ?? 6;
  const height = props.height ?? 3.6;
  const moduleWidth = props.moduleWidth ?? 0.6;
  const courseHeight = props.courseHeight ?? 0.4;
  const moduleDepth = props.moduleDepth ?? 0.04;
  // Deliberately off the module grid. A void whose edges land on course and
  // joint lines produces no cut piece at all, which would let this example
  // teach the count while quietly demonstrating the surface that stops at the
  // last full course.
  const opening =
    props.opening === undefined
      ? { x: 2.5, y: 1.1, width: 1.3, height: 1.15 }
      : props.opening;
  const hole =
    opening === null
      ? null
      : {
          x0: opening.x,
          x1: opening.x + opening.width,
          y0: opening.y,
          y1: opening.y + opening.height,
        };

  const columns = Math.floor(width / moduleWidth);
  const courses = Math.floor(height / courseHeight);
  const elements: IAutoMovieBuiltElement[] = [];
  for (let course = 0; course < courses; ++course)
    for (let column = 0; column < columns; ++column) {
      const cell = {
        x0: column * moduleWidth,
        x1: (column + 1) * moduleWidth,
        y0: course * courseHeight,
        y1: (course + 1) * courseHeight,
      };
      // A module the void swallows is absent, not zero-sized. Emitting a
      // degenerate piece would keep the totals looking full while the frame
      // showed a hole, which is the exact disagreement this count exists to
      // make impossible.
      if (hole !== null && contained(cell, hole)) continue;
      const cut = hole !== null && overlaps(cell, hole);
      const slot = `${String(course).padStart(2, "0")}-${String(
        column,
      ).padStart(2, "0")}`;
      elements.push(
        boxElement({
          id: `${surface}-module-${slot}`,
          kind: cut ? MODULE_KINDS.cut : MODULE_KINDS.whole,
          parent,
          space,
          center: {
            x: (cell.x0 + cell.x1) / 2,
            y: (cell.y0 + cell.y1) / 2,
            z: moduleDepth / 2,
          },
          size: { x: moduleWidth, y: courseHeight, z: moduleDepth },
        }),
      );
    }

  if (opening !== null)
    for (const side of ["head", "sill", "jamb-left", "jamb-right"] as const) {
      const vertical = side === "jamb-left" || side === "jamb-right";
      elements.push(
        boxElement({
          id: `${surface}-reveal-${side}`,
          kind: MODULE_KINDS.reveal,
          parent,
          space,
          center: {
            x:
              side === "jamb-left"
                ? opening.x
                : side === "jamb-right"
                  ? opening.x + opening.width
                  : opening.x + opening.width / 2,
            y:
              side === "sill"
                ? opening.y
                : side === "head"
                  ? opening.y + opening.height
                  : opening.y + opening.height / 2,
            z: moduleDepth,
          },
          size: {
            x: vertical ? moduleDepth * 2 : opening.width,
            y: vertical ? opening.height : moduleDepth * 2,
            z: moduleDepth * 2,
          },
        }),
      );
    }

  for (const edge of ["left", "right"] as const)
    elements.push(
      boxElement({
        id: `${surface}-trim-${edge}`,
        kind: MODULE_KINDS.trim,
        parent,
        space,
        center: {
          x: edge === "left" ? 0 : columns * moduleWidth,
          y: (courses * courseHeight) / 2,
          z: moduleDepth,
        },
        size: {
          x: moduleDepth * 2,
          y: courses * courseHeight,
          z: moduleDepth * 2,
        },
      }),
    );

  // Counted from what was emitted, never from what the law intended. The two
  // agree here; they stop agreeing the first time somebody adds a piece
  // outside the loop, and a hand-written total would keep saying otherwise.
  const count = (kind: string): number =>
    elements.filter((element) => element.kind === kind).length;
  return {
    elements,
    quantity: {
      surface,
      coverage: "modular",
      wholeModules: count(MODULE_KINDS.whole),
      cutModules: count(MODULE_KINDS.cut),
      revealElements: count(MODULE_KINDS.reveal),
      trimElements: count(MODULE_KINDS.trim),
      elements: elements.length,
      triangles: elements.length * PLACEHOLDER_BOX_TRIANGLES,
    },
  };
};

/**
 * A surface that lays nothing, and says which of the two reasons applies.
 *
 * Both values below emit no elements and produce identical frames. The record
 * is the only place they differ, which is why a production writes one.
 */
export const exampleBareSurface = (
  surface: string,
  coverage: "flat-substrate" | "unclad",
): IExampleSurfaceQuantity => ({
  surface,
  coverage,
  wholeModules: 0,
  cutModules: 0,
  revealElements: 0,
  trimElements: 0,
  elements: 0,
  triangles: 0,
});

/**
 * Roll several surfaces into one reading of how far the work has got.
 *
 * The totals are ordinary sums. The list beside them is not: an unclad surface
 * contributes nothing to any total, so a ledger whose numbers look healthy still
 * names every surface those numbers do not cover.
 */
export const sumExampleSurfaceQuantities = (
  quantities: IExampleSurfaceQuantity[],
): IExampleSurfaceLedger => ({
  surfaces: quantities.length,
  wholeModules: quantities.reduce((sum, one) => sum + one.wholeModules, 0),
  cutModules: quantities.reduce((sum, one) => sum + one.cutModules, 0),
  revealElements: quantities.reduce((sum, one) => sum + one.revealElements, 0),
  trimElements: quantities.reduce((sum, one) => sum + one.trimElements, 0),
  elements: quantities.reduce((sum, one) => sum + one.elements, 0),
  triangles: quantities.reduce((sum, one) => sum + one.triangles, 0),
  outstanding: quantities
    .filter((one) => one.coverage === "unclad")
    .map((one) => one.surface),
});

/**
 * Check that the count describes the elements, and that the coverage describes
 * the count.
 *
 * Three properties are worth asserting and one is not. The categories have to
 * partition the emitted array, so no piece is laid without being counted and no
 * count outruns the pieces. The declared coverage has to agree with the totals,
 * because `modular` with nothing laid and `flat-substrate` with pieces on it are
 * each a record contradicting its own surface. The void has to be empty, which
 * is the geometric claim the totals cannot make on their own: a count is
 * satisfied by any module anywhere, including one sitting in the hole.
 *
 * What is not asserted is the exact number of modules. Restating the placement
 * law in the check makes the check agree with the law by construction and stop
 * being evidence about anything, so only the law's upper bound is held.
 */
export const checkExampleSurfaceQuantity = (): void => {
  const width = 6;
  const height = 3.6;
  const moduleWidth = 0.6;
  const courseHeight = 0.4;
  const opening = { x: 2.5, y: 1.1, width: 1.3, height: 1.15 };
  const bay = exampleCladBay({
    width,
    height,
    moduleWidth,
    courseHeight,
    opening,
  });
  const { quantity } = bay;
  const counted =
    quantity.wholeModules +
    quantity.cutModules +
    quantity.revealElements +
    quantity.trimElements;
  if (counted !== bay.elements.length)
    throw new Error(
      `the surface laid ${bay.elements.length} elements but accounted for ${counted}`,
    );
  if (quantity.elements !== bay.elements.length)
    throw new Error(
      `the quantity reports ${quantity.elements} elements against ${bay.elements.length} emitted`,
    );
  if (quantity.triangles !== bay.elements.length * PLACEHOLDER_BOX_TRIANGLES)
    throw new Error(
      `the triangle total does not follow from the ${bay.elements.length} elements it counts`,
    );

  if (quantity.coverage === "modular" && quantity.wholeModules === 0)
    throw new Error(
      `"${quantity.surface}" declares modular coverage and laid no whole module`,
    );
  if (quantity.cutModules === 0)
    throw new Error(
      `"${quantity.surface}" laid nothing against its void, so its opening is unfinished`,
    );

  const columns = Math.floor(width / moduleWidth);
  const courses = Math.floor(height / courseHeight);
  if (quantity.wholeModules + quantity.cutModules > columns * courses)
    throw new Error(
      `the field holds ${columns * courses} module slots but ${
        quantity.wholeModules + quantity.cutModules
      } were laid`,
    );

  for (const element of bay.elements) {
    if (element.kind !== MODULE_KINDS.whole) continue;
    const center = element.transform.translation;
    if (
      center.x > opening.x &&
      center.x < opening.x + opening.width &&
      center.y > opening.y &&
      center.y < opening.y + opening.height
    )
      throw new Error(
        `whole module "${element.id}" stands inside the void the surface is laid around`,
      );
  }

  const ledger = sumExampleSurfaceQuantities([
    quantity,
    exampleBareSurface("example-rendered-panel", "flat-substrate"),
    exampleBareSurface("example-second-bay", "unclad"),
  ]);
  if (ledger.outstanding.length !== 1)
    throw new Error(
      `one surface declared itself unclad, but the ledger named ${ledger.outstanding.length}`,
    );
  if (ledger.elements !== quantity.elements)
    throw new Error(
      `a surface laying nothing must add nothing, but the ledger totalled ${ledger.elements}`,
    );
};
