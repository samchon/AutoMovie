import {
  builtEnvironmentElementPartBounds,
  builtEnvironmentPlacementBounds,
  builtEnvironmentPlacementOverlap,
  builtEnvironmentPlacementOverlapSweep,
  builtEnvironmentSupportStatus,
  builtEnvironmentSupportSweep,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts, nclose } from "../internal/predicates";

const place = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * A shelf: a back panel standing 1.8 m and two boards at 0.75 m and 1.4 m.
 *
 * The union of those three parts spans the floor to the panel's top and is
 * mostly air, which is the whole of the defect being pinned.
 */
const shelfModel = (): IAutoMovieModel => ({
  ...makeProp([
    {
      ...primitivePart("panel", {
        type: "box",
        width: 2,
        height: 1.8,
        depth: 0.05,
      }),
      transform: place(0, 0.9, -0.475),
    },
    {
      ...primitivePart("lower", {
        type: "box",
        width: 2,
        height: 0.05,
        depth: 1,
      }),
      transform: place(0, 0.75, 0),
    },
    {
      ...primitivePart("upper", {
        type: "box",
        width: 2,
        height: 0.05,
        depth: 1,
      }),
      transform: place(0, 1.4, 0),
    },
  ]),
  id: "shelf-model",
});

const caseModel = (): IAutoMovieModel => ({
  ...makeProp([
    primitivePart("case-box", {
      type: "box",
      width: 0.2,
      height: 0.28,
      depth: 0.2,
    }),
  ]),
  id: "case-model",
});

/**
 * An L-shaped bench: two boards meeting at a corner, leaving a quarter open.
 *
 * The union of the two spans the whole square including the open quarter, which
 * is the notch a subject can stand in while standing over neither board.
 */
const benchModel = (): IAutoMovieModel => ({
  ...makeProp([
    {
      ...primitivePart("arm-x", {
        type: "box",
        width: 2,
        height: 0.1,
        depth: 0.5,
      }),
      transform: place(0, 0.5, -0.75),
    },
    {
      ...primitivePart("arm-z", {
        type: "box",
        width: 0.5,
        height: 0.1,
        depth: 1.5,
      }),
      transform: place(-0.75, 0.5, 0.25),
    },
  ]),
  id: "bench-model",
});

/**
 * The same case standing in that open quarter.
 *
 * Its underside is exactly the boards' top, so a probe that reads the union box
 * answers `resting` with a zero gap — a confident yes about a body standing over
 * nothing at all.
 */
const notchEnvironment = (): IAutoMovieBuiltEnvironment => ({
  ...environment(),
  id: "bench-room",
  models: [benchModel(), caseModel()],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "whole",
    },
    {
      id: "bench",
      kind: "equipment",
      parent: "root",
      transform: place(0, 0, 0),
      model: "bench-model",
      space: "whole",
    },
    {
      id: "case",
      kind: "equipment",
      parent: "root",
      transform: place(0.5, 0.69, 0.5),
      model: "case-model",
      space: "whole",
    },
  ],
});

/**
 * One shelf and a case resting exactly on its lower board.
 *
 * `0.775` is the board's top: `0.75 + 0.05 / 2`. The case's own box is 0.28
 * high about its origin, so an origin at `0.915` puts its underside at `0.775`
 * — zero gap, zero interpenetration.
 */
const environment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "records-room",
  units: "meter",
  buildings: [{ id: "room", element: "root", space: "whole" }],
  models: [shelfModel(), caseModel()],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "whole",
    },
    {
      id: "shelf",
      kind: "equipment",
      parent: "root",
      transform: place(0, 0, 0),
      model: "shelf-model",
      space: "whole",
    },
    {
      id: "case",
      kind: "equipment",
      parent: "root",
      transform: place(0, 0.915, 0),
      model: "case-model",
      space: "whole",
    },
  ],
  spaces: [{ id: "whole", kind: "building", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  populations: [],
  walkable: [],
});

