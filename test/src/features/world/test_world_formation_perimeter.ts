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

const LATERAL = 2;
const DEPTH = 3;

const perimeter = (props: {
  files: number;
  ranks: number;
  thickness: number;
}): IAutoMovieFormationDesign["layout"] => ({
  kind: "perimeter",
  files: props.files,
  ranks: props.ranks,
  thickness: props.thickness,
  spacing: { lateral: LATERAL, depth: DEPTH },
});

const unit = (
  layout: IAutoMovieFormationDesign["layout"],
  count: number,
): IAutoMovieFormationPlacement => ({
  id: "ring",
  count,
  layout,
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 11,
});

/** Every member's local place, with the anchor at the origin and no heading. */
const places = (formation: IAutoMovieFormationPlacement) =>
  Array.from({ length: formation.count }, (_, slot) =>
    formationSlotPosition(formation, slot),
  );

/**
 * A unit can stand in a closed ring around an empty middle, as one unit.
 *
 * `line` fills the rectangle it describes and `arc` closes only a circle, so
 * the arrangement a group takes when it faces outward around something -- a
 * square, a cordon, a ring of seats, spectators lining an enclosure -- had no
 * spelling at all. Four formations are not a substitute: a body that has to
 * re-form out of the arrangement and back into it has to be one body
 * throughout, with one identity and one slot order, and four units re-form into
 * nothing.
 *
 * What the layout owes is therefore two things at once. The places have to
 * describe a boundary with nothing inside it, and the walk that produces them
 * has to stay a walk: one member per place, corners not counted twice, and a
 * unit short of members leaving the ring open where the walk stopped rather
 * than spreading the shortfall around it. A ring that redistributed would put
 * its gap somewhere no order can name.
 *
 * Expectations are hand-computed from the stated spacings rather than read back
 * from the placement, so an arithmetic slip in the walk cannot ratify itself.
 *
 * Scenarios:
 *
 * 1. A five-by-four ring seats `2*5 + 2*4 - 4 = 14` members, one per place, and
 *    the corners are seated once rather than by both sides that meet there.
 * 2. Those places lie exactly on the rectangle's boundary: every member is on an
 *    outer side, and the middle the ring encloses is empty. That is the property
 *    a `line` of the same extent fails, which is why the layout exists.
 * 3. The walk runs front, right side, rear, left side, starting at the
 *    front-left corner: slots 0 and 4 are the front corners, 5 is the first
 *    member down the right side, 7 the far rear corner, and 13 the last member
 *    coming back up the left.
 * 4. A depth of two members has no side between its front and rear ranks, so the
 *    ring is those two ranks and nothing else -- a boundary case that still has
 *    no interior rather than a special layout.
 * 5. A unit short of its ring's capacity leaves the arrangement open at the point
 *    the walk reached: with ten of fourteen places filled, the left side is
 *    empty and no member has been moved to hide the gap.
 * 6. A second ring is placed inside the first, one spacing in on each axis and
 *    two members shorter on every side, and members overflow into it only once
 *    the outer ring is full.
 * 7. A unit designed as a line re-forms into the ring and every member arrives at
 *    the place the ring gives its own slot, which is the identity-preserving
 *    change four separate formations cannot make.
 */
