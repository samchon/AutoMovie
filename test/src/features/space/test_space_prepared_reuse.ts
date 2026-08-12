import {
  heightAt,
  heightsAt,
  prepareSpace,
  surfaceAt,
} from "@automovie/engine";
import { IAutoMovieSpace, IAutoMovieSurface } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const v = (x: number, z: number, y = 0) => ({ x, y, z });

/** A patch of ground, cheap to state and not cheap to hull. */
const plate = (id: string, x: number, level: number): IAutoMovieSurface => ({
  id,
  kind: "floor",
  polygon: [v(x, 0), v(x + 4, 0), v(x + 4, 4), v(x, 4)],
  anchor: { x, y: level, z: 0 },
  rampTo: null,
});

/** Enough patches that preparing them repeatedly would be the whole cost. */
const scenery = (): IAutoMovieSpace => ({
  id: "scenery",
  surfaces: Array.from({ length: 12 }, (_, index) =>
    plate(`plate-${index}`, index * 4, index),
  ),
  walkable: Array.from({ length: 12 }, (_, index) => `plate-${index}`),
});

/**
 * One space is prepared once, however many points are asked about it.
 *
 * `heightAt`, `surfaceAt` and `surfaceContains` each default their `prepared`
 * argument to `prepareSpace(space)`, and that default is the spelling an author
 * actually writes: one call per place a body might go. Preparing hulls every
 * footprint in the space, so without a memo the natural loop over a crowd is
 * quadratic in the scenery — and the deterministic shot sandbox, which allows
 * one second per module, times out on a battlefield rather than on anything the
 * author did wrong. The #1825 campaign hit exactly that: linking the standing
 * query timed out all four of its shots at once.
 *
 * The memo is keyed by the record's identity rather than by its content, which
 * is the same bet the formation ground datum already makes. A caller holding
 * one record is asking about one geometry; a caller that built a new record
 * has, as far as anything here can know, new geometry. Both halves of that are
 * pinned below, because a memo that answered across two records would be a
 * cache that outlived its subject.
 *
 * Scenarios:
 *
 * 1. Two preparations of one record are the same object, so every defaulted
 *    query after the first pays nothing.
 * 2. A structurally identical second record prepares separately: identity is the
 *    key, deliberately, and a content-keyed memo would answer for geometry it
 *    was never shown.
 * 3. Sharing changes no answer. The defaulted query, the same query handed the
 *    prepared value explicitly, and a repeat of the first all agree, on a
 *    walkable plate and on a point over nothing alike.
 * 4. The prepared value describes the record it was made from and carries one
 *    entry per surface, so what is being shared is the whole preparation rather
 *    than a partially filled one.
 * 5. `heightsAt` answers a batch positionally and agrees with the single-point
 *    form on every entry, including the ones that are `null`. The batch exists
 *    because a shot module's engine calls cross a JSON boundary, where the memo
 *    above cannot help — the host parses a new record per call — so the fix for
 *    a loop over points is one call rather than a cheaper repeat.
 * 6. An empty batch answers with an empty list rather than refusing, because
 *    "no points to ask about" is a real state of a route that has not been
 *    sampled yet.
 */
export const test_space_prepared_reuse = (): void => {
  const space = scenery();
  const twin = scenery();
  const prepared = prepareSpace(space);
  const twinFirst = prepareSpace(twin);
  const twinSecond = prepareSpace(twin);

  // On the third plate, which is walkable and sits at level 2.
  const inside = { x: 10, z: 2 };
  const outside = { x: -100, z: -100 };

  TestValidator.equals(
    "a space is prepared once and the sharing changes no answer",
    namedFacts([
      ["oneRecordIsPreparedOnce", () => prepareSpace(space) === prepared],
      ["aSecondRecordIsItsOwnPreparation", () => twinFirst !== prepared],
      ["andThatSecondPreparationIsAlsoStable", () => twinSecond === twinFirst],
      [
        "thePreparationDescribesItsOwnRecord",
        () => prepared.space === space && prepared.surfaces.length === 12,
      ],
      [
        "theDefaultedQueryAgreesWithTheExplicitOne",
        () =>
          nclose(
            heightAt(space, inside.x, inside.z) ?? Number.NaN,
            heightAt(space, inside.x, inside.z, prepared) ?? Number.NaN,
          ),
      ],
      [
        "andRepeatingItAgreesWithItself",
        () =>
          nclose(
            heightAt(space, inside.x, inside.z) ?? Number.NaN,
            heightAt(space, inside.x, inside.z) ?? Number.NaN,
          ),
      ],
      [
        "aPointOverNothingIsStillNothing",
        () => heightAt(space, outside.x, outside.z) === null,
      ],
      [
        "andSurfaceLookupIsUnchangedToo",
        () => surfaceAt(space, inside.x, inside.z)?.id === "plate-2",
      ],
      // The batch is the answer for a shot module, whose calls cross a JSON
      // boundary the memo above cannot reach.
      [
        "aBatchAnswersEveryPointInOrder",
        () => {
          const points = [inside, outside, { x: 22, z: 1 }];
          const batch = heightsAt(space, points);
          return (
            batch.length === points.length &&
            points.every((point, index) => {
              const single = heightAt(space, point.x, point.z);
              const many = batch[index]!;
              return single === null
                ? many === null
                : many !== null && nclose(many, single);
            })
          );
        },
      ],
      [
        "andItKeepsTheHolesWhereTheyWere",
        () => heightsAt(space, [outside])[0] === null,
      ],
      ["anEmptyBatchIsAnEmptyAnswer", () => heightsAt(space, []).length === 0],
    ]),
    {
      oneRecordIsPreparedOnce: true,
      aSecondRecordIsItsOwnPreparation: true,
      andThatSecondPreparationIsAlsoStable: true,
      thePreparationDescribesItsOwnRecord: true,
      theDefaultedQueryAgreesWithTheExplicitOne: true,
      andRepeatingItAgreesWithItself: true,
      aPointOverNothingIsStillNothing: true,
      andSurfaceLookupIsUnchangedToo: true,
      aBatchAnswersEveryPointInOrder: true,
      andItKeepsTheHolesWhereTheyWere: true,
      anEmptyBatchIsAnEmptyAnswer: true,
    },
  );
};
