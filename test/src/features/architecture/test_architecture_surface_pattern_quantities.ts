import { generateAutoMovieSurfacePattern } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { pattern, rectangle, zone } from "../internal/patternFixtures";
import { namedFacts, nclose } from "../internal/predicates";

/**
 * Openings, drains, and a second zone, measured as quantity rather than drawn
 * over.
 *
 * A texture repeat covers an opening and reports nothing. A pattern program has
 * to step around it, say which pieces it bit into, and still add up: what was
 * laid, what was consumed to lay it, and what was thrown away. The exclusions
 * here are a 0.3 x 0.3 m opening sitting entirely inside one module and a 0.1 x
 * 0.1 m drain sitting inside a module the region had already cut, so all four
 * ways a module can be reduced occur in one run.
 *
 * The field is 1.75 x 1 m laid with 0.5 m squares, so its area is 1.75 m², its
 * exclusions take 0.09 and 0.01 m², and 1.65 m² is left to cover.
 *
 * Scenarios:
 *
 * 1. Every module names why it is not whole: `none`, `exclusion` where only a
 *    drain or opening reached it, `boundary` where only the region cut it, and
 *    `both` where the region cut it and an exclusion then bit into what was
 *    left.
 * 2. The area an exclusion took is reported per occurrence, so an opening's cost
 *    is traceable to the piece it was taken from.
 * 3. The take-off closes: 1.65 m² covered out of 2 m² consumed is 0.35 m² of
 *    offcut, a 0.175 waste ratio, and the covered area equals the region net of
 *    its exclusions, so the joint area is zero at a zero joint.
 * 4. Every punched occurrence raises an `unsupported-piece` finding naming the
 *    missing boolean difference, and a piece below the minimum raises a
 *    `sliver`; a piece exactly at the minimum does not.
 * 5. Two zones each lay their own program inside their own region and are reported
 *    apart as well as together.
 * 6. A non-zero joint turns the area the modules did not cover into a joint
 *    length, instead of reporting zero.
 */
