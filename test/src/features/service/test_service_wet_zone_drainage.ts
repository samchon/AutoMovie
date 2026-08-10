import {
  lowerWetZoneDrainage,
  validateFluidDomain,
  validateWetZones,
} from "@automovie/engine";
import { IAutoMovieFluidDomain } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  namedFacts,
  nclose,
  throwsError,
  violationCount,
} from "../internal/predicates";
import {
  serviceEnvironment,
  serviceNetwork,
  withNode,
  withPort,
  withZone,
} from "../internal/serviceFixtures";

const environment = serviceEnvironment();
const refuse = (network = serviceNetwork()) =>
  validateWetZones({ network, environment });

/** A lattice over the bath floor: four columns of `x`, five rows of `z`. */
const bathFloor = (
  overrides: Partial<IAutoMovieFluidDomain> = {},
): IAutoMovieFluidDomain => {
  const bed = new Array(20).fill(0);
  bed[14] = 0.125;
  return {
    version: 1,
    id: "bath-floor",
    units: "meter",
    grid: {
      columns: 4,
      rows: 5,
      cellX: 1,
      cellZ: 1,
      origin: { x: 0, y: 0, z: 0 },
    },
    solver: {
      fixedStepSeconds: 0.0625,
      gravity: 8,
      drag: 0,
      dryDepth: 0,
      referenceDepth: 0.5,
      maxSteps: 1000,
    },
    boundaries: { xMin: "wall", xMax: "wall", zMin: "wall", zMax: "wall" },
    bed,
    depth: new Array(20).fill(0),
    solid: new Array(20).fill(false),
    sources: [
      { id: "rain", column: 0, row: 0, flowRate: 0.001, start: 0, end: null },
    ],
    drains: [],
    sprays: [],
    ...overrides,
  };
};

/**
 * A wet room is a claim about where the water goes, and the claim is checked
 * against the two records that already know: the architecture and the network.
 *
 * A membrane is not a material here, it is a set of boundary ids, and a drain
 * is not a fitting model, it is a node that really carries an outgoing waste
 * port. That is what lets the zone be checked at all — it owns no geometry, so
 * it cannot quietly disagree with the room it covers or the pipe it falls to.
 * What it adds is the four obligations neither record states alone: cover
 * everything water can reach, declare every handover to a drier region,
 * actually fall, and fall to something that discharges.
 *
 * The lowering is the other half. Rather than inventing a weaker account of
 * moving water inside the building record, the zone's supply ports become an
 * independent shallow-water domain's declared sources and its gullies become
 * that domain's declared drains, at the lattice cells they stand over. A floor
 * gully's sill is the bed of its own cell, which is what a floor gully is.
 *
 * Scenarios:
 *
 * 1. The fixture's wet room and damp plant room validate clean together.
 * 2. Identity, grade and the two ratios are checked: a blank id, a duplicate, an
 *    unknown grade, and both a negative and a non-finite upturn and slope. One
 *    space may carry only one zone, because a second answers "is the far side
 *    drier" a second way.
 * 3. A zone on a space that does not resolve stops there rather than reporting
 *    every obligation it could not evaluate.
 * 4. Membrane and threshold citations must resolve, must not repeat, and must
 *    bound the zone's own space.
 * 5. A tanked zone must cover every boundary of its space; the uncovered one is
 *    named.
 * 6. Every handover to a drier region must be declared; two regions of the same
 *    grade need no threshold, which a zone lowered to `dry` proves.
 * 7. A tanked zone must fall, and must fall to at least one drain.
 * 8. A drain must resolve, stand in the zone's space, and carry an outgoing waste
 *    port; a duplicate is refused.
 * 9. The lowering composes into a valid fluid domain: authored inflows first, then
 *    one source per supply port in the room and one drain per gully, at the
 *    cells they stand over, with the gully's own bed as its sill.
 * 10. It refuses rather than repairs: an unknown zone, an unknown drain node, a
 *     node off the lattice on either side, a non-finite position, and a derived
 *     id that would shadow an authored source or drain.
 */
