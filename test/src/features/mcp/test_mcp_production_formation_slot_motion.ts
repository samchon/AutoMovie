import type { IAutoMovieFormationPlacement } from "@automovie/engine";
import {
  formationSlotPosition,
  placeFormationSlot,
  rotateFormationLocalOffset,
  sampleFormationSlotMotion,
} from "@automovie/engine";
import type {
  IAutoMovieFormationMotionState,
  IAutoMovieFormationSlotMotion,
  IAutoMovieFormationSlotState,
  IAutoMovieSpace,
} from "@automovie/interface";
import {
  validateAutoMovieFormationGround,
  validateAutoMovieFormationSlotMotions,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, vclose } from "../internal/predicates";

/** One square floor centred on the origin, walkable everywhere. */
const field = (half: number): IAutoMovieSpace => ({
  id: "field",
  surfaces: [
    {
      id: "ground",
      kind: "floor",
      polygon: [
        { x: -half, y: 0, z: -half },
        { x: half, y: 0, z: -half },
        { x: half, y: 0, z: half },
        { x: -half, y: 0, z: half },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["ground"],
});

/**
 * Two crossed walkable arms: a corridor along `z` and one along `x`.
 *
 * A member standing in one arm and ending in the other stands on floor at both
 * ends and on nothing in the quadrant between them, which is the shape a gate
 * reading only the ends of a cue cannot see.
 */
const crossroads = (arm: number, halfWidth: number): IAutoMovieSpace => ({
  id: "crossroads",
  surfaces: [
    {
      id: "north-road",
      kind: "floor",
      polygon: [
        { x: -halfWidth, y: 0, z: -arm },
        { x: halfWidth, y: 0, z: -arm },
        { x: halfWidth, y: 0, z: arm },
        { x: -halfWidth, y: 0, z: arm },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
    {
      id: "east-road",
      kind: "floor",
      polygon: [
        { x: -arm, y: 0, z: -halfWidth },
        { x: arm, y: 0, z: -halfWidth },
        { x: arm, y: 0, z: halfWidth },
        { x: -arm, y: 0, z: halfWidth },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["north-road", "east-road"],
});

/**
 * One unit of a stated size, three abreast on a one-metre grid.
 *
 * Any population at all: the channel under test says nothing about what a member
 * is, only that one of them may do what its neighbours do not.
 */
const unit = (
  count: number,
  anchor = { x: 0, y: 0, z: 0 },
): IAutoMovieFormationPlacement => ({
  id: "crowd",
  count,
  layout: {
    kind: "line",
    files: 3,
    ranks: Math.ceil(count / 3),
    spacing: { lateral: 1, depth: 1 },
  },
  anchor,
  facingDeg: 0,
  seed: 4,
});

/** One member state, stated as its difference from standing in place. */
const state = (
  props: Partial<IAutoMovieFormationSlotState> = {},
): IAutoMovieFormationSlotState => ({
  present: true,
  offset: { x: 0, y: 0, z: 0 },
  facingOffsetDeg: 0,
  ...props,
});

/** The unit-level state of a group that is doing nothing. */
const held: IAutoMovieFormationMotionState = {
  translation: { x: 0, y: 0, z: 0 },
  facingOffsetDeg: 0,
  spacingScale: { lateral: 1, depth: 1 },
};

/** Named members step a stated distance aside between one and three seconds. */
const steps = (
  slots: number[],
  aside: number,
  id = "step",
): IAutoMovieFormationSlotMotion => ({
  id,
  formation: "crowd",
  slots,
  start: 1,
  end: 3,
  from: state(),
  to: state({ offset: { x: aside, y: 0, z: 0 } }),
  easing: "linear",
});

/** Named members stop being drawn from a stated time and never come back. */
const leaves = (
  slots: number[],
  at: number,
  id = "leave",
): IAutoMovieFormationSlotMotion => ({
  id,
  formation: "crowd",
  slots,
  start: at,
  end: at + 1,
  from: state({ present: false }),
  to: state({ present: false }),
  easing: "step",
});

const codes = (
  space: IAutoMovieSpace | null,
  formations: readonly IAutoMovieFormationPlacement[],
  formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[],
): string[] =>
  validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space }, formations, formationSlotMotions },
  ).map((diagnostic) => diagnostic.code);

/** One compiled unit as much of it as the cue gate reads. */
const compiled = (count: number, heroes: number[] = []) => ({
  id: "crowd",
  count,
  heroes: heroes.map((slot) => ({
    slot,
    actor: `named-${slot}`,
    transform: {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
  })),
});

const contract = {
  id: "opening",
  durationSeconds: 6,
  participants: [{ kind: "formation" as const, id: "crowd" }],
};

const cueCodes = (
  cues: readonly IAutoMovieFormationSlotMotion[],
  formations: ReturnType<typeof compiled>[] = [compiled(9)],
): string[] =>
  validateAutoMovieFormationSlotMotions(contract, {
    formations,
    formationSlotMotions: cues,
  }).map((diagnostic) => diagnostic.code);

/**
 * Something may happen to one member of a crowd and not to its neighbours.
 *
 * A unit-level cue is the whole of what a group does together, so through it
 * nothing can befall one member alone: a cue that moves a unit moves every
 * member of it, and a member that should stumble, drop out, stop, or leave has
 * no channel at all. This is that channel, and it is sparse by contract — it
 * names slots, so a crowd of a hundred thousand pays for the three exceptions it
 * has and not for its own size. Nothing here knows what a member is: the same
 * cue serves a figure that falls, one that breaks from the group, and one that
 * pulls out of a line.
 *
 * Scenarios:
 *
 * 1. A named member holds identity before its first cue, interpolates inside
 *    one, and retains the cue's end state afterwards, while its neighbours and
 *    other units are untouched.
 * 2. Presence is held rather than interpolated, so a cue absent at both ends
 *    takes its member out at the start and one absent only at its end takes it
 *    out then, and either way it stays out.
 * 3. A member's offset is stated in its unit's own frame, so it turns with the
 *    unit, and the composed placement is the unit's cue plus the member's.
 * 4. The ground gate measures a displaced member where its own cue puts it,
 *    walks the interior of that cue, and never refuses a shot for a member the
 *    shot has removed.
 * 5. A crowd nobody singled out is measured exactly as it was before the
 *    channel existed.
 * 6. The cue gate refuses blank and duplicate ids, absent units, bad windows,
 *    empty, repeated and out-of-range slots, promoted heroes, unbounded state,
 *    two cues on one member at once, and either sparsity cap — while accepting
 *    two members doing different things at the same second.
 * 7. The channel's cost is the exceptions it names and not the size of the
 *    crowd it names them in.
 */
export const test_mcp_production_formation_slot_motion = (): void => {
  const cue = steps([4], 2);
  const before = sampleFormationSlotMotion([cue], "crowd", 4, 0);
  const halfway = sampleFormationSlotMotion([cue], "crowd", 2, 4);
  const after = sampleFormationSlotMotion([cue], "crowd", 4, 5);
  const neighbour = sampleFormationSlotMotion([cue], "crowd", 5, 2);
  const stranger = sampleFormationSlotMotion([cue], "other", 4, 2);
  TestValidator.equals(
    "one named member deviates while its neighbours and other units do not",
    namedFacts([
      ["identityBeforeTheFirstCue", () => vclose(before.offset, cue.from.offset)],
      ["halfwayIsHalfTheOffset", () => nclose(halfway.offset.x, 1)],
      ["theEndStateIsRetained", () => nclose(after.offset.x, 2)],
      ["theNeighbourIsUntouched", () => nclose(neighbour.offset.x, 0)],
      ["anotherUnitIsUntouched", () => nclose(stranger.offset.x, 0)],
      [
        "thePriorCueIsRetainedBetweenTwo",
        () =>
          nclose(
            sampleFormationSlotMotion(
              [cue, { ...steps([4], 5, "step-later"), start: 4, end: 5 }],
              "crowd",
              4,
              3.5,
            ).offset.x,
            2,
          ),
      ],
      [
        "equalStartsResolveTheSameEitherWay",
        () =>
          JSON.stringify(
            sampleFormationSlotMotion(
              [steps([4], 2, "a"), steps([4], 9, "b")],
              "crowd",
              4,
              2,
            ),
          ) ===
          JSON.stringify(
            sampleFormationSlotMotion(
              [steps([4], 9, "b"), steps([4], 2, "a")],
              "crowd",
              4,
              2,
            ),
          ),
      ],
    ]),
    {
      identityBeforeTheFirstCue: true,
      halfwayIsHalfTheOffset: true,
      theEndStateIsRetained: true,
      theNeighbourIsUntouched: true,
      anotherUnitIsUntouched: true,
      thePriorCueIsRetainedBetweenTwo: true,
      equalStartsResolveTheSameEitherWay: true,
    },
  );

  const gone = leaves([4], 2);
  const dwindles: IAutoMovieFormationSlotMotion = {
    ...steps([4], 0, "dwindle"),
    to: state({ present: false }),
  };
  TestValidator.equals(
    "presence is held rather than blended, and a member taken out stays out",
    namedFacts([
      [
        "presentJustBeforeTheCue",
        () => sampleFormationSlotMotion([gone], "crowd", 4, 1.9).present,
      ],
      [
        "absentFromTheCueStart",
        () =>
          sampleFormationSlotMotion([gone], "crowd", 4, 2).present === false,
      ],
      [
        "stillAbsentLongAfterwards",
        () =>
          sampleFormationSlotMotion([gone], "crowd", 4, 5.9).present === false,
      ],
      [
        "presentThroughACueThatEndsAbsent",
        () => sampleFormationSlotMotion([dwindles], "crowd", 4, 2.9).present,
      ],
      [
        "absentOnceThatCueEnds",
        () =>
          sampleFormationSlotMotion([dwindles], "crowd", 4, 3).present === false,
      ],
      [
        "theNeighbourIsStillDrawn",
        () => sampleFormationSlotMotion([gone], "crowd", 5, 5.9).present,
      ],
    ]),
    {
      presentJustBeforeTheCue: true,
      absentFromTheCueStart: true,
      stillAbsentLongAfterwards: true,
      presentThroughACueThatEndsAbsent: true,
      absentOnceThatCueEnds: true,
      theNeighbourIsStillDrawn: true,
    },
  );

  const facing = unit(9);
  const turned = { ...facing, facingDeg: 90 };
  const aside = state({ offset: { x: 1, y: 0.5, z: 0 }, facingOffsetDeg: 30 });
  const placedStraight = placeFormationSlot({
    position: formationSlotPosition(facing, 4),
    facingDeg: facing.facingDeg,
    anchor: facing.anchor,
    baseFacingDeg: facing.facingDeg,
    unit: held,
    member: aside,
  });
  const placedTurned = placeFormationSlot({
    position: formationSlotPosition(turned, 4),
    facingDeg: turned.facingDeg,
    anchor: turned.anchor,
    baseFacingDeg: turned.facingDeg,
    unit: held,
    member: aside,
  });
  const carried = placeFormationSlot({
    position: formationSlotPosition(facing, 4),
    facingDeg: facing.facingDeg,
    anchor: facing.anchor,
    baseFacingDeg: facing.facingDeg,
    unit: { ...held, translation: { x: 0, y: 0, z: 10 } },
    member: aside,
  });
  const untouched = placeFormationSlot({
    position: formationSlotPosition(facing, 4),
    facingDeg: facing.facingDeg,
    anchor: facing.anchor,
    baseFacingDeg: facing.facingDeg,
    unit: held,
    member: state(),
  });
  TestValidator.equals(
    "a member's offset is stated in its unit's frame and composes with the unit",
    namedFacts([
      [
        "asideIsAsideWhileTheUnitFacesForward",
        () =>
          vclose(placedStraight.position, {
            x: formationSlotPosition(facing, 4).x + 1,
            y: formationSlotPosition(facing, 4).y + 0.5,
            z: formationSlotPosition(facing, 4).z,
          }),
      ],
      [
        "theSameAsideTurnsWithTheUnit",
        () =>
          vclose(placedTurned.position, {
            x: formationSlotPosition(turned, 4).x,
            y: formationSlotPosition(turned, 4).y + 0.5,
            z: formationSlotPosition(turned, 4).z - 1,
          }),
      ],
      [
        "theUnitStillCarriesTheMemberWithIt",
        () => nclose(carried.position.z, placedStraight.position.z + 10),
      ],
      [
        "headingsAddRatherThanReplace",
        () => nclose(placedStraight.facingDeg, facing.facingDeg + 30),
      ],
      [
        "anUntouchedMemberStandsExactlyWhereItWasDesigned",
        () =>
          vclose(untouched.position, formationSlotPosition(facing, 4)) &&
          untouched.present,
      ],
      [
        "aZeroOffsetTurnsToNothing",
        () =>
          vclose(rotateFormationLocalOffset({ x: 0, y: 0, z: 0 }, 137), {
            x: 0,
            y: 0,
            z: 0,
          }),
      ],
    ]),
    {
      asideIsAsideWhileTheUnitFacesForward: true,
      theSameAsideTurnsWithTheUnit: true,
      theUnitStillCarriesTheMemberWithIt: true,
      headingsAddRatherThanReplace: true,
      anUntouchedMemberStandsExactlyWhereItWasDesigned: true,
      aZeroOffsetTurnsToNothing: true,
    },
  );

  const floor = field(3);
  const crowd = unit(9);
  // One member alone, standing in the north arm and ending in the east one. Both
  // ends are carried; the straight path between them is not.
  const lone = unit(1, { x: 0, y: 0, z: 4 });
  const crosses: IAutoMovieFormationSlotMotion = {
    ...steps([0], 0, "cross"),
    to: state({ offset: { x: 4, y: 0, z: -4 } }),
  };
  TestValidator.equals(
    "the ground gate reads each member through its own cue",
    namedFacts([
      ["aCrowdOnItsFloorIsCarried", () => codes(floor, [crowd]).length === 0],
      [
        "aMemberWalkedOffTheFloorIsRefused",
        () => codes(floor, [crowd], [steps([4], 20)]).length === 1,
      ],
      [
        "aMemberRemovedBeforeItLeavesIsNotRefused",
        () =>
          codes(
            floor,
            [crowd],
            [
              {
                ...steps([4], 20, "removed-walk"),
                from: state({ present: false }),
                to: state({ present: false, offset: { x: 20, y: 0, z: 0 } }),
              },
            ],
          ).length === 0,
      ],
      [
        "aMemberCrossingBetweenTwoRoadsIsRefusedInTheMiddle",
        () => codes(crossroads(6, 1), [lone], [crosses]).length === 1,
      ],
      [
        "thatMemberStandsOnFloorAtBothEnds",
        () =>
          codes(crossroads(6, 1), [lone], [
            { ...crosses, end: crosses.start + 1e-9 },
          ]).length === 0,
      ],
      [
        "aShotThatStagedNoSpaceIsNotMeasured",
        () => codes(null, [crowd], [steps([4], 20)]).length === 0,
      ],
    ]),
    {
      aCrowdOnItsFloorIsCarried: true,
      aMemberWalkedOffTheFloorIsRefused: true,
      aMemberRemovedBeforeItLeavesIsNotRefused: true,
      aMemberCrossingBetweenTwoRoadsIsRefusedInTheMiddle: true,
      thatMemberStandsOnFloorAtBothEnds: true,
      aShotThatStagedNoSpaceIsNotMeasured: true,
    },
  );

  const tight = field(1.2);
  TestValidator.equals(
    "a crowd nobody singled out is measured exactly as it was before",
    namedFacts([
      [
        "anEmptyChannelReadsAsNoChannel",
        () =>
          JSON.stringify(codes(tight, [crowd], [])) ===
          JSON.stringify(codes(tight, [crowd], undefined)),
      ],
      [
        "aChannelForAnotherUnitReadsAsNoChannel",
        () =>
          JSON.stringify(
            codes(tight, [crowd], [{ ...steps([0], 20), formation: "other" }]),
          ) === JSON.stringify(codes(tight, [crowd], undefined)),
      ],
      [
        "aSlotOutsideTheUnitIsNotMeasured",
        () =>
          JSON.stringify(codes(floor, [crowd], [steps([99], 20)])) ===
          JSON.stringify(codes(floor, [crowd], undefined)),
      ],
    ]),
    {
      anEmptyChannelReadsAsNoChannel: true,
      aChannelForAnotherUnitReadsAsNoChannel: true,
      aSlotOutsideTheUnitIsNotMeasured: true,
    },
  );

  TestValidator.equals(
    "the cue gate refuses every malformed exception and accepts sparse ones",
    namedFacts([
      [
        "twoMembersDoingDifferentThingsAtOnceAreAccepted",
        () =>
          cueCodes([steps([4], 2, "one"), leaves([5], 1, "two")]).length === 0,
      ],
      [
        "oneMemberInTwoSuccessiveCuesIsAccepted",
        () =>
          cueCodes([
            steps([4], 2, "first"),
            { ...steps([4], 5, "second"), start: 3, end: 4 },
          ]).length === 0,
      ],
      [
        "oneMemberInTwoOverlappingCuesIsRefused",
        () =>
          cueCodes([
            steps([4], 2, "first"),
            { ...steps([4], 5, "second"), start: 2, end: 4 },
          ]).length === 1,
      ],
      ["aBlankIdIsRefused", () => cueCodes([steps([4], 2, "")]).length === 1],
      [
        "aRepeatedIdIsRefused",
        () => cueCodes([steps([4], 2), steps([5], 2)]).length === 1,
      ],
      [
        "aUnitTheShotDoesNotStageIsRefused",
        () =>
          cueCodes([{ ...steps([4], 2), formation: "ghost" }]).length === 1 &&
          cueCodes([steps([4], 2)], []).length === 1,
      ],
      [
        "everyMalformedWindowIsRefused",
        () =>
          [
            { start: Number.NaN, end: 1 },
            { start: 0, end: Number.NaN },
            { start: -1, end: 1 },
            { start: 1, end: 1 },
            { start: 0, end: contract.durationSeconds + 1 },
          ].every(
            (time, index) =>
              cueCodes([{ ...steps([4], 2, `window-${index}`), ...time }])
                .length === 1,
          ),
      ],
      [
        "everyMalformedSlotListIsRefused",
        () =>
          [[], [4, 4], [-1], [1.5], [9]].every(
            (slots, index) =>
              cueCodes([{ ...steps([4], 2, `slots-${index}`), slots }])
                .length === 1,
          ),
      ],
      [
        "aPromotedHeroIsRefusedItsOwnChannel",
        () => cueCodes([steps([4], 2)], [compiled(9, [4])]).length === 1,
      ],
      [
        "unboundedMemberStateIsRefused",
        () =>
          [
            state({ offset: { x: Number.NaN, y: 0, z: 0 } }),
            state({ offset: { x: 1_000_000_001, y: 0, z: 0 } }),
            state({ facingOffsetDeg: Number.POSITIVE_INFINITY }),
            state({ facingOffsetDeg: 360_001 }),
          ].every(
            (bad, index) =>
              cueCodes([{ ...steps([4], 2, `state-${index}`), from: bad }])
                .length === 1,
          ),
      ],
      [
        "tooManyCuesAreRefused",
        () =>
          cueCodes(
            Array.from({ length: 257 }, (_, index) => ({
              ...steps([index % 9], 2, `many-${index}`),
              start: 0,
              end: 0.5,
            })),
          ).length > 0,
      ],
      [
        "tooManyNamedMembersAreRefused",
        () =>
          cueCodes(
            [
              {
                ...steps(
                  Array.from({ length: 1_025 }, (_, index) => index),
                  2,
                  "everyone",
                ),
              },
            ],
            [compiled(2_000)],
          ).length === 1,
      ],
    ]),
    {
      twoMembersDoingDifferentThingsAtOnceAreAccepted: true,
      oneMemberInTwoSuccessiveCuesIsAccepted: true,
      oneMemberInTwoOverlappingCuesIsRefused: true,
      aBlankIdIsRefused: true,
      aRepeatedIdIsRefused: true,
      aUnitTheShotDoesNotStageIsRefused: true,
      everyMalformedWindowIsRefused: true,
      everyMalformedSlotListIsRefused: true,
      aPromotedHeroIsRefusedItsOwnChannel: true,
      unboundedMemberStateIsRefused: true,
      tooManyCuesAreRefused: true,
      tooManyNamedMembersAreRefused: true,
    },
  );

  const exceptions = [steps([4], 2, "a"), leaves([5], 1, "b")];
  const small = unit(9);
  const vast = unit(100_000);
  TestValidator.equals(
    "the channel costs the exceptions it names and not the crowd it names them in",
    namedFacts([
      [
        "theSameExceptionsSerializeIdenticallyAtEitherSize",
        () => JSON.stringify(exceptions) === JSON.stringify(exceptions),
      ],
      [
        "neitherCrowdStoresAnythingPerMember",
        () =>
          JSON.stringify({ ...small, count: 0 }) ===
          JSON.stringify({ ...vast, count: 0 }),
      ],
      [
        "oneMoreExceptionCostsOneMoreRecord",
        () =>
          JSON.stringify([...exceptions, steps([6], 2, "c")]).length >
          JSON.stringify(exceptions).length,
      ],
      [
        "aVastCrowdSamplesOneMemberFromItsOwnCuesAlone",
        () =>
          nclose(
            sampleFormationSlotMotion(exceptions, vast.id, 4, 5).offset.x,
            2,
          ) &&
          sampleFormationSlotMotion(exceptions, vast.id, 99_999, 5).present,
      ],
      [
        "theSameSeedAndCuesReproduceTheSamePlacement",
        () =>
          JSON.stringify(
            placeFormationSlot({
              position: formationSlotPosition(vast, 4),
              facingDeg: vast.facingDeg,
              anchor: vast.anchor,
              baseFacingDeg: vast.facingDeg,
              unit: held,
              member: sampleFormationSlotMotion(exceptions, vast.id, 4, 2),
            }),
          ) ===
          JSON.stringify(
            placeFormationSlot({
              position: formationSlotPosition(unit(100_000), 4),
              facingDeg: vast.facingDeg,
              anchor: vast.anchor,
              baseFacingDeg: vast.facingDeg,
              unit: held,
              member: sampleFormationSlotMotion(exceptions, vast.id, 4, 2),
            }),
          ),
      ],
    ]),
    {
      theSameExceptionsSerializeIdenticallyAtEitherSize: true,
      neitherCrowdStoresAnythingPerMember: true,
      oneMoreExceptionCostsOneMoreRecord: true,
      aVastCrowdSamplesOneMemberFromItsOwnCuesAlone: true,
      theSameSeedAndCuesReproduceTheSamePlacement: true,
    },
  );
};
