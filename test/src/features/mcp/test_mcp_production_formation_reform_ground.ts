import {
  IAutoMovieFormationPlacement,
  formationSlotPosition,
} from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieFormationMotion,
  IAutoMovieSpace,
} from "@automovie/interface";
import { validateAutoMovieFormationGround } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const FILES = 4;
const RANKS = 3;
const COUNT = FILES * RANKS;

/** Three ranks of four. */
const line: IAutoMovieFormationDesign["layout"] = {
  kind: "line",
  ranks: RANKS,
  files: FILES,
  spacing: { lateral: 2, depth: 3 },
};

/** The same twelve as four ranks of three, which seats nobody where it was. */
const column: IAutoMovieFormationDesign["layout"] = {
  kind: "column",
  ranks: FILES,
  files: RANKS,
  spacing: { lateral: 2, depth: 3 },
};

const unit = (
  layout: IAutoMovieFormationDesign["layout"] = line,
): IAutoMovieFormationPlacement => ({
  id: "block",
  count: COUNT,
  layout,
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 5,
});

/** A square of walkable floor, half a metre to a side, centred on one place. */
const pad = (
  id: string,
  centre: { x: number; z: number },
): IAutoMovieSpace["surfaces"][number] => ({
  id,
  kind: "floor",
  polygon: [
    { x: centre.x - 0.25, y: 0, z: centre.z - 0.25 },
    { x: centre.x + 0.25, y: 0, z: centre.z - 0.25 },
    { x: centre.x + 0.25, y: 0, z: centre.z + 0.25 },
    { x: centre.x - 0.25, y: 0, z: centre.z + 0.25 },
  ],
  anchor: { x: centre.x, y: 0, z: centre.z },
  rampTo: null,
});

/**
 * Floor under every place the unit stands in at either end, and nowhere else.
 *
 * The two arrangements are two metres and three metres apart at their closest,
 * so a pad half a metre wide under each place leaves the whole of every path
 * between them over nothing. That is the shape that separates a gate reading
 * the ends of a re-form from one walking its interior, and it is the same shape
 * the per-member channel is already held to.
 */
const pads = (): IAutoMovieSpace => {
  const surfaces = Array.from({ length: COUNT }, (_, slot) => slot).flatMap(
    (slot) => [
      pad(`designed-${slot}`, formationSlotPosition(unit(), slot)),
      pad(`target-${slot}`, formationSlotPosition(unit(column), slot)),
    ],
  );
  return {
    id: "pads",
    surfaces,
    walkable: surfaces.map((surface) => surface.id),
  };
};

/** One cue re-forming the unit across its whole window. */
const reform = (
  layout: IAutoMovieFormationDesign["layout"],
): IAutoMovieFormationMotion => {
  const still = {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  };
  return {
    id: "close-ranks",
    formation: "block",
    action: "hold",
    start: 1,
    end: 3,
    from: still,
    to: still,
    easing: "linear",
    layout,
  };
};

const codes = (
  space: IAutoMovieSpace | null,
  motions: IAutoMovieFormationMotion[],
): string[] =>
  validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space },
      formations: [unit()],
      formationMotions: motions,
    },
  ).map((diagnostic) => diagnostic.message);

/**
 * The ground gate walks a re-form rather than reading its ends.
 *
 * A cue that re-forms a unit moves every member along a path its two
 * arrangements do not describe, and a gate reading only where the unit starts
 * and finishes would accept a crowd that walks across a chasm on the way. The
 * gate already samples cue interiors; this is the reading that says the
 * arrangement moving under it is part of what it samples, rather than the
 * cached designed place it swept once before the cue began.
 *
 * Scenarios:
 *
 * 1. A unit standing still on floor that covers exactly its places is carried, so
 *    the pads are a real floor and not a refusal waiting to happen.
 * 2. The same unit re-forming across those pads is refused, because every path
 *    between two places crosses the gap between them -- which is the whole of
 *    what the interior walk exists to see.
 * 3. The refusal names a time inside the cue rather than either of its ends, so it
 *    is a reading of the walk and not of a place the unit rests at.
 */
export const test_mcp_production_formation_reform_ground = (): void => {
  const still = codes(pads(), []);
  const walked = codes(pads(), [reform(column)]);
  TestValidator.equals(
    "a re-forming unit is measured where it walks, not only where it stands",
    namedFacts([
      ["aUnitOnItsOwnPadsIsCarried", () => still.length === 0],
      ["aReFormAcrossTheGapIsRefused", () => walked.length === 1],
      // Neither end: the cue runs 1..3 and both ends stand on a pad, so a time
      // strictly between them is the only place this refusal can come from.
      [
        "andTheRefusalNamesAMomentInsideTheCue",
        () =>
          walked.length === 1 &&
          /at ([0-9.]+)s/u.test(walked[0]!) &&
          (() => {
            const at = Number(/at ([0-9.]+)s/u.exec(walked[0]!)![1]);
            return at > 1 && at < 3;
          })(),
      ],
    ]),
    {
      aUnitOnItsOwnPadsIsCarried: true,
      aReFormAcrossTheGapIsRefused: true,
      andTheRefusalNamesAMomentInsideTheCue: true,
    },
  );
};
