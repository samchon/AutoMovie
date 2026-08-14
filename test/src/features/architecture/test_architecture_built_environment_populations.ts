import {
  builtEnvironmentSpaceContentBounds,
  builtEnvironmentSpaceFidelity,
  builtEnvironmentSpaceNodes,
  builtEnvironmentSpacePopulations,
  lowerBuiltEnvironment,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltPopulation,
  IAutoMovieConvexSpaceCell,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModel,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts, vclose } from "../internal/predicates";

const place = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const box = (
  id: string,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
): IAutoMovieConvexSpaceCell => ({
  id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: max.x },
    { normal: { x: -1, y: 0, z: 0 }, offset: -min.x },
    { normal: { x: 0, y: 1, z: 0 }, offset: max.y },
    { normal: { x: 0, y: -1, z: 0 }, offset: -min.y },
    { normal: { x: 0, y: 0, z: 1 }, offset: max.z },
    { normal: { x: 0, y: 0, z: -1 }, offset: -min.z },
  ],
});

const unitBox = (id: string): IAutoMovieModel => ({
  ...makeProp([
    primitivePart("block", { type: "box", width: 1, height: 1, depth: 1 }),
  ]),
  id,
});

/** One compact field laid on a whole-metre grid, so every bound is arithmetic. */
const field = (input: {
  id: string;
  space: string;
  anchor: IAutoMovieVector3;
  columns: number;
  rows: number;
  count: number;
  spacing: { x: number; z: number };
}): IAutoMovieBuiltPopulation => ({
  space: input.space,
  prototypeBounds: {
    min: { x: -0.5, y: 0, z: -0.5 },
    max: { x: 0.5, y: 1, z: 0.5 },
  },
  set: {
    id: input.id,
    modelRecipe: `${input.id}-recipe`,
    count: input.count,
    layout: {
      kind: "grid",
      rows: input.rows,
      columns: input.columns,
      spacing: input.spacing,
    },
    anchor: input.anchor,
    facingDeg: 0,
    seed: 7,
    variation: {
      scale: { min: 1, max: 1 },
      palette: ["#808080"],
      traits: [],
    },
  } satisfies IAutoMovieInstanceSetDesign,
});

/**
 * A residence whose rooms are furnished by populations as much as by elements.
 *
 * Every population is a whole-metre grid centred on its own anchor, so each
 * expected box is hand arithmetic over `(column - (columns - 1) / 2) * spacing.x`
 * and `row * spacing.z` rather than a transcript of what the query printed.
 */
const residence = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "residence",
  units: "meter",
  buildings: [
    { id: "residence-unit", element: "residence-root", space: "residence" },
  ],
  models: [unitBox("stone")],
  modelReferences: [],
  elements: [
    {
      id: "residence-root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "residence",
    },
    {
      id: "hall-table",
      kind: "furniture",
      parent: "residence-root",
      transform: place(5, 0.5, 4),
      model: "stone",
      space: "great-hall",
    },
    {
      id: "solar-chest",
      kind: "furniture",
      parent: "residence-root",
      transform: place(15, 0.5, 4),
      model: "stone",
      space: "solar",
    },
  ],
  populations: [
    // The hall's own flagging: 3 columns by 2 rows about (5, 0, 2), so
    // x runs 5 - 2 .. 5 + 2 and z runs 2 .. 2 + 2.
    field({
      id: "hall-flags",
      space: "great-hall",
      anchor: { x: 5, y: 0, z: 2 },
      columns: 3,
      rows: 2,
      count: 6,
      spacing: { x: 2, z: 2 },
    }),
    // The undercroft holds nothing but casks: the boundary case where a room
    // is furnished entirely by a population.
    field({
      id: "undercroft-casks",
      space: "undercroft",
      anchor: { x: 2, y: -2.5, z: 3 },
      columns: 2,
      rows: 2,
      count: 4,
      spacing: { x: 1.5, z: 1.5 },
    }),
    // The slate covers the whole work, so it names the building's own space
    // rather than any one room beneath it.
    field({
      id: "roof-slate",
      space: "residence",
      anchor: { x: 10, y: 9, z: 0 },
      columns: 4,
      rows: 3,
      count: 12,
      spacing: { x: 5, z: 5 },
    }),
    // One authored paving run crossing a room boundary, declared as the two
    // populations it actually is.
    field({
      id: "paving-hall",
      space: "great-hall",
      anchor: { x: 3, y: 0, z: 6 },
      columns: 2,
      rows: 2,
      count: 4,
      spacing: { x: 2, z: 2 },
    }),
    field({
      id: "paving-porch",
      space: "porch",
      anchor: { x: 3, y: 0, z: 10 },
      columns: 2,
      rows: 2,
      count: 4,
      spacing: { x: 2, z: 2 },
    }),
  ],
  spaces: [
    { id: "residence", kind: "building", parent: null, cells: [] },
    {
      id: "great-hall",
      kind: "hall",
      parent: "residence",
      cells: [
        box("great-hall-cell", { x: 0, y: 0, z: 0 }, { x: 10, y: 5, z: 8 }),
      ],
    },
    {
      id: "undercroft",
      kind: "cellar",
      parent: "residence",
      cells: [
        box("undercroft-cell", { x: 0, y: -3, z: 0 }, { x: 10, y: 0, z: 8 }),
      ],
    },
    {
      id: "solar",
      kind: "room",
      parent: "residence",
      cells: [box("solar-cell", { x: 12, y: 0, z: 0 }, { x: 20, y: 5, z: 8 })],
    },
    {
      id: "porch",
      kind: "porch",
      parent: "residence",
      cells: [box("porch-cell", { x: 0, y: 0, z: 8 }, { x: 10, y: 5, z: 12 })],
    },
  ],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/** The same work with its populations removed, for the regression comparison. */
