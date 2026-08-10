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

import { namedFacts, nclose, vclose } from "../internal/predicates";

const FILES = 4;
const RANKS = 3;
const COUNT = FILES * RANKS;

/** Three ranks of four, the arrangement the unit is designed in. */
const line: IAutoMovieFormationDesign["layout"] = {
  kind: "line",
  ranks: RANKS,
  files: FILES,
  spacing: { lateral: 2, depth: 3 },
};

/**
 * The same twelve as four ranks of three, seated the other way round.
 *
 * A column fills its files before its ranks where a line fills its ranks before
 * its files, so no member keeps its place: this is a re-arrangement and not the
 * same arrangement at another spacing, which is what makes the midpoints below
 * readings of the blend rather than of a scale.
 */
const column: IAutoMovieFormationDesign["layout"] = {
  kind: "column",
  ranks: FILES,
  files: RANKS,
  spacing: { lateral: 2, depth: 3 },
};

const unit = (facingDeg = 0): IAutoMovieFormationPlacement => ({
  id: "block",
  count: COUNT,
  layout: line,
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg,
  seed: 5,
});

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

/**
 * A crowd can change the arrangement it stands in, not only its spacing.
 *
 * A unit's `layout` is a design constant, so the only arrangement channel a cue
 * had was `spacingScale`: a unit could open and close and never re-form. That
 * is the wrong vocabulary for a film whose scenes turn on a mass changing
 * shape, and the limitation was in the grammar rather than in the engine --
 * every layout already knows where its own members stand.
 *
 * A cue now names the arrangement it ends in and each member travels from its
 * designed place to its place there. The blend is over PLACES and not over
 * layout parameters, which is why any two arrangements re-form into one another
 * whatever their kinds, and why no layout algorithm needs to know that another
 * exists.
 *
 * Scenarios:
 *
 * 1. Before the cue starts, every member stands exactly where the design put it: a
 *    declared re-form does not reach backwards.
 * 2. Halfway through, each member stands at the midpoint of its two places, and
 *    the two places are different for the members checked, so a reader that
 *    returned either end lands somewhere the midpoint is not.
 * 3. At the end, every member stands exactly where the target arrangement puts it,
 *    and it stays there after the cue closes rather than snapping back.
 * 4. The blend happens in the unit's own frame: the same re-form under a turned
 *    unit puts each member at the turned image of the untuned midpoint, which a
 *    blend of world points would not.
 */
export const test_world_formation_reform = (): void => {
  const cues = [reform(column)];
  const at = (time: number) => sampleFormationMotion(cues, "block", time);
  const placed = (
    formation: IAutoMovieFormationPlacement,
    slot: number,
    time: number,
  ) => formationSlotPosition(formation, slot, at(time).reform);

  const straight = unit();
  const designed = (slot: number) => formationSlotPosition(straight, slot);
  const target = (slot: number) =>
    formationSlotPosition({ ...straight, layout: column }, slot);

  // A member whose two places differ in both axes, so neither a lateral nor a
  // depth blend alone can produce the midpoint below.
  const SLOT = 6;
  const midpoint = {
    x: (designed(SLOT).x + target(SLOT).x) / 2,
    y: (designed(SLOT).y + target(SLOT).y) / 2,
    z: (designed(SLOT).z + target(SLOT).z) / 2,
  };

  TestValidator.equals(
    "a unit re-forms from where it was designed to where its cue names",
    namedFacts([
      [
        "theTwoArrangementsPutItSomewhereElse",
        () =>
          nclose(designed(SLOT).x, target(SLOT).x) === false &&
          nclose(designed(SLOT).z, target(SLOT).z) === false,
      ],
      [
        "beforeTheCueItStandsWhereItWasDesigned",
        () => vclose(placed(straight, SLOT, 0.5), designed(SLOT)),
      ],
      [
        "halfwayItStandsAtTheMidpointOfItsTwoPlaces",
        () => vclose(placed(straight, SLOT, 2), midpoint),
      ],
      [
        "atTheEndItStandsWhereTheTargetPutsIt",
        () => vclose(placed(straight, SLOT, 3), target(SLOT)),
      ],
      // Held rather than released: a unit that re-formed has re-formed, and a
      // cue closing is not the unit walking back to its design.
      [
        "afterTheCueItStaysThere",
        () => vclose(placed(straight, SLOT, 9), target(SLOT)),
      ],
      // Every member, not the one read above: a blend that moved one member and
      // left the rest is not a re-form.
      [
        "everyMemberArrivesInTheTargetArrangement",
        () =>
          Array.from({ length: COUNT }, (_, slot) => slot).every((slot) =>
            vclose(placed(straight, slot, 3), target(slot)),
          ),
      ],
    ]),
    {
      theTwoArrangementsPutItSomewhereElse: true,
      beforeTheCueItStandsWhereItWasDesigned: true,
      halfwayItStandsAtTheMidpointOfItsTwoPlaces: true,
      atTheEndItStandsWhereTheTargetPutsIt: true,
      afterTheCueItStaysThere: true,
      everyMemberArrivesInTheTargetArrangement: true,
    },
  );

  // A quarter turn, read at the same instant. Stated as a consistency reading
  // and not as a discriminating one: rotation is linear, so blending two turned
  // places and turning one blended place agree here, and what this pins is that
  // the re-form does not quietly pick a different frame for a turned unit. The
  // reading that separates the two frames needs a cue that turns the unit as it
  // re-forms, which is applied a layer up in `placeFormationSlot`.
  const turned = unit(90);
  const turnedMidpoint = {
    x: midpoint.z,
    y: midpoint.y,
    z: -midpoint.x,
  };
  TestValidator.equals(
    "the re-form happens inside the unit, before its heading is applied",
    namedFacts([
      [
        "aTurnedUnitReFormsAboutItsOwnAxes",
        () => vclose(placed(turned, SLOT, 2), turnedMidpoint),
      ],
      [
        "andItsEndsAreTheTurnedArrangement",
        () =>
          vclose(
            placed(turned, SLOT, 3),
            formationSlotPosition({ ...turned, layout: column }, SLOT),
          ),
      ],
    ]),
    {
      aTurnedUnitReFormsAboutItsOwnAxes: true,
      andItsEndsAreTheTurnedArrangement: true,
    },
  );
};
