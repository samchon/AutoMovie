import { builtInstanceSetPlacementBounds } from "@automovie/engine";
import type {
  IAutoMovieInstanceSetDesign,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError, vclose } from "../internal/predicates";

const set = (
  input: Partial<IAutoMovieInstanceSetDesign> &
    Pick<IAutoMovieInstanceSetDesign, "layout" | "count">,
): IAutoMovieInstanceSetDesign => ({
  id: "field",
  modelRecipe: "field-recipe",
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 11,
  variation: { scale: { min: 1, max: 1 }, palette: ["#808080"], traits: [] },
  ...input,
});

const bounded = (
  design: IAutoMovieInstanceSetDesign,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
  prototypeBounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
  },
): boolean => {
  const measured = builtInstanceSetPlacementBounds(design, prototypeBounds);
  return vclose(measured.min, min) && vclose(measured.max, max);
};

/**
 * The box a population fills is read off its placement law, corner by corner.
 *
 * A compact set is a law rather than a list, so the region it spans is a
 * property of the law and costs the same whether it seats four members or four
 * thousand — which is what lets a reviewer ask a room where its contents are
 * inside a loop. This pins each layout's own arithmetic, including the two
 * places a naive reading goes wrong: a grid's short last row is not a full row,
 * and a seeded scatter is bounded by the disk the author declared rather than by
 * a second copy of the seeded placement law.
 *
 * Expected numbers come from the layout contract — a grid slot sits at
 * `(column - (columns - 1) / 2) * spacing.x` across and `row * spacing.z` along,
 * then turns by `facingDeg` about the anchor — not from the query's output.
 *
 * Scenarios:
 *
 * 1. A full grid spans its whole rectangle: 3 by 2 at 2 m centres about the
 *    origin reaches x -2..2 and z 0..2.
 * 2. The anchor translates and the count does not have to fill the columns: two
 *    slots of a four-column grid occupy only the first two columns, so the box
 *    is off-centre at x -3..-1 exactly as the centring rule says.
 * 3. A short last row is excluded. Four slots of a 3-by-2 grid turned 45 degrees
 *    reach x = sqrt(2), because the far corner (column 2, row 1) is a slot
 *    nobody laid; the same grid filled to six slots reaches 2 * sqrt(2).
 * 4. A lattice stacks: three layers of a 2 by 2 field at 0.5 m rise reach
 *    y 0..1, and its footprint is the full layer's.
 * 5. A lattice whose slots do not fill one layer is that partial layer alone,
 *    with no rise at all.
 * 6. An explicit block is its own stated translations, and only the ones the
 *    count actually claims: a fifth transform beyond a four-slot count is not
 *    measured.
 * 7. A scatter is the declared disk about its anchor, flat at the anchor's own
 *    height, and a heading does not turn a disk.
 * 8. A prototype-local box is folded through a single slot's heading and its
 *    scale range, including a flat or point-like degenerate axis.
 * 9. A fixed per-slot rotation and non-uniform scale stay exact, while a varying
 *    rotation range conservatively encloses every scaled local corner.
 * 10. Repeating a bounds fold returns the same numbers, without hidden random
 *    or clock state.
 * 11. An empty, incomplete explicit, or `along-route` set is refused by name,
 *    because a useful bound needs one transform per slot and a building record
 *    carries no world route.
 */
