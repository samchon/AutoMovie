import {
  IAutoMovieFormationPlacement,
  formationSlotPosition,
  sampleFormationMotion,
} from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieFormationMotion,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, vclose } from "../internal/predicates";

const COUNT = 14;
const SPACING = { lateral: 2, depth: 3 };

/** The arrangement the unit is designed in. */
const line: IAutoMovieFormationDesign["layout"] = {
  kind: "line",
  ranks: 2,
  files: 7,
  spacing: SPACING,
};

/** The arrangement the first cue takes it to. */
const column: IAutoMovieFormationDesign["layout"] = {
  kind: "column",
  ranks: 7,
  files: 2,
  spacing: SPACING,
};

/** The arrangement the second cue takes it to, seating the same fourteen. */
const ring: IAutoMovieFormationDesign["layout"] = {
  kind: "perimeter",
  files: 5,
  ranks: 4,
  thickness: 1,
  spacing: SPACING,
};

const still = {
  translation: { x: 0, y: 0, z: 0 },
  facingOffsetDeg: 0,
  spacingScale: { lateral: 1, depth: 1 },
};

const cue = (
  id: string,
  start: number,
  end: number,
  layout: IAutoMovieFormationDesign["layout"],
): IAutoMovieFormationMotion => ({
  id,
  formation: "unit",
  action: "hold",
  start,
  end,
  from: still,
  to: still,
  easing: "linear",
  layout,
});

const unit: IAutoMovieFormationPlacement = {
  id: "unit",
  count: COUNT,
  layout: line,
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 4,
};

/** Where the unit's members stand in one arrangement, at rest. */
const places = (layout: IAutoMovieFormationDesign["layout"]) =>
  Array.from({ length: COUNT }, (_, slot) =>
    formationSlotPosition({ ...unit, layout }, slot),
  );

/**
 * A second re-form departs from where the unit is, not from where it began.
 *
 * `FORMATION_DESIGN` tells an author whose re-form the overlap gate refused to
 * take the change through an intermediate arrangement in two cues. That advice
 * did not work, and the reason was in the blend: `formationSlotPosition`
 * interpolated from the *design's* arrangement to the cue's target, whatever
 * had happened in between. So the second cue of a two-step change dragged every
 * member back toward its designed place before setting off again — the opposite
 * of the manoeuvre, and a longer path across more of the unit than the single
 * re-form the author was avoiding.
 *
 * The sampled state now carries the arrangement it departs from, null meaning
 * the design's own, and the blend reads it. Null rather than a copy of the
 * design layout, because a unit that has never re-formed and a unit whose last
 * re-form happened to end where it started are different histories.
 *
 * The discriminating reading is the midpoint of the second cue: both the old
 * behaviour and the new one agree at its end, because the target is the same,
 * and they disagree everywhere inside it. So the midpoint is asserted against
 * hand-composed places, and the wrong answer is asserted to be a different
 * point rather than merely absent.
 *
 * Scenarios:
 *
 * 1. Between the two cues the unit stands in the first cue's target and stays
 *    there, which is the state the second cue has to depart from.
 * 2. Halfway through the second cue each member stands at the midpoint of
 *    column-place and ring-place.
 * 3. That midpoint is not the midpoint of design-place and ring-place, for a
 *    member whose two departures differ — the reading that separates the fix
 *    from the bug it replaced.
 * 4. At the end of the second cue every member is in the ring, so departing
 *    from somewhere else did not move the destination.
 * 5. A unit whose first cue names no layout still departs from its design, so
 *    the chain does not invent a history for a unit that has none.
 */
export const test_world_formation_reform_chain = (): void => {
  const cues = [cue("to-column", 0, 2, column), cue("to-ring", 3, 5, ring)];
  const at = (time: number) => sampleFormationMotion(cues, "unit", time);
  const placed = (slot: number, time: number) =>
    formationSlotPosition(unit, slot, at(time).reform);

  const columnPlaces = places(column);
  const ringPlaces = places(ring);
  const designPlaces = places(line);

  /** The member whose two possible departures are furthest apart. */
  const SLOT = columnPlaces.reduce(
    (best, place, slot) =>
      Math.hypot(
        place.x - designPlaces[slot]!.x,
        place.z - designPlaces[slot]!.z,
      ) >
      Math.hypot(
        columnPlaces[best]!.x - designPlaces[best]!.x,
        columnPlaces[best]!.z - designPlaces[best]!.z,
      )
        ? slot
        : best,
    0,
  );
  const midpoint = (
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
  ) => ({
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2,
  });

  const fromColumn = midpoint(columnPlaces[SLOT]!, ringPlaces[SLOT]!);
  const fromDesign = midpoint(designPlaces[SLOT]!, ringPlaces[SLOT]!);

  TestValidator.equals(
    "a chained re-form leaves from the arrangement the unit is standing in",
    namedFacts([
      [
        "theTwoDeparturesReallyDiffer",
        () => vclose(fromColumn, fromDesign) === false,
      ],
      [
        "betweenTheCuesItStandsInTheFirstTarget",
        () => vclose(placed(SLOT, 2.5), columnPlaces[SLOT]!),
      ],
      [
        "halfwayThroughTheSecondItIsMidwayFromThere",
        () => vclose(placed(SLOT, 4), fromColumn),
      ],
      [
        "andNotMidwayFromItsDesign",
        () => vclose(placed(SLOT, 4), fromDesign) === false,
      ],
      [
        "everyMemberEndsInTheRing",
        () =>
          Array.from({ length: COUNT }, (_, slot) => slot).every((slot) =>
            vclose(placed(slot, 5), ringPlaces[slot]!),
          ),
      ],
      // A unit with no earlier re-form has no history to depart from, and must
      // still leave from its design rather than from a fabricated one.
      [
        "aFirstReFormStillDepartsFromTheDesign",
        () =>
          vclose(
            formationSlotPosition(
              unit,
              SLOT,
              sampleFormationMotion([cues[1]!], "unit", 4).reform,
            ),
            fromDesign,
          ),
      ],
    ]),
    {
      theTwoDeparturesReallyDiffer: true,
      betweenTheCuesItStandsInTheFirstTarget: true,
      halfwayThroughTheSecondItIsMidwayFromThere: true,
      andNotMidwayFromItsDesign: true,
      everyMemberEndsInTheRing: true,
      aFirstReFormStillDepartsFromTheDesign: true,
    },
  );
};
