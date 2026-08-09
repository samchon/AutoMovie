import {
  autoMovieStoryInterval,
  autoMovieStoryTime,
  evaluateAutoMovieStorySync,
} from "@automovie/engine";
import { IAutoMovieShotStoryTime } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/**
 * Three coverages of one moment, pinned so the arithmetic is exact.
 *
 * `cover-a` opens at story second 30 and realizes its event 2.5s in; `cover-b`
 * opens at 28.5 and realizes 4s in. Both land on story second 32.5 from
 * different local times, which is the whole point: local time says where you
 * are inside a shot, story time says when the shot happened. `cover-c` opens at
 * 27 and realizes 4s in, landing on 31 — a story-clock second and a half away
 * from the other two however the edit orders them.
 */
const PINS: Readonly<Record<string, IAutoMovieShotStoryTime>> = {
  "cover-a": { originSeconds: 30 },
  "cover-b": { originSeconds: 28.5 },
  "cover-c": { originSeconds: 27 },
};

const REALIZED: Readonly<Record<string, number>> = {
  "cover-a mark-a": 2.5,
  "cover-b mark-b": 4,
  "cover-c mark-c": 4,
};

const sync = (
  events: ReadonlyArray<{ shot: string; event: string }>,
  toleranceSeconds: number,
  overrides: {
    pin?: (shot: string) => IAutoMovieShotStoryTime | null;
    realized?: (shot: string, event: string) => number | null;
  } = {},
): ReturnType<typeof evaluateAutoMovieStorySync> =>
  evaluateAutoMovieStorySync({
    events,
    toleranceSeconds,
    pin: overrides.pin ?? ((shot) => PINS[shot] ?? null),
    realized:
      overrides.realized ??
      ((shot, event) => REALIZED[`${shot} ${event}`] ?? null),
  });

/**
 * The production story clock: what the film asserts happened, as opposed to the
 * order it shows things in.
 *
 * Scenarios:
 *
 * 1. A pin maps shot-local seconds onto the clock, honouring an explicit rate,
 *    and reports the story interval a whole shot occupies.
 * 2. Two shots pinned to the same story moment are judged simultaneous from
 *    different local times, and the verdict names both events.
 * 3. Two shots that are not are judged apart, and the failure names the gap it
 *    measured and the tolerance it exceeded.
 * 4. The tolerance is inclusive, so a claim exactly as wide as it holds.
 * 5. An unmeasurable operand — no pin, no realization, a non-finite sample, an
 *    overflowed story time — refuses the claim and names which operand it was,
 *    and an empty claim asserts nothing.
 */
