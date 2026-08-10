import {
  propBlockedPassages,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMoviePropBox,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const box = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): IAutoMoviePropBox => ({
  min: { x: minX, y: 0.4, z: minZ },
  max: { x: maxX, y: 1.4, z: maxZ },
});

/**
 * Three corridors whose usable section is stated three different ways.
 *
 * `taper` narrows station by station across two route segments, `bulge` widens
 * in the middle of a single segment, and `unstated` declares no section at all.
 * The spaces carry no cells because nothing here asks about containment: what
 * is under test is the volume a connector sweeps, and that comes from the route
 * and the section alone.
 */
const corridors = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "wing",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "whole" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: null,
      space: "whole",
    },
  ],
  spaces: [
    { id: "whole", kind: "building", parent: null, cells: [] },
    { id: "west", kind: "hall", parent: "whole", cells: [] },
    { id: "east", kind: "hall", parent: "whole", cells: [] },
  ],
  boundaries: [],
  openings: [],
  connectors: [
    {
      id: "taper",
      kind: "passage",
      from: "west",
      to: "east",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 20, y: 0, z: 0 },
      ],
      sections: [
        { at: 0, width: 4, clearHeight: 2 },
        { at: 0.5, width: 2, clearHeight: 2 },
        { at: 1, width: 1, clearHeight: 2 },
      ],
      elements: [],
    },
    {
      id: "bulge",
      kind: "passage",
      from: "west",
      to: "east",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 10 },
        { x: 20, y: 0, z: 10 },
      ],
      sections: [
        { at: 0, width: 1, clearHeight: 2 },
        { at: 0.5, width: 4, clearHeight: 2 },
        { at: 1, width: 1, clearHeight: 2 },
      ],
      elements: [],
    },
    {
      id: "unstated",
      kind: "passage",
      from: "west",
      to: "east",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 20 },
        { x: 10, y: 0, z: 20 },
      ],
      elements: [],
    },
  ],
  surfaces: [],
  walkable: [],
});

/** The ids a probe volume is reported to block, in report order. */
const blocked = (bounds: IAutoMoviePropBox): string[] =>
  propBlockedPassages({ environment: corridors(), bounds }).map(
    (blockage) => blockage.id,
  );

/**
 * A prop blocks the corridor that is actually there, at the width the corridor
 * actually has where the prop stands. A varying section made "the usable width"
 * a function of position rather than one number, and this pins that the swept
 * volume follows it: the same probe blocks the wide end of a tapering corridor
 * and clears its narrow end. It also pins the refusal to guess: a connector
 * whose section nobody declared sweeps nothing, because an unstated width is
 * not a width of zero and the missing declaration is reported by validation,
 * where it can be fixed.
 *
 * Scenarios:
 *
 * 1. A probe 1.5 m off the centre line blocks the 4 m-wide first segment of a
 *    tapering corridor.
 * 2. The same offset clears that corridor's 2 m-wide second segment, so the
 *    section is read where the segment is rather than once for the whole
 *    route.
 * 3. A station interior to a single segment still widens it: a corridor that
 *    bulges only in the middle blocks a probe its end sections would clear, and
 *    still clears a probe beyond its widest station.
 * 4. A connector declaring no section at all reports nothing, while the same probe
 *    against the same route blocks it the moment a section is stated, and
 *    validation refuses the undeclared record at the field that is missing.
 * 5. A probe clear of every corridor blocks nothing.
 */
export const test_film_prop_passage_section = (): void => {
  TestValidator.equals(
    "the swept corridor follows the section stated where the prop stands",
    namedFacts([
      // Segment one spans at [0, 0.5], whose widest station is 4 m, so its
      // sweep reaches 2 m either side of the centre line.
      ["wideEndBlocked", () => blocked(box(4, 1.4, 5, 1.6)).includes("taper")],
      // Segment two spans at [0.5, 1], whose widest station is 2 m, so the
      // same 1.5 m offset is outside it.
      [
        "narrowEndCleared",
        () => blocked(box(14, 1.4, 15, 1.6)).includes("taper") === false,
      ],
      // The bulge is interior to the only segment, so it must still be
      // sampled: at 1.4 m off the centre line the two end sections alone (1 m
      // wide, so 0.5 m either side) would have cleared this probe.
      [
        "interiorStationCounts",
        () => blocked(box(9, 11.4, 11, 11.6)).includes("bulge"),
      ],
      [
        "beyondTheWidestStationIsClear",
        () => blocked(box(9, 12.4, 11, 12.6)).includes("bulge") === false,
      ],
      [
        "unstatedSectionSweepsNothing",
        () => blocked(box(0, 19.5, 10, 20.5)).includes("unstated") === false,
      ],
      // Without this twin the fact above would hold just as well if the probe
      // had been nowhere near the route, or if nothing were ever reported.
      // The probe is on the route; only the missing declaration silences it.
      [
        "theSameProbeBlocksOnceTheSectionIsStated",
        () => {
          const stated = corridors();
          stated.connectors[2]!.width = 2;
          stated.connectors[2]!.clearHeight = 2;
          return propBlockedPassages({
            environment: stated,
            bounds: box(0, 19.5, 10, 20.5),
          }).some((blockage) => blockage.id === "unstated");
        },
      ],
      ["clearOfEverything", () => blocked(box(50, 50, 51, 51)).length === 0],
    ]),
    {
      wideEndBlocked: true,
      narrowEndCleared: true,
      interiorStationCounts: true,
      beyondTheWidestStationIsClear: true,
      unstatedSectionSweepsNothing: true,
      theSameProbeBlocksOnceTheSectionIsStated: true,
      clearOfEverything: true,
    },
  );

  TestValidator.equals(
    "the undeclared section is refused by validation, not guessed at here",
    (() => {
      const validation = validateBuiltEnvironment({
        environment: corridors(),
      });
      return validation.success === true
        ? []
        : validation.violations.map((violation) => violation.path);
    })(),
    ["$input.connectors[2].width"],
  );
};
