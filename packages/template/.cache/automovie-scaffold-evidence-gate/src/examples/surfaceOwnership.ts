import type { IAutoMovieBuiltElement } from "@automovie/interface";

import {
  type IExampleSurfaceLedger,
  type IExampleSurfaceQuantity,
  exampleBareSurface,
  exampleCladBay,
  sumExampleSurfaceQuantities,
} from "./surfaceQuantities";

/**
 * Splitting a large production by what a viewer sees, so two authors can work
 * at once without meeting in the middle of a wall.
 *
 * ## The one rule this example exists to teach
 *
 * One complete visual surface has one owner, and no surface is ever split
 * across two of them. An elevation, a roof plane, a courtyard floor, or a single
 * room's shell is one owner's whole job, and the moment two files both lay
 * pieces on it neither can say what the surface is missing: each is complete by
 * its own reckoning and the gap is in the seam nobody holds.
 *
 * A concern that genuinely crosses every surface is not an exception to that
 * rule, it is another application of it. Finish bindings and lighting get their
 * own single owner, because the alternative is every surface owner deciding
 * independently what a `cladding-module` is made of and the building arriving in
 * as many finishes as it has files.
 *
 * ## Why the file boundary is the ownership boundary
 *
 * Parallel authoring hands out files. Two owners inside one file cannot be
 * dispatched at once, and one surface across two files produces the merge nobody
 * can adjudicate, so {@link checkExampleSurfaceOwnership} holds both directions:
 * a surface names one module and a module names one surface.
 *
 * ## What the types settle, and what the check has to
 *
 * {@link IExampleSurfaceOwner} has nowhere to put a finish. That is the design,
 * not an omission: a rule the type makes unspellable needs no reviewer to
 * enforce it. What the type cannot see is whether the pieces an owner emits
 * really belong to the surface it declared, or whether the cross-cutting owner
 * is binding to elements that still exist, so the check covers exactly those
 * two.
 *
 * ## What to copy
 *
 * The three owners below build placeholder bays from the counting example in
 * `examples/surfaceQuantities.ts`, and one of them owns a surface nobody has
 * clad yet. That last one is the ordinary mid-campaign state and the reason a
 * registry beats a folder listing: the surface is claimed, the ledger says it is
 * outstanding, and nothing reads as finished because a file exists.
 */
/** One complete visual surface, and the single file that answers for it. */
export interface IExampleSurfaceOwner {
  /** The surface this owner alone lays, in full. */
  surface: string;
  /** Path of the file that owns it, relative to `src`. */
  module: string;
  /**
   * Everything the surface is made of, produced in one call.
   *
   * A surface built in two calls is a surface with two owners waiting to
   * happen, so the contract is one entry point that returns the pieces and the
   * count of them together.
   */
  build: () => {
    elements: IAutoMovieBuiltElement[];
    quantity: IExampleSurfaceQuantity;
  };
}

/** A finish assigned to an element, decided nowhere else. */
export interface IExampleFinishBinding {
  /** Element id the finish applies to. */
  element: string;
  /** Finish id, owned by the production's own material library. */
  finish: string;
}

/**
 * A concern no surface owns because every surface has it.
 *
 * It reads the elements the surface owners emitted and decides across all of
 * them at once. Reading rather than emitting is what keeps it cross-cutting
 * instead of a fourth surface: it adds nothing to the building and can be
 * rerun against a changed one.
 */
export interface IExampleCrossCuttingOwner {
  /** What this owner decides for the whole work. */
  concern: string;
  /** Path of the file that owns it, relative to `src`. */
  module: string;
  bind: (elements: IAutoMovieBuiltElement[]) => IExampleFinishBinding[];
}

/**
 * Three surfaces, three files, one of them not clad yet.
 *
 * Each owner parameterises the same placeholder bay differently, which is all
 * the geometry this example needs: what is being demonstrated is the registry,
 * not the wall. A production replaces each `build` with its own surface and
 * leaves the shape of the entry alone.
 */
export const EXAMPLE_SURFACE_OWNERS: IExampleSurfaceOwner[] = [
  {
    surface: "example-bay-north",
    module: "world/exampleBayNorth.ts",
    build: () =>
      exampleCladBay({
        surface: "example-bay-north",
        parent: "example-north-wall",
        space: "example-north-room",
        width: 6,
        height: 3.6,
      }),
  },
  {
    surface: "example-bay-south",
    module: "world/exampleBaySouth.ts",
    build: () =>
      exampleCladBay({
        surface: "example-bay-south",
        parent: "example-south-wall",
        space: "example-south-room",
        width: 4.8,
        height: 3.6,
        opening: null,
      }),
  },
  {
    // Claimed, dispatched, and not laid. The owner exists so the ledger can
    // name the surface as outstanding; deleting the entry until the work is
    // done would make an unfinished building read as a finished one.
    surface: "example-soffit",
    module: "world/exampleSoffit.ts",
    build: () => ({
      elements: [],
      quantity: exampleBareSurface("example-soffit", "unclad"),
    }),
  },
];