export const test_architecture_surface_pattern_quantities = (): void => {
  const punched = generateAutoMovieSurfacePattern({
    pattern: pattern({
      zones: [zone({ region: rectangle(0, 0, 1.75, 1) })],
      exclusions: [
        { id: "opening", polygon: rectangle(0.6, 0.1, 0.9, 0.4) },
        { id: "drain", polygon: rectangle(1.55, 0.1, 1.65, 0.2) },
      ],
      minimumPiece: 0.5,
    }),
  });

  TestValidator.equals(
    "each module names why it is not whole",
    punched.placements.map((one) => `${one.module}:${one.cut}`),
    [
      "t-0-0:none",
      "t-1-0:exclusion",
      "t-2-0:none",
      "t-3-0:both",
      "t-0-1:none",
      "t-1-1:none",
      "t-2-1:none",
      "t-3-1:boundary",
    ],
  );

  TestValidator.equals(
    "the area an exclusion took is traceable to the piece it came from",
    namedFacts([
      [
        "openingBite",
        () => nclose(punched.placements[1]!.punchedArea, 0.09, 1e-12),
      ],
      [
        "drainBite",
        () => nclose(punched.placements[3]!.punchedArea, 0.01, 1e-12),
      ],
      [
        "untouched",
        () =>
          [0, 2, 4, 5, 6, 7].every(
            (index) => punched.placements[index]!.punchedArea === 0,
          ),
      ],
      [
        "areas",
        () =>
          nclose(punched.placements[1]!.area, 0.16, 1e-12) &&
          nclose(punched.placements[3]!.area, 0.115, 1e-12) &&
          nclose(punched.placements[7]!.area, 0.125, 1e-12),
      ],
      [
        "coverage",
        () =>
          nclose(punched.placements[1]!.coverage, 0.64, 1e-12) &&
          nclose(punched.placements[3]!.coverage, 0.46, 1e-12) &&
          nclose(punched.placements[7]!.coverage, 0.5, 1e-12),
      ],
    ]),
    {
      openingBite: true,
      drainBite: true,
      untouched: true,
      areas: true,
      coverage: true,
    },
  );

  TestValidator.equals(
    "the take-off closes against the region net of its exclusions",
    namedFacts([
      ["modules", () => punched.quantities.modules === 8],
      ["whole", () => punched.quantities.whole === 5],
      ["cut", () => punched.quantities.cut === 3],
      ["covered", () => nclose(punched.quantities.coveredArea, 1.65, 1e-12)],
      ["consumed", () => nclose(punched.quantities.consumedArea, 2, 1e-12)],
      ["waste", () => nclose(punched.quantities.wasteArea, 0.35, 1e-12)],
      ["ratio", () => nclose(punched.quantities.wasteRatio, 0.175, 1e-12)],
      ["net", () => nclose(punched.quantities.netRegionArea, 1.65, 1e-12)],
      ["jointArea", () => nclose(punched.quantities.jointArea, 0, 1e-12)],
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
    },
  );

  TestValidator.equals(
    "a punched piece is reported as unsupported and a small piece as a sliver",
    punched.findings.map((one) => `${one.kind}:${one.occurrences.join("+")}`),
    [
      "unsupported-piece:field/t-1-0",
      "sliver:field/t-3-0",
      "unsupported-piece:field/t-3-0",
    ],
  );
  TestValidator.equals(
    "each finding carries the measurement and the limit it failed",
    namedFacts([
      [
        "openingMeasure",
        () => nclose(punched.findings[0]!.measured, 0.09, 1e-12),
      ],
      ["openingLimit", () => punched.findings[0]!.limit === 0],
      [
        "openingDetail",
        () =>
          punched.findings[0]!.detail.includes("no boolean difference") &&
          punched.findings[0]!.detail.includes("field/t-1-0"),
      ],
      [
        "sliverMeasure",
        () => nclose(punched.findings[1]!.measured, 0.46, 1e-12),
      ],
      ["sliverLimit", () => nclose(punched.findings[1]!.limit, 0.5, 1e-12)],
      [
        "drainMeasure",
        () => nclose(punched.findings[2]!.measured, 0.01, 1e-12),
      ],
    ]),
    {
      openingMeasure: true,
      openingLimit: true,
      openingDetail: true,
      sliverMeasure: true,
      sliverLimit: true,
      drainMeasure: true,
    },
  );

  const swallowed = generateAutoMovieSurfacePattern({
    pattern: pattern({
      exclusions: [{ id: "shaft", polygon: rectangle(0.5, 0, 1, 0.5) }],
    }),
  });
  TestValidator.equals(
    "a module an exclusion swallows whole is absent, not a zero-area occurrence",
    namedFacts([
      [
        "ids",
        () =>
          swallowed.placements.map((one) => one.module).join() ===
          "t-0-0,t-2-0,t-3-0,t-0-1,t-1-1,t-2-1,t-3-1",
      ],
      ["whole", () => swallowed.quantities.whole === 7],
      ["cut", () => swallowed.quantities.cut === 0],
      ["covered", () => nclose(swallowed.quantities.coveredArea, 1.75, 1e-12)],
      ["net", () => nclose(swallowed.quantities.netRegionArea, 1.75, 1e-12)],
      ["jointArea", () => nclose(swallowed.quantities.jointArea, 0, 1e-12)],
      ["findings", () => swallowed.findings.length === 0],
    ]),
    {
      ids: true,
      whole: true,
      cut: true,
      covered: true,
      net: true,
      jointArea: true,
      findings: true,
    },
  );

  const paired = generateAutoMovieSurfacePattern({
    pattern: pattern({
      zones: [
        zone({ id: "a", region: rectangle(0, 0, 1, 1) }),
        zone({
          id: "b",
          region: rectangle(1, 0, 2, 1),
          origin: { u: 1, v: 0 },
          material: "stone-surface",
        }),
      ],
    }),
  });
  TestValidator.equals(
    "two zones lay their own programs inside their own regions",
    paired.placements.map((one) => one.id),
    [
      "a/t-0-0",
      "a/t-1-0",
      "a/t-0-1",
      "a/t-1-1",
      "b/t-0-0",
      "b/t-1-0",
      "b/t-0-1",
      "b/t-1-1",
    ],
  );
  TestValidator.equals(
    "each zone is reported apart as well as together",
    namedFacts([
      [
        "zones",
        () => paired.quantities.zones.map((one) => one.zone).join() === "a,b",
      ],
      [
        "modules",
        () => paired.quantities.zones.every((one) => one.modules === 4),
      ],
      [
        "covered",
        () =>
          paired.quantities.zones.every((one) =>
            nclose(one.coveredArea, 1, 1e-12),
          ),
      ],
      [
        "net",
        () =>
          paired.quantities.zones.every((one) =>
            nclose(one.netRegionArea, 1, 1e-12),
          ),
      ],
      [
        "waste",
        () => paired.quantities.zones.every((one) => one.wasteArea === 0),
      ],
      ["total", () => nclose(paired.quantities.coveredArea, 2, 1e-12)],
      [
        "materials",
        () =>
          paired.placements.filter((one) => one.material === "stone-surface")
            .length === 4,
      ],
    ]),
    {
      zones: true,
      modules: true,
      covered: true,
      net: true,
      waste: true,
      total: true,
      materials: true,
    },
  );

  const jointed = generateAutoMovieSurfacePattern({
    pattern: pattern({
      zones: [zone({ generate: () => [] })],
      joint: 0.01,
      adjacency: 0.02,
      jointTolerance: 0.002,
    }),
  });
  TestValidator.equals(
    "an uncovered area becomes a joint length at a non-zero joint",
    namedFacts([
      ["jointArea", () => nclose(jointed.quantities.jointArea, 2, 1e-12)],
      ["jointLength", () => nclose(jointed.quantities.jointLength, 200, 1e-9)],
    ]),
    { jointArea: true, jointLength: true },
  );
};