export const test_world_formation_perimeter = (): void => {
  const ring = unit(perimeter({ files: 5, ranks: 4, thickness: 1 }), 14);
  const point = (slot: number) => formationSlotPosition(ring, slot);
  const half = ((5 - 1) / 2) * LATERAL;
  const rear = (4 - 1) * DEPTH;

  TestValidator.equals(
    "a five-by-four ring seats its boundary once and encloses an empty middle",
    namedFacts([
      // Distinct places, so the corners are not seated twice by the two sides
      // that meet at them.
      [
        "everyPlaceIsItsOwn",
        () =>
          new Set(places(ring).map((it) => `${it.x}|${it.z}`)).size ===
          ring.count,
      ],
      [
        "everyMemberStandsOnTheBoundary",
        () =>
          places(ring).every(
            (it) =>
              nclose(Math.abs(it.x), half) ||
              nclose(it.z, 0) ||
              nclose(it.z, rear),
          ),
      ],
      [
        "nobodyStandsInsideIt",
        () =>
          places(ring).some(
            (it) => Math.abs(it.x) < half && it.z > 0 && it.z < rear,
          ) === false,
      ],
      // The walk, read at the four places that fix its direction and origin.
      [
        "itStartsAtTheFrontLeftCorner",
        () => vclose(point(0), { x: -4, y: 0, z: 0 }),
      ],
      ["thenCrossesTheFront", () => vclose(point(4), { x: 4, y: 0, z: 0 })],
      [
        "thenGoesDownTheRightSide",
        () => vclose(point(5), { x: 4, y: 0, z: 3 }),
      ],
      ["thenBackAlongTheRear", () => vclose(point(7), { x: 4, y: 0, z: 9 })],
      [
        "andUpTheLeftSideToClose",
        () => vclose(point(13), { x: -4, y: 0, z: 3 }),
      ],
    ]),
    {
      everyPlaceIsItsOwn: true,
      everyMemberStandsOnTheBoundary: true,
      nobodyStandsInsideIt: true,
      itStartsAtTheFrontLeftCorner: true,
      thenCrossesTheFront: true,
      thenGoesDownTheRightSide: true,
      thenBackAlongTheRear: true,
      andUpTheLeftSideToClose: true,
    },
  );

  // Two ranks deep: the sides between front and rear hold nobody, so the ring
  // is the two ranks themselves. Capacity is 2*5 + 2*2 - 4 = 10.
  const shallow = unit(perimeter({ files: 5, ranks: 2, thickness: 1 }), 10);
  // Ten of the fourteen places of the first ring, so the walk stops partway
  // along the rear and the left side is never reached.
  const open = unit(perimeter({ files: 5, ranks: 4, thickness: 1 }), 10);
  // Six by six, two rings deep: 20 outside, 12 inside, 32 in all.
  const thick = unit(perimeter({ files: 6, ranks: 6, thickness: 2 }), 32);

  TestValidator.equals(
    "the boundary cases and the second ring are placed by the same walk",
    namedFacts([
      [
        "twoRanksAreTheWholeRing",
        () =>
          places(shallow).every((it) => nclose(it.z, 0) || nclose(it.z, DEPTH)),
      ],
      [
        "andTheShallowRingStillHasNoInterior",
        () => places(shallow).some((it) => it.z > 0 && it.z < DEPTH) === false,
      ],
      // Open at the end of the walk rather than redistributed: the shortfall
      // stays where the order put it, which is what makes it readable.
      [
        "aShortUnitLeavesTheRingOpenWhereTheWalkStopped",
        () =>
          places(open).every(
            (it) => nclose(it.x, -half) === false || nclose(it.z, 0),
          ),
      ],
      [
        "andTheMembersItDoesHaveKeepTheirPlaces",
        () => places(open).every((it, slot) => vclose(it, point(slot))),
      ],
      // The second ring: inset one spacing on each axis, and reached only after
      // the first is full.
      [
        "theOuterRingFillsFirst",
        () => vclose(formationSlotPosition(thick, 19), { x: -5, y: 0, z: 3 }),
      ],
      [
        "thenTheNextRingStartsOneSpacingIn",
        () => vclose(formationSlotPosition(thick, 20), { x: -3, y: 0, z: 3 }),
      ],
      [
        "andTheInnerRingIsTwoShorterOnEverySide",
        () => vclose(formationSlotPosition(thick, 23), { x: 3, y: 0, z: 3 }),
      ],
      [
        "andItsRearIsOneSpacingForwardOfTheOuterRear",
        () => vclose(formationSlotPosition(thick, 26), { x: 3, y: 0, z: 12 }),
      ],
    ]),
    {
      twoRanksAreTheWholeRing: true,
      andTheShallowRingStillHasNoInterior: true,
      aShortUnitLeavesTheRingOpenWhereTheWalkStopped: true,
      andTheMembersItDoesHaveKeepTheirPlaces: true,
      theOuterRingFillsFirst: true,
      thenTheNextRingStartsOneSpacingIn: true,
      andTheInnerRingIsTwoShorterOnEverySide: true,
      andItsRearIsOneSpacingForwardOfTheOuterRear: true,
    },
  );

  // The reported gap was not the shape on its own: it was a unit changing into
  // the shape and staying one unit while it does.
  const line: IAutoMovieFormationDesign["layout"] = {
    kind: "line",
    ranks: 2,
    files: 7,
    spacing: { lateral: LATERAL, depth: DEPTH },
  };
  const marching = unit(line, 14);
  const cue: IAutoMovieFormationMotion = {
    id: "form-square",
    formation: "ring",
    action: "hold",
    start: 0,
    end: 2,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    easing: "linear",
    layout: ring.layout,
  };
  const reformed = sampleFormationMotion([cue], "ring", 2).reform;

  TestValidator.equals(
    "one unit re-forms from a line into the ring without becoming four units",
    namedFacts([
      [
        "theTwoArrangementsAreReallyDifferent",
        () =>
          Array.from({ length: 14 }, (_, slot) => slot).some(
            (slot) =>
              vclose(
                formationSlotPosition(marching, slot),
                formationSlotPosition(ring, slot),
              ) === false,
          ),
      ],
      [
        "everyMemberArrivesAtTheRingPlaceForItsOwnSlot",
        () =>
          Array.from({ length: 14 }, (_, slot) => slot).every((slot) =>
            vclose(
              formationSlotPosition(marching, slot, reformed),
              formationSlotPosition(ring, slot),
            ),
          ),
      ],
    ]),
    {
      theTwoArrangementsAreReallyDifferent: true,
      everyMemberArrivesAtTheRingPlaceForItsOwnSlot: true,
    },
  );
};