export const test_service_wet_zone_drainage = (): void => {
  const clean = serviceNetwork();

  TestValidator.equals(
    "the fixture's zones validate clean",
    refuse().success,
    true,
  );

  const identity = refuse({
    ...clean,
    zones: [
      ...clean.zones,
      { ...clean.zones[0]!, id: "   " },
      {
        ...clean.zones[0]!,
        space: "hall",
        grade: "soaked" as unknown as "wet",
        upturn: -1,
        slope: Number.NaN,
      },
      {
        ...clean.zones[0]!,
        id: "cellar-zone",
        space: "hall",
        grade: "damp",
        membrane: [],
        thresholds: [],
        drains: [],
        upturn: Number.NaN,
        slope: -1,
      },
    ],
  });
  TestValidator.equals(
    "identity, grade and the two ratios are each checked",
    namedFacts([
      ["blank", () => hasViolation(identity, "type", "$input.zones[2].id")],
      ["duplicate", () => hasViolation(identity, "type", "$input.zones[3].id")],
      ["grade", () => hasViolation(identity, "type", "$input.zones[3].grade")],
      [
        "negativeUpturn",
        () => hasViolation(identity, "range", "$input.zones[3].upturn"),
      ],
      [
        "nonFiniteSlope",
        () => hasViolation(identity, "range", "$input.zones[3].slope"),
      ],
      [
        "nonFiniteUpturn",
        () => hasViolation(identity, "range", "$input.zones[4].upturn"),
      ],
      [
        "negativeSlope",
        () => hasViolation(identity, "range", "$input.zones[4].slope"),
      ],
      [
        "oneZonePerSpace",
        () =>
          identity.success === false &&
          identity.violations.some(
            (item) =>
              item.path === "$input.zones[4].space" &&
              item.expected.includes('already carries wet zone "bath-zone"'),
          ),
      ],
    ]),
    {
      blank: true,
      duplicate: true,
      grade: true,
      negativeUpturn: true,
      nonFiniteSlope: true,
      nonFiniteUpturn: true,
      negativeSlope: true,
      oneZonePerSpace: true,
    },
  );

  const nowhere = refuse(
    withZone(clean, "bath-zone", (zone) => ({ ...zone, space: "attic" })),
  );
  TestValidator.equals(
    "a zone on a space that does not resolve stops there",
    namedFacts([
      ["space", () => hasViolation(nowhere, "type", "$input.zones[0].space")],
      ["alone", () => violationCount(nowhere) === 1],
    ]),
    { space: true, alone: true },
  );

  const citations = refuse(
    withZone(clean, "bath-zone", (zone) => ({
      ...zone,
      membrane: ["ghost", "bath-hall", "bath-hall", "bath-shell", "hall-plant"],
      thresholds: ["bath-hall", "plant-shell"],
    })),
  );
  TestValidator.equals(
    "membrane and threshold citations must resolve, not repeat, and bound the space",
    namedFacts([
      [
        "unknown",
        () => hasViolation(citations, "type", "$input.zones[0].membrane[0]"),
      ],
      [
        "repeated",
        () => hasViolation(citations, "type", "$input.zones[0].membrane[2]"),
      ],
      [
        "foreign",
        () => hasViolation(citations, "type", "$input.zones[0].membrane[4]"),
      ],
      [
        "thresholdForeign",
        () => hasViolation(citations, "type", "$input.zones[0].thresholds[1]"),
      ],
    ]),
    {
      unknown: true,
      repeated: true,
      foreign: true,
      thresholdForeign: true,
    },
  );

  const uncovered = refuse(
    withZone(clean, "bath-zone", (zone) => ({
      ...zone,
      membrane: ["bath-hall"],
    })),
  );
  const unbridged = refuse(
    withZone(clean, "bath-zone", (zone) => ({ ...zone, thresholds: [] })),
  );
  const evenGrade = refuse(
    withZone(clean, "plant-zone", (zone) => ({
      ...zone,
      grade: "dry",
      thresholds: [],
    })),
  );
  TestValidator.equals(
    "a tanked room is covered everywhere and declares every handover",
    namedFacts([
      [
        "uncovered",
        () =>
          hasViolation(uncovered, "coverage", "$input.zones[0].membrane") &&
          uncovered.success === false &&
          uncovered.violations.some((item) =>
            item.expected.includes('"bath-shell" is uncovered'),
          ),
      ],
      ["uncoveredAlone", () => violationCount(uncovered) === 1],
      [
        "unbridged",
        () =>
          hasViolation(unbridged, "coverage", "$input.zones[0].thresholds") &&
          violationCount(unbridged) === 1,
      ],
      ["evenGrade", () => evenGrade.success === true],
    ]),
    {
      uncovered: true,
      uncoveredAlone: true,
      unbridged: true,
      evenGrade: true,
    },
  );

  const flat = refuse(
    withZone(clean, "bath-zone", (zone) => ({
      ...zone,
      slope: 0,
      drains: [],
    })),
  );
  TestValidator.equals(
    "a tanked room must fall, and must fall to something",
    namedFacts([
      [
        "drains",
        () => hasViolation(flat, "coverage", "$input.zones[0].drains"),
      ],
      ["slope", () => hasViolation(flat, "range", "$input.zones[0].slope")],
      ["exactly", () => violationCount(flat) === 2],
    ]),
    { drains: true, slope: true, exactly: true },
  );

  const drains = refuse(
    withZone(clean, "bath-zone", (zone) => ({
      ...zone,
      drains: [
        "ghost",
        "hall-diffuser",
        "bath-valve",
        "floor-gully",
        "floor-gully",
      ],
    })),
  );
  TestValidator.equals(
    "a drain must exist, stand in the room, and really discharge",
    namedFacts([
      [
        "unknown",
        () => hasViolation(drains, "type", "$input.zones[0].drains[0]"),
      ],
      [
        "elsewhere",
        () =>
          drains.success === false &&
          drains.violations.some(
            (item) =>
              item.path === "$input.zones[0].drains[1]" &&
              item.expected.includes('stands in space "hall"'),
          ),
      ],
      [
        "noWastePort",
        () =>
          drains.success === false &&
          drains.violations.some(
            (item) =>
              item.path === "$input.zones[0].drains[2]" &&
              item.expected.includes("carries no outgoing waste-water port"),
          ),
      ],
      [
        "repeated",
        () => hasViolation(drains, "type", "$input.zones[0].drains[4]"),
      ],
    ]),
    { unknown: true, elsewhere: true, noWastePort: true, repeated: true },
  );

  const strandedDrain = refuse(
    withPort(clean, "gully-waste", (entry) => ({
      ...entry,
      system: "no-such-system",
    })),
  );
  TestValidator.predicate(
    "a gully whose waste port names no system discharges into nothing",
    strandedDrain.success === false &&
      strandedDrain.violations.some(
        (item) =>
          item.path === "$input.zones[0].drains[0]" &&
          item.expected.includes("carries no outgoing waste-water port"),
      ),
  );

  const lowered = lowerWetZoneDrainage({
    network: clean,
    zone: "bath-zone",
    domain: bathFloor(),
  });
  TestValidator.equals(
    "the room's plumbing becomes an independent domain's own sources and drains",
    namedFacts([
      [
        "sourceIds",
        () =>
          lowered.sources.map((entry) => entry.id).join() ===
          "rain,bath-zone/bath-valve-in,bath-zone/basin-cold,bath-zone/basin-hot",
      ],
      [
        "valveCell",
        () => lowered.sources[1]!.column === 3 && lowered.sources[1]!.row === 1,
      ],
      [
        "basinCell",
        () => lowered.sources[2]!.column === 1 && lowered.sources[2]!.row === 1,
      ],
      ["supplyRate", () => nclose(lowered.sources[2]!.flowRate, 0.0002, 1e-15)],
      [
        "drainIds",
        () =>
          lowered.drains.map((entry) => entry.id).join() ===
          "bath-zone/gully-waste",
      ],
      [
        "drainCell",
        () => lowered.drains[0]!.column === 2 && lowered.drains[0]!.row === 3,
      ],
      ["drainRate", () => nclose(lowered.drains[0]!.flowRate, 0.0006, 1e-15)],
      ["sill", () => nclose(lowered.drains[0]!.sillLevel, 0.125, 1e-15)],
      ["opensAtOnce", () => lowered.drains[0]!.start === 0],
      ["neverCloses", () => lowered.drains[0]!.end === null],
      ["stillValid", () => validateFluidDomain({ domain: lowered }).success],
      [
        "latticeUntouched",
        () => lowered.grid === bathFloor().grid || lowered.grid.columns === 4,
      ],
    ]),
    {
      sourceIds: true,
      valveCell: true,
      basinCell: true,
      supplyRate: true,
      drainIds: true,
      drainCell: true,
      drainRate: true,
      sill: true,
      opensAtOnce: true,
      neverCloses: true,
      stillValid: true,
      latticeUntouched: true,
    },
  );

  const strandedSupply = lowerWetZoneDrainage({
    network: withPort(clean, "basin-cold", (entry) => ({
      ...entry,
      system: "no-such-system",
    })),
    zone: "bath-zone",
    domain: bathFloor(),
  });
  TestValidator.equals(
    "a supply port naming no system delivers nothing the domain can count",
    strandedSupply.sources.map((entry) => entry.id).join(),
    "rain,bath-zone/bath-valve-in,bath-zone/basin-hot",
  );

  TestValidator.equals(
    "the lowering refuses what it cannot honestly place",
    namedFacts([
      [
        "unknownZone",
        () =>
          throwsError(
            () =>
              lowerWetZoneDrainage({
                network: clean,
                zone: "no-such-zone",
                domain: bathFloor(),
              }),
            ['has no wet zone "no-such-zone"'],
          ),
      ],
      [
        "unknownDrain",
        () =>
          throwsError(
            () =>
              lowerWetZoneDrainage({
                network: withZone(clean, "bath-zone", (zone) => ({
                  ...zone,
                  drains: ["ghost"],
                })),
                zone: "bath-zone",
                domain: bathFloor(),
              }),
            ['cites drain node "ghost"'],
          ),
      ],
      [
        "pastLattice",
        () =>
          throwsError(
            () =>
              lowerWetZoneDrainage({
                network: clean,
                zone: "bath-zone",
                domain: bathFloor({
                  grid: {
                    columns: 1,
                    rows: 1,
                    cellX: 1,
                    cellZ: 1,
                    origin: { x: 0, y: 0, z: 0 },
                  },
                }),
              }),
            ['node "bath-valve" stands off the lattice'],
          ),
      ],
      [
        "beforeLattice",
        () =>
          throwsError(
            () =>
              lowerWetZoneDrainage({
                network: clean,
                zone: "bath-zone",
                domain: bathFloor({
                  grid: {
                    columns: 4,
                    rows: 5,
                    cellX: 1,
                    cellZ: 1,
                    origin: { x: 5, y: 0, z: 5 },
                  },
                }),
              }),
            ["stands off the lattice"],
          ),
      ],
      [
        "nonFinite",
        () =>
          throwsError(
            () =>
              lowerWetZoneDrainage({
                network: withNode(clean, "bath-valve", (entry) => ({
                  ...entry,
                  position: { x: Number.NaN, y: 2.5, z: 1 },
                })),
                zone: "bath-zone",
                domain: bathFloor(),
              }),
            ["stands off the lattice"],
          ),
      ],
      [
        "sourceCollision",
        () =>
          throwsError(
            () =>
              lowerWetZoneDrainage({
                network: clean,
                zone: "bath-zone",
                domain: bathFloor({
                  sources: [
                    {
                      id: "bath-zone/basin-cold",
                      column: 0,
                      row: 0,
                      flowRate: 0,
                      start: 0,
                      end: null,
                    },
                  ],
                }),
              }),
            ['already declares a source named "bath-zone/basin-cold"'],
          ),
      ],
      [
        "drainCollision",
        () =>
          throwsError(
            () =>
              lowerWetZoneDrainage({
                network: clean,
                zone: "bath-zone",
                domain: bathFloor({
                  drains: [
                    {
                      id: "bath-zone/gully-waste",
                      column: 0,
                      row: 0,
                      flowRate: 0,
                      sillLevel: 0,
                      start: 0,
                      end: null,
                    },
                  ],
                }),
              }),
            ['already declares a drain named "bath-zone/gully-waste"'],
          ),
      ],
    ]),
    {
      unknownZone: true,
      unknownDrain: true,
      pastLattice: true,
      beforeLattice: true,
      nonFinite: true,
      sourceCollision: true,
      drainCollision: true,
    },
  );
};
