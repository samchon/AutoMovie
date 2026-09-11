import { TestValidator } from "@nestia/e2e";

import {
  portraitMouthSocket,
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { portraitLipTriangles } from "../../subjects/generated-korean-girl-01/mouth";
import {
  appendPortraitNostrils,
  portraitNoseDepth,
  portraitNostrilContains,
} from "../../subjects/generated-korean-girl-01/nose";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Anatomical openings are topology, not a colour painted on a closed surface.
 *
 * Scenarios:
 * 1. Both nasal centres are inside, an exact vertical boundary and its outside
 *    neighbour are outside, and the midline is not a nostril.
 * 2. A two-triangle square makes four lining walls and a recessed floor. Its
 *    shared diagonal never becomes a wall; an empty cut is refused before NaN.
 * 3. The nasal edit lifts the alae, softens the tip and vanishes far away.
 * 4. Lip flooding crosses an internal edge, but neither anatomical boundary;
 *    a cage without its interior seed is refused.
 */
export const test_subject_anatomical_cutouts = (): void => {
  const noseShape = {
    ...portraitNoseShape,
    tipProjection: -2,
    alarProjection: 4,
    cavityContraction: 0.6,
    nostrilTilt: 0,
    cavityOffset: [0, 3, -5],
  };
  const noseSocket = {
    ...portraitNoseSocket,
    midline: 0,
    tipY: -6,
    tipRadius: [8, 9] as [number, number],
    alarOffset: 12.5,
    alarY: -13.5,
    alarRadius: 5.5,
  };
  const footprint = { x: 10.3, y: -14.5, width: 4.3, height: 1.9 };
  TestValidator.predicate(
    "paired nasal centres",
    portraitNostrilContains(10.3, -14.5, footprint) &&
      portraitNostrilContains(-10.3, -14.5, { ...footprint, x: -10.3 }),
  );
  TestValidator.equals(
    "nasal vertical boundary",
    portraitNostrilContains(10.3, -12.6, footprint),
    false,
  );
  TestValidator.equals(
    "outside nasal neighbour",
    portraitNostrilContains(10.3, -12.59, footprint),
    false,
  );
  TestValidator.equals(
    "midline is intact",
    portraitNostrilContains(0, -14.5, footprint),
    false,
  );
  const cage = {
    positions: [
      [9, -14, 60],
      [11, -14, 60],
      [11, -16, 60],
      [9, -16, 60],
    ],
    indices: [] as number[],
    groups: [] as number[],
  };
  appendPortraitNostrils(
    cage,
    [
      [
        [0, 1, 2],
        [0, 2, 3],
      ],
    ],
    noseShape,
    2,
  );
  TestValidator.equals(
    "recessed floor centre",
    cage.positions[cage.positions.length - 1],
    [10, -12, 55],
  );
  const support = cage.positions.slice(4, 8);
  TestValidator.predicate(
    "near rim precedes the deep cavity",
    support.every((point) => nclose(point[2], 59.5)) &&
      nclose(
        support.reduce((sum, point) => sum + point[1], 0) / support.length,
        -14.7,
      ),
  );
  TestValidator.equals(
    "four boundary walls with rim supports and floor fans",
    cage.indices.length,
    60,
  );
  TestValidator.predicate(
    "internal tissue label",
    cage.groups.every((group) => group === 2),
  );
  TestValidator.predicate(
    "empty opening refuses NaN",
    throwsError(() =>
      appendPortraitNostrils(
        { positions: [], indices: [], groups: [] },
        [[]],
        noseShape,
        2,
      ),
    ),
  );
  TestValidator.predicate(
    "alar lift and tip softening",
    portraitNoseDepth([12.5, -13.5, 0], noseSocket, noseShape) > 0 &&
      portraitNoseDepth([0, -6, 0], noseSocket, noseShape) < 0,
  );
  TestValidator.predicate(
    "paired depth edit",
    nclose(
      portraitNoseDepth([12.5, -13.5, 0], noseSocket, noseShape),
      portraitNoseDepth([-12.5, -13.5, 0], noseSocket, noseShape),
    ),
  );
  TestValidator.equals(
    "far field stays fixed",
    portraitNoseDepth([1000, 1000, 0], noseSocket, noseShape),
    0,
  );
  TestValidator.equals(
    "outer lip barrier",
    [
      ...portraitLipTriangles(
        [11, 61, 146, 61, 72, 11, 61, 9, 146],
        portraitMouthSocket,
      ),
    ].sort((a, b) => a - b),
    [0, 1],
  );
  TestValidator.equals(
    "inner lip barrier",
    [...portraitLipTriangles([11, 78, 95, 78, 1, 95], portraitMouthSocket)],
    [0],
  );
  TestValidator.predicate(
    "missing lip seed",
    throwsError(() => portraitLipTriangles([0, 1, 2], portraitMouthSocket)),
  );
  TestValidator.predicate(
    "empty lip cage",
    throwsError(() => portraitLipTriangles([], portraitMouthSocket)),
  );
};
