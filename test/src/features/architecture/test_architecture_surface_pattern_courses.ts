import { generateAutoMovieSurfacePattern } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { pattern, rectangle, zone } from "../internal/patternFixtures";
import { namedFacts, nclose } from "../internal/predicates";

/**
 * A module program laid over a real region, in a fixed order, twice.
 *
 * The point of a pattern run is that it is a program and not a texture repeat:
 * it knows the module's real size, where each occurrence landed, which ones the
 * region cut, and by how much. This case pins that the lattice is enumerated
 * wide enough to catch every module that touches the region, narrow enough that
 * modules entirely outside it are absent rather than zero-area, and ordered so
 * two runs of the same declaration produce the same bytes.
 *
 * The field is a 2 x 1 m rectangle laid with 0.5 m squares on a 0.5 m lattice,
 * so eight whole modules cover it exactly.
 *
 * Scenarios:
 *
 * 1. Eight modules are laid in row-major cell order, and their occurrence ids
 *    carry both the zone and the generator's own module id.
 * 2. Every module is whole: coverage one, area 0.25 m², cut `none`, and the zone's
 *    material rides along on each occurrence.
 * 3. Cells whose modules fall entirely outside the region contribute nothing, even
 *    though the lattice was enumerated over them.
 * 4. Re-running the same declaration produces byte-identical output.
 * 5. Narrowing the region to 1.75 m cuts the last module of every course to half,
 *    marks it `boundary`, and leaves the whole ones untouched.
 * 6. A generator that lays nothing produces no occurrences, no waste ratio, and no
 *    findings, rather than a run that divides by zero.
 */
