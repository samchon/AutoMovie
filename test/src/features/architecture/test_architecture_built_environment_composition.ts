import {
  AutoMovieSubject,
  AutoMovieSubjectGroup,
  type IAutoMovieSubjectContribution,
  lowerBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
  IAutoMovieShotBuildContext,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";

const context = {} as IAutoMovieShotBuildContext;

const STOREY_HEIGHT = 3.2;

const identity = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const slabTransform = (y: number): IAutoMovieTransform => ({
  ...identity(0, y, 0),
  scale: { x: 8, y: 0.2, z: 6 },
});

const storeySpace = (index: number): IAutoMovieBuiltSpace => ({
  id: `storey-${index}`,
  kind: "storey",
  parent: "whole",
  cells: [],
});

/**
 * The one building this file repeats, written once as a loop over its storeys.
 *
 * Nothing about a storey is stated twice: the slab element, the logical space,
 * and the stair joining it to the storey below are all derived from the same
 * index, which is what makes a thirty-storey tower the same source as a
 * three-storey one.
 */
class LoopedWing extends AutoMovieSubject<IAutoMovieBuiltEnvironment> {
  public constructor(
    public readonly id: string,
    public readonly storeys: number,
  ) {
    super();
  }

  public design(): IAutoMovieBuiltEnvironment {
    const indices = Array.from({ length: this.storeys }, (_, index) => index);
    return {
      version: 1,
      id: this.id,
      units: "meter",
      buildings: [{ id: `${this.id}-unit`, element: "root", space: "whole" }],
      models: [{ ...createModel(null), id: `${this.id}-slab` }],
      modelReferences: [],
      elements: [
        {
          id: "root",
          kind: "building",
          parent: null,
          transform: identity(0, 0, 0),
          model: null,
          space: "whole",
        },
        ...indices.map((index) => ({
          id: `slab-${index}`,
          kind: "floor-slab",
          parent: "root",
          transform: slabTransform(index * STOREY_HEIGHT),
          model: `${this.id}-slab`,
          space: `storey-${index}`,
        })),
      ],
      spaces: [
        { id: "whole", kind: "building", parent: null, cells: [] },
        ...indices.map(storeySpace),
      ],
      boundaries: indices.slice(1).map((index) => ({
        id: `slab-boundary-${index}`,
        kind: "floor-ceiling",
        spaces: [`storey-${index - 1}`, `storey-${index}`],
        elements: [`slab-${index}`],
      })),
      openings: [],
      connectors: indices.slice(1).map((index) => ({
        id: `stair-${index}`,
        kind: "stair" as const,
        from: `storey-${index - 1}`,
        to: `storey-${index}`,
        bidirectional: true,
        route: [
          { x: -3, y: (index - 1) * STOREY_HEIGHT, z: 0 },
          { x: -1, y: index * STOREY_HEIGHT, z: 0 },
        ],
        width: 1.4,
        clearHeight: 2.2,
        elements: [],
      })),
      surfaces: [],
      walkable: [],
    };
  }

  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return lowerBuiltEnvironment(this.design());
  }
}

/** The same three-storey wing, written out by hand as the loop's oracle. */
const handWrittenWing = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "north",
  units: "meter",
  buildings: [{ id: "north-unit", element: "root", space: "whole" }],
  models: [{ ...createModel(null), id: "north-slab" }],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: identity(0, 0, 0),
      model: null,
      space: "whole",
    },
    {
      id: "slab-0",
      kind: "floor-slab",
      parent: "root",
      transform: slabTransform(0),
      model: "north-slab",
      space: "storey-0",
    },
    {
      id: "slab-1",
      kind: "floor-slab",
      parent: "root",
      transform: slabTransform(3.2),
      model: "north-slab",
      space: "storey-1",
    },
    {
      id: "slab-2",
      kind: "floor-slab",
      parent: "root",
      transform: slabTransform(6.4),
      model: "north-slab",
      space: "storey-2",
    },
  ],
  spaces: [
    { id: "whole", kind: "building", parent: null, cells: [] },
    { id: "storey-0", kind: "storey", parent: "whole", cells: [] },
    { id: "storey-1", kind: "storey", parent: "whole", cells: [] },
    { id: "storey-2", kind: "storey", parent: "whole", cells: [] },
  ],
  boundaries: [
    {
      id: "slab-boundary-1",
      kind: "floor-ceiling",
      spaces: ["storey-0", "storey-1"],
      elements: ["slab-1"],
    },
    {
      id: "slab-boundary-2",
      kind: "floor-ceiling",
      spaces: ["storey-1", "storey-2"],
      elements: ["slab-2"],
    },
  ],
  openings: [],
  connectors: [
    {
      id: "stair-1",
      kind: "stair",
      from: "storey-0",
      to: "storey-1",
      bidirectional: true,
      route: [
        { x: -3, y: 0, z: 0 },
        { x: -1, y: 3.2, z: 0 },
      ],
      width: 1.4,
      clearHeight: 2.2,
      elements: [],
    },
    {
      id: "stair-2",
      kind: "stair",
      from: "storey-1",
      to: "storey-2",
      bidirectional: true,
      route: [
        { x: -3, y: 3.2, z: 0 },
        { x: -1, y: 6.4, z: 0 },
      ],
      width: 1.4,
      clearHeight: 2.2,
      elements: [],
    },
  ],
  surfaces: [],
  walkable: [],
});

/** A group of wings, which is itself just another subject. */
class Wings extends AutoMovieSubjectGroup<null, LoopedWing> {
  public constructor(
    public readonly id: string,
    private readonly wings: readonly LoopedWing[],
  ) {
    super();
  }

  public design(): null {
    return null;
  }

  public members(): readonly LoopedWing[] {
    return this.wings;
  }
}