/**
 * The finish rule for the whole work, in one place.
 *
 * It decides by element kind rather than by surface, which is the property that
 * makes it worth centralising: a new surface laying the same kinds inherits the
 * decision instead of restating it, and a change of stone is one edit rather
 * than one edit per elevation.
 */
export const EXAMPLE_FINISH_OWNER: IExampleCrossCuttingOwner = {
  concern: "finish-bindings",
  module: "world/exampleFinishBindings.ts",
  bind: (elements) =>
    elements.map((element) => ({
      element: element.id,
      finish: element.kind.startsWith("cladding-module")
        ? "example-limestone"
        : "example-oak",
    })),
};

/**
 * Compose every owner into one work, and read how far it has got.
 *
 * Composition is a fold over the registry and nothing else. There is no place
 * here to fix up a surface, because a correction applied at composition time
 * belongs to a file nobody owns and survives exactly until the next author
 * rebuilds the surface it patched.
 */
export const exampleSurfaceWork = (): {
  elements: IAutoMovieBuiltElement[];
  ledger: IExampleSurfaceLedger;
  bindings: IExampleFinishBinding[];
} => {
  const built = EXAMPLE_SURFACE_OWNERS.map((owner) => owner.build());
  const elements = built.flatMap((one) => one.elements);
  return {
    elements,
    ledger: sumExampleSurfaceQuantities(built.map((one) => one.quantity)),
    bindings: EXAMPLE_FINISH_OWNER.bind(elements),
  };
};

/**
 * Check that the partition is a partition, and that the cross-cutting owner
 * still names elements that exist.
 *
 * The first assertions are the ownership rule stated mechanically: no surface
 * with two modules, no module with two surfaces, and no file holding a surface
 * as well as the cross-cutting concern the other surfaces depend on. That last
 * one is how a shared decision drifts back into one elevation's file and starts
 * being edited whenever that elevation is.
 *
 * The id-namespace pass is the one that catches a surface quietly split in two.
 * A piece laid by an owner other than the surface's own arrives under a foreign
 * id long before anyone notices the seam in a frame.
 *
 * The binding pass is why a cross-cutting owner is cheaper than it looks. It
 * reads the composed work, so a surface that renamed or dropped its pieces
 * breaks the check immediately rather than rendering in the wrong material.
 */
export const checkExampleSurfaceOwnership = (): void => {
  const surfaces = new Map<string, string>();
  const modules = new Map<string, string>();
  for (const owner of EXAMPLE_SURFACE_OWNERS) {
    const claimed = surfaces.get(owner.surface);
    if (claimed !== undefined)
      throw new Error(
        `surface "${owner.surface}" is owned by both "${claimed}" and "${owner.module}"`,
      );
    surfaces.set(owner.surface, owner.module);
    const held = modules.get(owner.module);
    if (held !== undefined)
      throw new Error(
        `"${owner.module}" owns "${held}" and "${owner.surface}"; one file owns one surface`,
      );
    modules.set(owner.module, owner.surface);
  }
  if (modules.has(EXAMPLE_FINISH_OWNER.module))
    throw new Error(
      `"${EXAMPLE_FINISH_OWNER.module}" holds both a surface and the ${EXAMPLE_FINISH_OWNER.concern} every surface depends on`,
    );

  for (const owner of EXAMPLE_SURFACE_OWNERS) {
    const { elements, quantity } = owner.build();
    if (quantity.surface !== owner.surface)
      throw new Error(
        `"${owner.module}" declares "${owner.surface}" but counted "${quantity.surface}"`,
      );
    for (const element of elements)
      if (!element.id.startsWith(`${owner.surface}-`))
        throw new Error(
          `"${owner.module}" laid "${element.id}", which belongs to another surface`,
        );
  }

  const work = exampleSurfaceWork();
  const known = new Set(work.elements.map((element) => element.id));
  if (known.size !== work.elements.length)
    throw new Error(
      `${work.elements.length - known.size} element ids are emitted by more than one owner`,
    );
  for (const binding of work.bindings)
    if (!known.has(binding.element))
      throw new Error(
        `the finish owner binds "${binding.element}", which no surface owner laid`,
      );
  if (work.bindings.length !== work.elements.length)
    throw new Error(
      `every element is finished by one binding, but ${work.elements.length} elements drew ${work.bindings.length}`,
    );
  if (work.ledger.outstanding.length === 0)
    throw new Error(
      `a surface nobody has clad must stay named in the ledger, and none was`,
    );
};