export const test_architecture_built_population_placement_bounds = (): void => {
  TestValidator.equals(
    "a grid spans the rectangle its rows and columns lay out",
    namedFacts([
      [
        "fullGrid",
        () =>
          bounded(
            set({
              count: 6,
              layout: {
                kind: "grid",
                rows: 2,
                columns: 3,
                spacing: { x: 2, z: 2 },
              },
            }),
            { x: -2, y: 0, z: 0 },
            { x: 2, y: 0, z: 2 },
          ),
      ],
      [
        "anchoredAndPartlyFilled",
        () =>
          bounded(
            set({
              count: 2,
              anchor: { x: 10, y: 3, z: -4 },
              layout: {
                kind: "grid",
                rows: 1,
                columns: 4,
                spacing: { x: 2, z: 2 },
              },
            }),
            { x: 7, y: 3, z: -4 },
            { x: 9, y: 3, z: -4 },
          ),
      ],
    ]),
    { fullGrid: true, anchoredAndPartlyFilled: true },
  );

  const shortRow = set({
    count: 4,
    facingDeg: 45,
    layout: { kind: "grid", rows: 2, columns: 3, spacing: { x: 2, z: 2 } },
  });
  const filled = set({
    count: 6,
    facingDeg: 45,
    layout: { kind: "grid", rows: 2, columns: 3, spacing: { x: 2, z: 2 } },
  });
  TestValidator.equals(
    "a short last row is not measured as a full one",
    namedFacts([
      [
        "shortRow",
        () =>
          bounded(
            shortRow,
            { x: -Math.SQRT2, y: 0, z: -Math.SQRT2 },
            { x: Math.SQRT2, y: 0, z: 2 * Math.SQRT2 },
          ),
      ],
      [
        "filledRow",
        () =>
          bounded(
            filled,
            { x: -Math.SQRT2, y: 0, z: -Math.SQRT2 },
            { x: 2 * Math.SQRT2, y: 0, z: 2 * Math.SQRT2 },
          ),
      ],
    ]),
    { shortRow: true, filledRow: true },
  );

  TestValidator.equals(
    "a lattice rises by its used layers and no further",
    namedFacts([
      [
        "threeLayers",
        () =>
          bounded(
            set({
              count: 12,
              layout: {
                kind: "lattice",
                rows: 2,
                columns: 2,
                layers: 3,
                spacing: { x: 1, y: 0.5, z: 1 },
              },
            }),
            { x: -0.5, y: 0, z: 0 },
            { x: 0.5, y: 1, z: 1 },
          ),
      ],
      [
        "onePartialLayer",
        () =>
          bounded(
            set({
              count: 3,
              layout: {
                kind: "lattice",
                rows: 2,
                columns: 2,
                layers: 2,
                spacing: { x: 2, y: 4, z: 2 },
              },
            }),
            { x: -1, y: 0, z: 0 },
            { x: 1, y: 0, z: 2 },
          ),
      ],
    ]),
    { threeLayers: true, onePartialLayer: true },
  );

  TestValidator.equals(
    "an explicit block measures the slots its count claims",
    bounded(
      set({
        count: 4,
        anchor: { x: 1, y: 1, z: 1 },
        layout: {
          kind: "explicit",
          transforms: [
            { x: 0, y: 0, z: 0 },
            { x: 3, y: 0, z: 0 },
            { x: 0, y: 2, z: 0 },
            { x: 0, y: 0, z: 5 },
            { x: 100, y: 100, z: 100 },
          ].map((translation, index) => ({
            id: `slot-${index}`,
            translation,
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          })),
        },
      }),
      { x: 0, y: 1, z: 0.5 },
      { x: 5, y: 5, z: 6.5 },
      {
        min: { x: -1, y: 0, z: -0.5 },
        max: { x: 1, y: 2, z: 0.5 },
      },
    ),
    true,
  );

  TestValidator.equals(
    "a scatter is the disk the author declared, and a heading cannot turn it",
    bounded(
      set({
        count: 40,
        anchor: { x: 4, y: 1, z: -2 },
        facingDeg: 90,
        layout: { kind: "scatter", radius: 3 },
      }),
      { x: 1, y: 1, z: -5 },
      { x: 7, y: 1, z: 1 },
    ),
    true,
  );

  const oneRotated = set({
    count: 1,
    anchor: { x: 10, y: 2, z: -3 },
    facingDeg: 90,
    layout: { kind: "grid", rows: 1, columns: 1, spacing: { x: 1, z: 1 } },
  });
  TestValidator.equals(
    "a single slot carries its whole prototype box through the heading",
    bounded(
      oneRotated,
      { x: 8, y: 2, z: -4 },
      { x: 12, y: 6, z: -2 },
      {
        min: { x: -1, y: 0, z: -2 },
        max: { x: 1, y: 4, z: 2 },
      },
    ),
    true,
  );

  TestValidator.equals(
    "a uniform scale range includes both ends for an off-origin local box",
    bounded(
      set({
        count: 1,
        variation: {
          scale: { min: 0.5, max: 2 },
          palette: ["#808080"],
          traits: [],
        },
        layout: {
          kind: "grid",
          rows: 1,
          columns: 1,
          spacing: { x: 1, z: 1 },
        },
      }),
      { x: 0.5, y: -2, z: 0 },
      { x: 4, y: 2, z: 0 },
      {
        min: { x: 1, y: -1, z: 0 },
        max: { x: 2, y: 1, z: 0 },
      },
    ),
    true,
  );

  TestValidator.equals(
    "a fixed local rotation and non-uniform scale remain exact",
    bounded(
      set({
        count: 1,
        variation: {
          scale: { min: 1, max: 1 },
          scale3: {
            min: { x: 2, y: 3, z: 1 },
            max: { x: 2, y: 3, z: 1 },
          },
          rotationDeg: {
            x: { min: 0, max: 0 },
            y: { min: 0, max: 0 },
            z: { min: 90, max: 90 },
          },
          palette: ["#808080"],
          traits: [],
        },
        layout: {
          kind: "grid",
          rows: 1,
          columns: 1,
          spacing: { x: 1, z: 1 },
        },
      }),
      { x: -3, y: 0, z: 0 },
      { x: 0, y: 4, z: 0 },
      {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 2, y: 1, z: 0 },
      },
    ),
    true,
  );

  const varyingRotation = set({
    count: 1,
    variation: {
      scale: { min: 1, max: 1 },
      rotationDeg: {
        x: { min: -15, max: 15 },
        y: { min: 0, max: 0 },
        z: { min: 0, max: 0 },
      },
      palette: ["#808080"],
      traits: [],
    },
    layout: { kind: "grid", rows: 1, columns: 1, spacing: { x: 1, z: 1 } },
  });
  const radius = Math.sqrt(14);
  TestValidator.equals(
    "a varying rotation uses a deterministic conservative sphere",
    {
      bounded: bounded(
        varyingRotation,
        { x: -radius, y: -radius, z: -radius },
        { x: radius, y: radius, z: radius },
        {
          min: { x: -1, y: -2, z: -3 },
          max: { x: 1, y: 2, z: 3 },
        },
      ),
      repeat: (() => {
        const first = builtInstanceSetPlacementBounds(varyingRotation, {
          min: { x: -1, y: -2, z: -3 },
          max: { x: 1, y: 2, z: 3 },
        });
        const second = builtInstanceSetPlacementBounds(varyingRotation, {
          min: { x: -1, y: -2, z: -3 },
          max: { x: 1, y: 2, z: 3 },
        });
        return vclose(first.min, second.min) && vclose(first.max, second.max);
      })(),
    },
    { bounded: true, repeat: true },
  );

  TestValidator.equals(
    "a route-following set is refused, because a building cannot resolve a route",
    throwsError(
      () =>
        builtInstanceSetPlacementBounds(
          set({
            count: 5,
            layout: {
              kind: "along-route",
              route: "market-lane",
              lateralJitter: 0.4,
            },
          }),
          { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        ),
      ['along world route "market-lane"'],
    ),
    true,
  );

  TestValidator.equals(
    "an empty population has no placement bound",
    throwsError(
      () =>
        builtInstanceSetPlacementBounds(
          set({
            count: 0,
            layout: {
              kind: "grid",
              rows: 1,
              columns: 1,
              spacing: { x: 1, z: 1 },
            },
          }),
          { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        ),
      ["population slot count must be an integer > 0"],
    ),
    true,
  );

  TestValidator.equals(
    "an incomplete explicit population has no placement bound",
    throwsError(
      () =>
        builtInstanceSetPlacementBounds(
          set({
            count: 2,
            layout: {
              kind: "explicit",
              transforms: [
                {
                  id: "slot-0",
                  translation: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              ],
            },
          }),
          { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        ),
      ["one transform per slot"],
    ),
    true,
  );
};