export const test_film_story_clock = (): void => {
  TestValidator.equals(
    "a pin maps shot-local time onto the story clock",
    namedFacts([
      ["defaultRate", () => autoMovieStoryTime({ originSeconds: 10 }, 4) === 14],
      [
        "explicitRate",
        () => autoMovieStoryTime({ originSeconds: 10, rate: 0.5 }, 4) === 12,
      ],
      [
        "interval",
        () => {
          const interval = autoMovieStoryInterval(
            { originSeconds: 10, rate: 0.5 },
            6,
          );
          return interval.from === 10 && interval.to === 13;
        },
      ],
    ]),
    { defaultRate: true, explicitRate: true, interval: true },
  );

  const together = sync(
    [
      { shot: "cover-a", event: "mark-a" },
      { shot: "cover-b", event: "mark-b" },
    ],
    0.25,
  );
  TestValidator.equals(
    "two shots pinned to the same story moment are judged simultaneous",
    namedFacts([
      ["passed", () => together.passed],
      ["spread", () => together.spreadSeconds === 0],
      [
        "storyTimes",
        () => together.points.every((point) => point.storySeconds === 32.5),
      ],
      [
        "localTimesDiffer",
        () =>
          together.points[0]?.localSeconds === 2.5 &&
          together.points[1]?.localSeconds === 4,
      ],
      [
        "summaryNamesBothEvents",
        () =>
          together.summary.includes('"mark-a" of shot "cover-a"') &&
          together.summary.includes('"mark-b" of shot "cover-b"'),
      ],
      [
        "summaryStatesTolerance",
        () => together.summary.includes("within the 0.25s tolerance"),
      ],
    ]),
    {
      passed: true,
      spread: true,
      storyTimes: true,
      localTimesDiffer: true,
      summaryNamesBothEvents: true,
      summaryStatesTolerance: true,
    },
  );

  const apart = sync(
    [
      { shot: "cover-a", event: "mark-a" },
      { shot: "cover-c", event: "mark-c" },
    ],
    0.25,
  );
  TestValidator.equals(
    "a false simultaneity claim is refused and names the measured gap",
    namedFacts([
      ["refused", () => apart.passed === false],
      ["spread", () => apart.spreadSeconds === 1.5],
      ["summaryNamesGap", () => apart.summary.includes("are 1.5s apart")],
      [
        "summaryStatesTolerance",
        () => apart.summary.includes("beyond the 0.25s tolerance"),
      ],
      [
        "summaryOrdersByStoryTime",
        () =>
          apart.summary.startsWith(
            'event "mark-c" of shot "cover-c" at story 31s and event "mark-a" of shot "cover-a" at story 32.5s',
          ),
      ],
    ]),
    {
      refused: true,
      spread: true,
      summaryNamesGap: true,
      summaryStatesTolerance: true,
      summaryOrdersByStoryTime: true,
    },
  );

  TestValidator.predicate(
    "a gap exactly as wide as the tolerance still holds",
    sync(
      [
        { shot: "cover-a", event: "mark-a" },
        { shot: "cover-c", event: "mark-c" },
      ],
      1.5,
    ).passed,
  );

  const unpinned = sync(
    [
      { shot: "cover-a", event: "mark-a" },
      { shot: "cover-x", event: "mark-x" },
    ],
    5,
    { realized: () => 1.5 },
  );
  const unrealized = sync(
    [
      { shot: "cover-a", event: "mark-a" },
      { shot: "cover-b", event: "mark-b" },
    ],
    5,
    { realized: (shot) => (shot === "cover-a" ? 2.5 : null) },
  );
  const unsampled = sync([{ shot: "cover-a", event: "mark-a" }], 5, {
    realized: () => Number.NaN,
  });
  const overflowed = sync([{ shot: "cover-a", event: "mark-a" }], 5, {
    pin: () => ({ originSeconds: 1e308, rate: 10 }),
    realized: () => 1e307,
  });
  const empty = sync([], 5);
  TestValidator.equals(
    "an unmeasurable operand refuses the claim and names itself",
    namedFacts([
      ["unpinnedRefused", () => unpinned.passed === false],
      ["unpinnedSpread", () => unpinned.spreadSeconds === null],
      [
        "unpinnedKeepsResolvedOperand",
        () => unpinned.points[0]?.storySeconds === 31.5,
      ],
      [
        "unpinnedNamesReason",
        () =>
          unpinned.summary ===
          'event "mark-x" of shot "cover-x" has no story time: that shot is not pinned to the production story clock.',
      ],
      ["unrealizedRefused", () => unrealized.passed === false],
      [
        "unrealizedNamesReason",
        () =>
          unrealized.summary ===
          'event "mark-b" of shot "cover-b" has no story time: that shot has no compiled realization for it.',
      ],
      [
        "unrealizedKeepsNullLocal",
        () => unrealized.points[1]?.localSeconds === null,
      ],
      ["unsampledRefused", () => unsampled.passed === false],
      [
        "unsampledIsNotARealization",
        () => unsampled.summary.includes("no compiled realization"),
      ],
      ["overflowedRefused", () => overflowed.passed === false],
      [
        "overflowedNamesReason",
        () =>
          overflowed.summary.includes("is not a finite number") &&
          overflowed.points[0]?.storySeconds === null,
      ],
      ["emptyRefused", () => empty.passed === false],
      ["emptyPoints", () => empty.points.length === 0],
      [
        "emptyNamesReason",
        () => empty.summary.includes("no event was addressed"),
      ],
    ]),
    {
      unpinnedRefused: true,
      unpinnedSpread: true,
      unpinnedKeepsResolvedOperand: true,
      unpinnedNamesReason: true,
      unrealizedRefused: true,
      unrealizedNamesReason: true,
      unrealizedKeepsNullLocal: true,
      unsampledRefused: true,
      unsampledIsNotARealization: true,
      overflowedRefused: true,
      overflowedNamesReason: true,
      emptyRefused: true,
      emptyPoints: true,
      emptyNamesReason: true,
    },
  );
};