export const test_architecture_surface_pattern_courses = (): void => {
  const field = pattern();
  const laid = generateAutoMovieSurfacePattern({ pattern: field });

  TestValidator.equals(
    "modules are laid in row-major cell order under a zone-scoped identity",
    laid.placements.map((one) => one.id),
    [
      "field/t-0-0",
      "field/t-1-0",
      "field/t-2-0",
      "field/t-3-0",
      "field/t-0-1",
      "field/t-1-1",
      "field/t-2-1",
      "field/t-3-1",
    ],
  );

  TestValidator.equals(
    "every module of an exactly divisible field is whole",
    namedFacts([
      ["count", () => laid.placements.length === 8],
      ["cuts", () => laid.placements.every((one) => one.cut === "none")],
      [
        "coverage",
        () => laid.placements.every((one) => nclose(one.coverage, 1, 1e-12)),
      ],
      [
        "areas",
        () => laid.placements.every((one) => nclose(one.area, 0.25, 1e-12)),
      ],
      [
        "material",
        () => laid.placements.every((one) => one.material === "tile-surface"),
      ],
      [
        "zone",
        () =>
          laid.placements.every(
            (one) => one.zone === "field" && one.module.startsWith("t-"),
          ),
      ],
      [
        "outlines",
        () => laid.placements.every((one) => one.outline.length === 4),
      ],
      [
        "untouched",
        () => laid.placements.every((one) => one.punchedArea === 0),
      ],
      [
        "firstCentre",
        () =>
          nclose(laid.placements[0]!.center.u, 0.25, 1e-12) &&
          nclose(laid.placements[0]!.center.v, 0.25, 1e-12),
      ],
      [
        "lastCentre",
        () =>
          nclose(laid.placements[7]!.center.u, 1.75, 1e-12) &&
          nclose(laid.placements[7]!.center.v, 0.75, 1e-12),
      ],
    ]),
    {
      count: true,
      cuts: true,
      coverage: true,
      areas: true,
      material: true,
      zone: true,
      outlines: true,
      untouched: true,
      firstCentre: true,
      lastCentre: true,
    },
  );

  TestValidator.equals(
    "the take-off of an exactly divisible field wastes nothing",
    namedFacts([
      ["modules", () => laid.quantities.modules === 8],
      ["whole", () => laid.quantities.whole === 8],
      ["cut", () => laid.quantities.cut === 0],
      ["covered", () => nclose(laid.quantities.coveredArea, 2, 1e-12)],
      ["consumed", () => nclose(laid.quantities.consumedArea, 2, 1e-12)],
      ["waste", () => nclose(laid.quantities.wasteArea, 0, 1e-12)],
      ["ratio", () => nclose(laid.quantities.wasteRatio, 0, 1e-12)],
      ["net", () => nclose(laid.quantities.netRegionArea, 2, 1e-12)],
      ["jointArea", () => nclose(laid.quantities.jointArea, 0, 1e-12)],
      ["jointLength", () => laid.quantities.jointLength === 0],
      ["findings", () => laid.findings.length === 0],
    ]),
    {
      modules: true,
      whole: true,
      cut: true,
      covered: true,
      consumed: true,
      waste: true,
      ratio: true,
      net: true,
      jointArea: true,
      jointLength: true,
      findings: true,
    },
  );

  TestValidator.equals(
    "the same declaration laid twice produces the same bytes",
    JSON.stringify(generateAutoMovieSurfacePattern({ pattern: field })),
    JSON.stringify(laid),
  );

  const narrow = generateAutoMovieSurfacePattern({
    pattern: pattern({
      zones: [zone({ region: rectangle(0, 0, 1.75, 1) })],
      minimumPiece: 0.4,
    }),
  });
  TestValidator.equals(
    "a region that does not divide cuts the last module of every course",
    namedFacts([
      ["count", () => narrow.placements.length === 8],
      [
        "kinds",
        () =>
          narrow.placements.map((one) => one.cut).join() ===
          "none,none,none,boundary,none,none,none,boundary",
      ],
      [
        "coverage",
        () =>
          nclose(narrow.placements[3]!.coverage, 0.5, 1e-12) &&
          nclose(narrow.placements[7]!.coverage, 0.5, 1e-12),
      ],
      ["area", () => nclose(narrow.placements[3]!.area, 0.125, 1e-12)],
      ["covered", () => nclose(narrow.quantities.coveredArea, 1.75, 1e-12)],
      ["consumed", () => nclose(narrow.quantities.consumedArea, 2, 1e-12)],
      ["waste", () => nclose(narrow.quantities.wasteArea, 0.25, 1e-12)],
      ["ratio", () => nclose(narrow.quantities.wasteRatio, 0.125, 1e-12)],
      ["net", () => nclose(narrow.quantities.netRegionArea, 1.75, 1e-12)],
      ["whole", () => narrow.quantities.whole === 6],
      ["cutCount", () => narrow.quantities.cut === 2],
      [
        "outlineTrimmed",
        () =>
          narrow.placements[3]!.outline.every(
            (point) => point.u <= 1.75 + 1e-12,
          ),
      ],
    ]),
    {
      count: true,
      kinds: true,
      coverage: true,
      area: true,
      covered: true,
      consumed: true,
      waste: true,
      ratio: true,
      net: true,
      whole: true,
      cutCount: true,
      outlineTrimmed: true,
    },
  );

  const barren = generateAutoMovieSurfacePattern({
    pattern: pattern({ zones: [zone({ generate: () => [] })] }),
  });
  TestValidator.equals(
    "a program that lays nothing reports nothing rather than dividing by zero",
    namedFacts([
      ["placements", () => barren.placements.length === 0],
      ["modules", () => barren.quantities.modules === 0],
      ["consumed", () => barren.quantities.consumedArea === 0],
      ["ratio", () => barren.quantities.wasteRatio === 0],
      ["net", () => nclose(barren.quantities.netRegionArea, 2, 1e-12)],
      ["jointArea", () => nclose(barren.quantities.jointArea, 2, 1e-12)],
      ["findings", () => barren.findings.length === 0],
      ["zones", () => barren.quantities.zones.length === 1],
    ]),
    {
      placements: true,
      modules: true,
      consumed: true,
      ratio: true,
      net: true,
      jointArea: true,
      findings: true,
      zones: true,
    },
  );
};