/** A building that is a group of wing groups, composed with no new rules. */
class Campus extends AutoMovieSubjectGroup<null, Wings> {
  public readonly id = "campus";

  public constructor(private readonly wings: readonly Wings[]) {
    super();
  }

  public design(): null {
    return null;
  }

  public members(): readonly Wings[] {
    return this.wings;
  }
}

/**
 * Every field a building record owns. Pinned as a closed list so external
 * context (sun, sky, season, reference ground, neighbouring masses) cannot be
 * added to a building without this case saying so.
 */
const alphabetical = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const BUILDING_FIELDS = [
  "boundaries",
  "buildings",
  "connectors",
  "elements",
  "id",
  "modelReferences",
  "models",
  "openings",
  "spaces",
  "surfaces",
  "units",
  "version",
  "walkable",
];

/**
 * Repetition is code and composition is merge: a storey stack written as a loop
 * must be the same artifact as the same stack written out by hand, a group of
 * buildings must be exactly the stable concatenation of what its leaves said,
 * and a building must own nothing but itself. This pins all three, because each
 * is a place where a second, disagreeing answer could otherwise appear.
 *
 * Scenarios:
 *
 * 1. The looped three-storey wing and the hand-expanded one are byte-identical as
 *    design records, so the loop is a way of writing the record rather than a
 *    different record.
 * 2. They are also byte-identical after lowering, so the equality survives the
 *    transform composition, not only the authoring.
 * 3. Building the same subject twice yields byte-identical records, which is the
 *    determinism the compile sandbox depends on.
 * 4. A raised storey count changes the record only by adding storeys: the first
 *    three storeys of a five-storey wing are the three-storey wing's.
 * 5. A group's render is the stable, order-preserving concatenation of its leaves'
 *    contributions, with nothing deduplicated and nothing reordered.
 * 6. Nesting groups (campus of wing-groups of wings) yields the same flat merge as
 *    the leaves in the same order, so the hierarchy is free.
 * 7. Visible and semantic output stay joined through the merge: every merged set
 *    node is namespaced by the building that emitted it, and so is every
 *    space.
 * 8. A building record's field list is closed and holds no external context, so
 *    sun, sky, and reference ground cannot enter a building's own models, set
 *    pieces, or spaces.
 */
export const test_architecture_built_environment_composition = (): void => {
  const looped = new LoopedWing("north", 3);
  TestValidator.equals(
    "a looped storey stack is the hand-expanded record",
    looped.design(),
    handWrittenWing(),
  );
  TestValidator.equals(
    "the loop and the hand expansion lower to one artifact",
    looped.render(context),
    lowerBuiltEnvironment(handWrittenWing()),
  );
  TestValidator.equals(
    "two constructions of one subject are byte-identical",
    JSON.stringify(new LoopedWing("north", 3).design()),
    JSON.stringify(looped.design()),
  );
  const taller = new LoopedWing("north", 5).design();
  TestValidator.equals(
    "raising the storey count only adds storeys",
    {
      elements: taller.elements.slice(0, 4),
      spaces: taller.spaces.slice(0, 4),
      connectors: taller.connectors.slice(0, 2),
      added: taller.elements.slice(4).map((element) => element.id),
    },
    {
      elements: looped.design().elements,
      spaces: looped.design().spaces,
      connectors: looped.design().connectors,
      added: ["slab-3", "slab-4"],
    },
  );

  const north = new LoopedWing("north", 2);
  const south = new LoopedWing("south", 3);
  const east = new LoopedWing("east", 1);
  const flat = new Wings("flat", [north, south, east]);
  const nested = new Campus([
    new Wings("pair", [north, south]),
    new Wings("single", [east]),
  ]);
  const merged = flat.render(context);
  TestValidator.equals(
    "a group render is the stable merge of its leaves",
    {
      buildings: merged.builtEnvironments?.map((value) => value.id),
      models: merged.models?.map((model) => model.id),
      set: merged.set?.map((piece) => piece.node),
      spaces: merged.spaces?.map((space) => space.id),
    },
    {
      buildings: ["north", "south", "east"],
      models: ["north-slab", "south-slab", "east-slab"],
      set: [
        "north/slab-0",
        "north/slab-1",
        "south/slab-0",
        "south/slab-1",
        "south/slab-2",
        "east/slab-0",
      ],
      spaces: [
        "north/whole",
        "north/storey-0",
        "north/storey-1",
        "south/whole",
        "south/storey-0",
        "south/storey-1",
        "south/storey-2",
        "east/whole",
        "east/storey-0",
      ],
    },
  );
  TestValidator.equals(
    "grouping depth does not change what a group contributes",
    nested.render(context),
    merged,
  );
  TestValidator.equals(
    "merged visible nodes and merged spaces stay owned by their building",
    {
      unnamespacedNodes: (merged.set ?? []).filter(
        (piece) =>
          !(merged.builtEnvironments ?? []).some((value) =>
            piece.node.startsWith(`${value.id}/`),
          ),
      ).length,
      unnamespacedSpaces: (merged.spaces ?? []).filter(
        (space) =>
          !(merged.builtEnvironments ?? []).some((value) =>
            space.id.startsWith(`${value.id}/`),
          ),
      ).length,
    },
    { unnamespacedNodes: 0, unnamespacedSpaces: 0 },
  );
  TestValidator.equals(
    "a building record holds no external context",
    Object.keys(looped.design()).sort(alphabetical),
    BUILDING_FIELDS,
  );
  TestValidator.equals(
    "a lowered building contributes nothing beyond its own graphs",
    Object.keys(looped.render(context)).sort(alphabetical),
    ["builtEnvironments", "models", "set", "spaces"],
  );
};
