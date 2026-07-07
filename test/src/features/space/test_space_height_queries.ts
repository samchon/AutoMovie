import {
  heightAt,
  isWalkable,
  surfaceAt,
  surfaceContains,
  surfaceHeightAt,
} from "@automovie/engine";
import { IAutoMovieSpace, IAutoMovieSurface } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const v = (x: number, z: number, y = 0) => ({ x, y, z });

const floor: IAutoMovieSurface = {
  id: "floor",
  kind: "floor",
  polygon: [v(0, 0), v(10, 0), v(10, 10), v(0, 10)],
  anchor: { x: 0, y: 0, z: 0 },
  rampTo: null,
};
/** A table top an actor may not walk on (standable for objects only). */
const deck: IAutoMovieSurface = {
  id: "deck",
  kind: "platform",
  polygon: [v(2, 2), v(4, 2), v(4, 4), v(2, 4)],
  anchor: { x: 2, y: 1, z: 2 },
  rampTo: null,
};
/** A ramp rising 1 → 3 from x=6 to x=10, constant across z. */
const ramp: IAutoMovieSurface = {
  id: "ramp",
  kind: "ramp",
  polygon: [v(6, 0), v(10, 0), v(10, 4), v(6, 4)],
  anchor: { x: 6, y: 1, z: 0 },
  rampTo: { x: 10, y: 3, z: 0 },
};
const tieA: IAutoMovieSurface = {
  id: "tieA",
  kind: "platform",
  polygon: [v(19, 19), v(21, 19), v(21, 21), v(19, 21)],
  anchor: { x: 19, y: 5, z: 19 },
  rampTo: null,
};
const tieB: IAutoMovieSurface = { ...tieA, id: "tieB" };

const space: IAutoMovieSpace = {
  id: "set",
  surfaces: [floor, deck, ramp, tieA, tieB],
  walkable: ["floor", "ramp", "tieA", "tieB"],
};

/**
 * The space height/walkability queries are the ground truth every seam
 * consumes: heights come from the topmost surface at a point (ramps interpolate
 * as planes), walking is only allowed where that topmost surface is walkable,
 * and `isWalkable` can never disagree with `heightAt`.
 *
 * Scenarios:
 *
 * 1. A flat patch reads its anchor height everywhere on its footprint.
 * 2. A ramp interpolates linearly along its axis (hand oracle: 1→3 over x=6..10
 *    gives 2 at x=8, 1.5 at x=7).
 * 3. The ramp plane is constant perpendicular to its axis (same height at any z on
 *    the footprint).
 * 4. Over nothing: `surfaceAt` null, `heightAt` null, `isWalkable` false.
 * 5. The topmost surface wins where patches stack — and when it is a no-go top,
 *    `surfaceAt` still reports it (objects rest there) while `heightAt` reads
 *    null (an actor cannot stand there).
 * 6. An exact height tie keeps the earlier surface in the array.
 * 7. A degenerate ramp axis (rampTo at the anchor's XZ) safely reads as flat.
 * 8. A mis-ordered (bowtie) footprint still classifies containment correctly — the
 *    polygon is canonicalized through the shared convex hull.
 */
export const test_space_height_queries = (): void => {
  TestValidator.predicate(
    "flat patch height",
    nclose(heightAt(space, 1, 1)!, 0),
  );
  TestValidator.equals(
    "flat patch surface",
    surfaceAt(space, 1, 1)!.id,
    "floor",
  );

  TestValidator.predicate("ramp mid height", nclose(heightAt(space, 8, 2)!, 2));
  TestValidator.predicate(
    "ramp quarter height",
    nclose(heightAt(space, 7, 1)!, 1.5),
  );
  TestValidator.predicate(
    "ramp constant across z",
    nclose(heightAt(space, 8, 0.5)!, heightAt(space, 8, 3.5)!),
  );

  TestValidator.equals("over nothing surface", surfaceAt(space, 50, 50), null);
  TestValidator.equals("over nothing height", heightAt(space, 50, 50), null);
  TestValidator.equals(
    "over nothing walkable",
    isWalkable(space, 50, 50),
    false,
  );

  TestValidator.equals("topmost wins", surfaceAt(space, 3, 3)!.id, "deck");
  TestValidator.equals(
    "no-go top blocks standing",
    heightAt(space, 3, 3),
    null,
  );
  TestValidator.equals(
    "no-go top not walkable",
    isWalkable(space, 3, 3),
    false,
  );

  TestValidator.equals(
    "tie keeps earlier",
    surfaceAt(space, 20, 20)!.id,
    "tieA",
  );
  TestValidator.equals("walkable on floor", isWalkable(space, 1, 1), true);

  const degenerate: IAutoMovieSurface = {
    ...ramp,
    rampTo: { x: 6, y: 9, z: 0 },
  };
  TestValidator.predicate(
    "degenerate ramp axis reads flat",
    nclose(surfaceHeightAt(degenerate, 8, 2), 1),
  );

  const bowtie: IAutoMovieSurface = {
    ...floor,
    polygon: [v(0, 0), v(10, 10), v(10, 0), v(0, 10)],
  };
  TestValidator.equals(
    "mis-ordered footprint still contains its center",
    surfaceContains(bowtie, 5, 5),
    true,
  );
};
