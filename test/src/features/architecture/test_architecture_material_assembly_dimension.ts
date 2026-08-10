import { resolveAutoMovieMaterialAssembly } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { assembly, layer, substance } from "../internal/materialFixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

/**
 * A wet wall stated once and measured on the host's own line.
 *
 * The build-up is render, blockwork, a ventilated cavity, a zero-thickness
 * vapour barrier, and a board: five layers whose thicknesses are the wall's
 * overall dimension rather than a note beside it. The same five layers are then
 * stacked against the axis from a non-zero reference offset, because a build-up
 * that has to be rewritten to face the other way is not a build-up.
 *
 * Scenarios:
 *
 * 1. Positive sense from a zero offset places every layer at its running sum (0 /
 *    0.02 / 0.12 / 0.17 / 0.17 m) and totals 0.1825 m.
 * 2. A zero-thickness membrane occupies a plane, not a span: its start, end, and
 *    centre are one coordinate, and it advances the cursor by nothing.
 * 3. Negative sense from offset 0.25 m mirrors every span, so the extent runs
 *    0.0675 to 0.25 m while the total is unchanged.
 * 4. A declared host thickness equal to the summed layers resolves.
 * 5. A host thickness one millimetre off is refused and the message names the sum
 *    it actually got: the negative twin of scenario 4.
 * 6. Substance references resolve against a supplied table, and an unknown one is
 *    refused: the negative twin of the resolving run.
 */
export const test_architecture_material_assembly_dimension = (): void => {
  const layers = () => [
    layer("render", 0.02, { finish: true, wrapsOpening: true }),
    layer("block", 0.1),
    layer("cavity", 0.05, { substance: "cavity", material: null }),
    layer("barrier", 0, { substance: "membrane" }),
    layer("board", 0.0125, { finish: true, wrapsOpening: true }),
  ];
  const wet = assembly(layers(), {
    id: "wet-wall",
    faces: { first: "exposed", last: "exposed" },
  });
  const resolved = resolveAutoMovieMaterialAssembly({ assembly: wet });

  TestValidator.equals(
    "the build-up keeps its authored layers, roles, and identity",
    {
      id: resolved.id,
      axis: resolved.axis,
      layers: resolved.layers.map((one) => one.id),
      substances: resolved.layers.map((one) => one.substance),
      materials: resolved.layers.map((one) => one.material),
    },
    {
      id: "wet-wall",
      axis: "z",
      layers: ["render", "block", "cavity", "barrier", "board"],
      substances: ["solid", "solid", "cavity", "membrane", "solid"],
      materials: [
        "render-substance",
        "block-substance",
        null,
        "barrier-substance",
        "board-substance",
      ],
    },
  );

  TestValidator.equals(
    "every layer sits at the running sum of the layers before it",
    namedFacts([
      ["total", () => nclose(resolved.total, 0.1825, 1e-12)],
      ["start", () => nclose(resolved.start, 0, 1e-12)],
      ["end", () => nclose(resolved.end, 0.1825, 1e-12)],
      ["extentMin", () => nclose(resolved.extent.min, 0, 1e-12)],
      ["extentMax", () => nclose(resolved.extent.max, 0.1825, 1e-12)],
      [
        "starts",
        () =>
          [0, 0.02, 0.12, 0.17, 0.17].every((expected, index) =>
            nclose(resolved.layers[index]!.start, expected, 1e-12),
          ),
      ],
      [
        "ends",
        () =>
          [0.02, 0.12, 0.17, 0.17, 0.1825].every((expected, index) =>
            nclose(resolved.layers[index]!.end, expected, 1e-12),
          ),
      ],
      [
        "centers",
        () =>
          [0.01, 0.07, 0.145, 0.17, 0.17625].every((expected, index) =>
            nclose(resolved.layers[index]!.center, expected, 1e-12),
          ),
      ],
    ]),
    {
      total: true,
      start: true,
      end: true,
      extentMin: true,
      extentMax: true,
      starts: true,
      ends: true,
      centers: true,
    },
  );

  const membrane = resolved.layers[3]!;
  TestValidator.equals(
    "a zero-thickness membrane occupies a plane and advances nothing",
    namedFacts([
      ["thickness", () => membrane.thickness === 0],
      ["collapsed", () => membrane.start === membrane.end],
      ["center", () => membrane.center === membrane.start],
      ["cursor", () => resolved.layers[4]!.start === membrane.end],
    ]),
    { thickness: true, collapsed: true, center: true, cursor: true },
  );

  const mirrored = resolveAutoMovieMaterialAssembly({
    assembly: assembly(layers(), {
      id: "wet-wall-mirrored",
      axis: "x",
      sense: "negative",
      offset: 0.25,
      faces: { first: "exposed", last: "exposed" },
    }),
  });
  TestValidator.equals(
    "the negative sense mirrors every span without changing the total",
    namedFacts([
      ["axis", () => mirrored.axis === "x"],
      ["total", () => nclose(mirrored.total, 0.1825, 1e-12)],
      ["start", () => nclose(mirrored.start, 0.25, 1e-12)],
      ["end", () => nclose(mirrored.end, 0.0675, 1e-12)],
      ["extentMin", () => nclose(mirrored.extent.min, 0.0675, 1e-12)],
      ["extentMax", () => nclose(mirrored.extent.max, 0.25, 1e-12)],
      [
        "starts",
        () =>
          [0.25, 0.23, 0.13, 0.08, 0.08].every((expected, index) =>
            nclose(mirrored.layers[index]!.start, expected, 1e-12),
          ),
      ],
      [
        "ends",
        () =>
          [0.23, 0.13, 0.08, 0.08, 0.0675].every((expected, index) =>
            nclose(mirrored.layers[index]!.end, expected, 1e-12),
          ),
      ],
    ]),
    {
      axis: true,
      total: true,
      start: true,
      end: true,
      extentMin: true,
      extentMax: true,
      starts: true,
      ends: true,
    },
  );

  TestValidator.equals(
    "a host drawn at the summed thickness resolves, one millimetre off does not",
    namedFacts([
      [
        "matches",
        () =>
          nclose(
            resolveAutoMovieMaterialAssembly({
              assembly: wet,
              host: { thickness: 0.1825 },
            }).total,
            0.1825,
            1e-12,
          ),
      ],
      [
        "refuses",
        () =>
          throwsError(
            () =>
              resolveAutoMovieMaterialAssembly({
                assembly: wet,
                host: { thickness: 0.1835 },
              }),
            ["wet-wall", "$input.layers", "must sum to the host thickness"],
          ),
      ],
    ]),
    { matches: true, refuses: true },
  );

  const table = [
    substance("render-substance", { classification: "mortar" }),
    substance("block-substance", { classification: "masonry" }),
    substance("barrier-substance", { classification: "sheet" }),
    substance("board-substance", { classification: "board" }),
  ];
  TestValidator.equals(
    "cited substances must resolve against the supplied table",
    namedFacts([
      [
        "resolves",
        () =>
          resolveAutoMovieMaterialAssembly({
            assembly: wet,
            substances: table,
          }).layers.length === 5,
      ],
      [
        "refusesUnknown",
        () =>
          throwsError(
            () =>
              resolveAutoMovieMaterialAssembly({
                assembly: wet,
                substances: table.slice(1),
              }),
            [
              "$input.layers[0].material",
              'substance "render-substance" does not resolve',
            ],
          ),
      ],
    ]),
    { resolves: true, refusesUnknown: true },
  );
};