const unpopulated = (): IAutoMovieBuiltEnvironment => {
  const bare = residence();
  delete bare.populations;
  return bare;
};

/**
 * A space answers for the populations standing in it, not only its elements.
 *
 * A repeated part is authored as one compact set rather than as thousands of
 * elements, and until a set could say which space it stands in, every spatial
 * query looked straight past it. The `#1902` residence stood 2,392 roof slates,
 * 927 ashlar blocks, 1,045 floor flags and 419 oak boards that way, so a room
 * asked where its contents were answered with the box of whatever few elements
 * remained: not `null`, which anyone would have caught, but a plausibly small
 * box a review camera then aimed at a wall.
 *
 * Membership is declared, exactly as an element's is, and one population names
 * one space. That answers the roof-slate touchstone in the negative — a field
 * covering the whole work names the work's own space, so what is *in* a room
 * excludes what merely covers it — and it makes a field that genuinely crosses a
 * room boundary two compact records rather than one ambiguous one.
 *
 * Every expected bound here is arithmetic over the grid law, never a transcript
 * of the query's own output.
 *
 * Scenarios:
 *
 * 1. The record validates, so nothing below is read off a malformed building.
 * 2. A room furnished only by a population is measured rather than reported
 *    empty: `undercroft` holds no element at all and answers x 0.75..3.25,
 *    y -2.5..-1.5, z 2.5..5, including each cask's local box rather than only
 *    its origin.
 * 3. A room holding only elements answers exactly what it answered before
 *    populations existed: `solar` is the unit chest at x 14.5..15.5, and the
 *    same environment with its populations stripped agrees to the number.
 * 4. A room holding both is the union: `great-hall` reaches x 1.5..7.5,
 *    y 0..1, z 1.5..8.5 from one table, one flagging field, and its half of the
 *    paving.
 * 5. The negative pair. That answer excludes the undercroft's casks two and a
 *    half metres below it, the porch's paving two metres beyond it, and the
 *    slate nine metres above it, each of which would move a bound if declared
 *    membership leaked.
 * 6. The roof-slate touchstone: the field declared on the work's own space is
 *    absent from every room and present at the root, whose box reaches y 9 and
 *    z 0..12 over the whole work.
 * 7. `builtEnvironmentSpacePopulations` names which sets a space owns, folding
 *    descendants exactly as the bounds query does.
 * 8. `builtEnvironmentSpaceNodes` lists elements as `<environment>/<element>`
 *    and populations as `instance-set:<set>`, one entry per population rather
 *    than one per member, so a room with 2,392 slates is still one string.
 * 9. An empty space still reports `null`, and population presence never changes
 *    the separate fidelity answer about the space's own declared volume.
 * 10. Lowering hands the populations to the world as the compact sets they are,
 *    while a record without populations omits the key entirely.
 */