/**
 * A body's box is not its body, and a placement probe now reads its parts.
 *
 * A `#1954` production stood eight scroll cases on a two-tier shelf. Every one
 * was seated exactly — the arithmetic gives zero gap and zero interpenetration,
 * and the frame agreed — and the sweep reported all eight as **floating and
 * overlapping**. Both answers came from one cause: an element resolved to a
 * single world box, so a shelf that is a back panel and two boards became a
 * solid volume from the floor to head height. Anything on a board is inside
 * that box, and the box's top is the panel rather than the board.
 *
 * Part boxes are contained in the union box, so reading them can only withdraw
 * an overlap the union invented; it can never invent one the union missed. A
 * single-part body yields exactly its union box and answers as it did before.
 *
 * Scenarios:
 *
 * 1. The union box is still what `builtEnvironmentPlacementBounds` reports, and
 *    it is still mostly air — the defect is what was read from it, not the box.
 * 2. The parts resolve separately, one box per drawn part.
 * 3. A case seated on the lower board is `resting`, because the bearing face is
 *    the board it is over rather than the panel behind it.
 * 4. The same case does not overlap the shelf, because no part of the shelf
 *    shares volume with it.
 * 5. A case pushed into the board still reports `sunk`, so tightening the boxes
 *    did not cost the answers that were already right.
 * 6. The whole-building sweeps agree with the named queries. The support sweep
 *    finds nothing floating, because the case is borne by the board; the overlap
 *    sweep finds no pair, because no part of the shelf shares volume with it.
 * 7. The sweeps still report the case that is genuinely wrong: pushed into the
 *    board, it comes back as an intersecting pair.
 * 8. A case standing in the open quarter of an L-shaped bench is over no part of
 *    it, and says so. Falling back to the union where a subject is over none of
 *    the parts would answer `resting` with a zero gap here, which is the same
 *    box-for-a-body mistake in the one place the notch makes it visible.
 *
 * The sweeps are the surface the defect was reported from. They take the
 * environment and nothing else, so they are what an author runs over a finished
 * building, and a named-pair fix that left them reading union boxes would have
 * fixed the query nobody ran.
 */
export const test_architecture_built_environment_multipart_support =
  (): void => {
    const world = environment();
    validateBuiltEnvironment({ environment: world });

    const union = builtEnvironmentPlacementBounds({
      environment: world,
      target: { kind: "element", id: "shelf" },
    });
    const parts = builtEnvironmentElementPartBounds(world, "shelf");
    const support = builtEnvironmentSupportStatus({
      environment: world,
      query: {
        kind: "bearing",
        subject: { kind: "element", id: "case" },
        support: { kind: "element", id: "shelf" },
      },
    });
    const overlap = builtEnvironmentPlacementOverlap({
      environment: world,
      left: { kind: "element", id: "case" },
      right: { kind: "element", id: "shelf" },
    });

    const sunkWorld = environment();
    sunkWorld.elements = sunkWorld.elements.map((element) =>
      element.id === "case"
        ? { ...element, transform: place(0, 0.85, 0) }
        : element,
    );
    const sweep = builtEnvironmentSupportSweep({ environment: world });
    const overlaps = builtEnvironmentPlacementOverlapSweep({
      environment: world,
    });
    const sunkOverlaps = builtEnvironmentPlacementOverlapSweep({
      environment: sunkWorld,
    });
    const notch = builtEnvironmentSupportStatus({
      environment: notchEnvironment(),
      query: {
        kind: "bearing",
        subject: { kind: "element", id: "case" },
        support: { kind: "element", id: "bench" },
      },
    });
    const sunk = builtEnvironmentSupportStatus({
      environment: sunkWorld,
      query: {
        kind: "bearing",
        subject: { kind: "element", id: "case" },
        support: { kind: "element", id: "shelf" },
      },
    });

    TestValidator.equals(
      "a placement probe reads a multi-part support by its parts",
      namedFacts([
        // The reported box is unchanged: this is about what is read from it.
        [
          "the union box still spans the whole shelf",
          () =>
            union !== null &&
            nclose(union.min.y, 0) &&
            nclose(union.max.y, 1.8),
        ],
        ["the parts resolve one box each", () => parts?.length === 3],
        [
          "and the lower board's top is where the case sits",
          () =>
            parts !== null && parts.some((part) => nclose(part.max.y, 0.775)),
        ],
        // The defect: this was `floating` by 1.025 m, the height of a panel the
        // case is nowhere near.
        ["the seated case rests", () => support.status === "resting"],
        ["with no gap", () => support.gap !== null && nclose(support.gap, 0)],
        // The paired defect: the union box swallowed the case whole.
        ["and does not overlap its shelf", () => overlap.status === "separate"],
        // Tighter boxes must not cost an answer that was already right.
        ["a case pushed into the board is sunk", () => sunk.status === "sunk"],
        // The sweeps are where the eight false findings came from.
        [
          "the support sweep finds nothing floating",
          () => sweep.floating.length === 0 && sweep.borne > 0,
        ],
        [
          "and the overlap sweep finds no pair",
          () => overlaps.pairs.length === 0,
        ],
        [
          "a case in an L-shaped bench's notch is over no part of it",
          () => notch.status === "not-over-support" && notch.gap === null,
        ],
        [
          "while the sunk case is still reported as intersecting",
          () =>
            sunkOverlaps.pairs.length === 1 &&
            sunkOverlaps.pairs[0]!.volume > 0,
        ],
      ]),
      {
        "the union box still spans the whole shelf": true,
        "the parts resolve one box each": true,
        "and the lower board's top is where the case sits": true,
        "the seated case rests": true,
        "with no gap": true,
        "and does not overlap its shelf": true,
        "a case pushed into the board is sunk": true,
        "the support sweep finds nothing floating": true,
        "and the overlap sweep finds no pair": true,
        "a case in an L-shaped bench's notch is over no part of it": true,
        "while the sunk case is still reported as intersecting": true,
      },
    );
  };