export const test_architecture_built_environment_populations = (): void => {
  const work = residence();
  TestValidator.equals(
    "the populated record validates",
    validateBuiltEnvironment({ environment: work }).success,
    true,
  );

  const undercroft = builtEnvironmentSpaceContentBounds(work, "undercroft");
  TestValidator.equals(
    "a room furnished only by a population is measured, not reported empty",
    namedFacts([
      ["measured", () => undercroft !== null],
      [
        "min",
        () =>
          undercroft !== null &&
          vclose(undercroft.min, { x: 0.75, y: -2.5, z: 2.5 }),
      ],
      [
        "max",
        () =>
          undercroft !== null &&
          vclose(undercroft.max, { x: 3.25, y: -1.5, z: 5 }),
      ],
    ]),
    { measured: true, min: true, max: true },
  );

  const solar = builtEnvironmentSpaceContentBounds(work, "solar");
  const solarBefore = builtEnvironmentSpaceContentBounds(
    unpopulated(),
    "solar",
  );
  TestValidator.equals(
    "a room holding only elements answers what it always answered",
    namedFacts([
      ["measured", () => solar !== null],
      [
        "min",
        () => solar !== null && vclose(solar.min, { x: 14.5, y: 0, z: 3.5 }),
      ],
      [
        "max",
        () => solar !== null && vclose(solar.max, { x: 15.5, y: 1, z: 4.5 }),
      ],
      [
        "unchangedByTheFieldExisting",
        () =>
          solar !== null &&
          solarBefore !== null &&
          vclose(solar.min, solarBefore.min) &&
          vclose(solar.max, solarBefore.max),
      ],
    ]),
    {
      measured: true,
      min: true,
      max: true,
      unchangedByTheFieldExisting: true,
    },
  );

  const hall = builtEnvironmentSpaceContentBounds(work, "great-hall");
  TestValidator.equals(
    "a room holding both is their union, and only theirs",
    namedFacts([
      ["measured", () => hall !== null],
      [
        "min",
        () => hall !== null && vclose(hall.min, { x: 1.5, y: 0, z: 1.5 }),
      ],
      [
        "max",
        () => hall !== null && vclose(hall.max, { x: 7.5, y: 1, z: 8.5 }),
      ],
      ["theCellarBelowDidNotLeakIn", () => hall !== null && hall.min.y === 0],
      ["thePorchBeyondDidNotLeakIn", () => hall !== null && hall.max.z === 8.5],
      ["theSlateAboveDidNotLeakIn", () => hall !== null && hall.max.y === 1],
    ]),
    {
      measured: true,
      min: true,
      max: true,
      theCellarBelowDidNotLeakIn: true,
      thePorchBeyondDidNotLeakIn: true,
      theSlateAboveDidNotLeakIn: true,
    },
  );

  const whole = builtEnvironmentSpaceContentBounds(work, "residence");
  TestValidator.equals(
    "the work's own space carries the field that covers the work",
    namedFacts([
      ["measured", () => whole !== null],
      [
        "min",
        () =>
          whole !== null && vclose(whole.min, { x: 0.75, y: -2.5, z: -0.5 }),
      ],
      [
        "max",
        () => whole !== null && vclose(whole.max, { x: 18, y: 10, z: 12.5 }),
      ],
    ]),
    { measured: true, min: true, max: true },
  );

  TestValidator.equals(
    "each space owns exactly the populations declared on it",
    {
      hall: builtEnvironmentSpacePopulations(work, "great-hall").map(
        (population) => population.set.id,
      ),
      undercroft: builtEnvironmentSpacePopulations(work, "undercroft").map(
        (population) => population.set.id,
      ),
      solar: builtEnvironmentSpacePopulations(work, "solar").map(
        (population) => population.set.id,
      ),
      omitted: builtEnvironmentSpacePopulations(unpopulated(), "solar").map(
        (population) => population.set.id,
      ),
      porch: builtEnvironmentSpacePopulations(work, "porch").map(
        (population) => population.set.id,
      ),
      whole: builtEnvironmentSpacePopulations(work, "residence").map(
        (population) => population.set.id,
      ),
    },
    {
      hall: ["hall-flags", "paving-hall"],
      undercroft: ["undercroft-casks"],
      solar: [],
      omitted: [],
      porch: ["paving-porch"],
      whole: [
        "hall-flags",
        "undercroft-casks",
        "roof-slate",
        "paving-hall",
        "paving-porch",
      ],
    },
  );

  TestValidator.equals(
    "a population is named once, by the owner id the render side uses",
    {
      hall: builtEnvironmentSpaceNodes(work, "great-hall"),
      undercroft: builtEnvironmentSpaceNodes(work, "undercroft"),
      solar: builtEnvironmentSpaceNodes(work, "solar"),
      whole: builtEnvironmentSpaceNodes(work, "residence"),
    },
    {
      hall: [
        "residence/hall-table",
        "instance-set:hall-flags",
        "instance-set:paving-hall",
      ],
      undercroft: ["instance-set:undercroft-casks"],
      solar: ["residence/solar-chest"],
      whole: [
        "residence/hall-table",
        "residence/solar-chest",
        "instance-set:hall-flags",
        "instance-set:undercroft-casks",
        "instance-set:roof-slate",
        "instance-set:paving-hall",
        "instance-set:paving-porch",
      ],
    },
  );

  const empty = residence();
  empty.elements = empty.elements.filter((element) => element.model === null);
  empty.populations = [];
  TestValidator.equals(
    "empty content remains null and population content does not alter fidelity",
    {
      empty: builtEnvironmentSpaceContentBounds(empty, "solar"),
      populatedFidelity: builtEnvironmentSpaceFidelity(work, "great-hall"),
      bareFidelity: builtEnvironmentSpaceFidelity(unpopulated(), "great-hall"),
    },
    { empty: null, populatedFidelity: "exact", bareFidelity: "exact" },
  );

  const lowered = lowerBuiltEnvironment(work);
  const loweredBare = lowerBuiltEnvironment(unpopulated());
  TestValidator.equals(
    "lowering contributes the compact sets and never expands them",
    {
      sets: (lowered.instanceSets ?? []).map((set) => set.id),
      slots: (lowered.instanceSets ?? []).reduce(
        (total, set) => total + set.count,
        0,
      ),
      setPieces: lowered.set?.length ?? 0,
      bareOmitsTheKey: Object.hasOwn(loweredBare, "instanceSets"),
    },
    {
      sets: [
        "hall-flags",
        "undercroft-casks",
        "roof-slate",
        "paving-hall",
        "paving-porch",
      ],
      slots: 30,
      setPieces: 2,
      bareOmitsTheKey: false,
    },
  );
};
