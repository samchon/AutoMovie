import {
  arrangePlantingCluster,
  growPlanting,
  plantingBudget,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, qunit } from "../internal/predicates";
import { plantingCluster, plantingRecipe } from "../internal/softFixtures";

/** Smallest horizontal distance between any two accepted members. */
const closestPair = (
  placements: ReadonlyArray<{ translation: { x: number; z: number } }>,
): number => {
  let closest = Infinity;
  for (let a = 0; a < placements.length; ++a)
    for (let b = a + 1; b < placements.length; ++b) {
      const dx = placements[a].translation.x - placements[b].translation.x;
      const dz = placements[a].translation.z - placements[b].translation.z;
      closest = Math.min(closest, Math.sqrt(dx * dx + dz * dz));
    }
  return closest;
};

/**
 * A planting cluster is generated from its seed, honours its own spacing rule,
 * and hands every member out as a lossless full transform.
 *
 * Repetition must be generated. A bed of ferns typed out as forty coordinates
 * is forty places for the arrangement to disagree with itself, and nothing
 * about it can be re-derived after an edit. Here every candidate comes from
 * `(seed, slot, attempt)` alone, a candidate too close to an accepted member is
 * refused rather than squeezed in, and a slot that exhausts its attempts is
 * **counted** so an author can see the bed was too small instead of wondering
 * where the plants went.
 *
 * Each accepted member carries translation, a unit quaternion and a per-axis
 * scale, which is exactly what GPU instancing consumes without loss.
 *
 * Scenarios:
 *
 * 1. An ordinary cluster places every member it asked for, inside the declared
 *    rectangle, with nothing rejected.
 * 2. The spacing rule is honoured: no two accepted members are closer than
 *    `minSpacing`, and the same rule made impossible by a wide spacing rejects
 *    the slots it cannot honour and reports exactly how many. A cluster that
 *    declares no spacing at all refuses nothing, even when every member is
 *    drawn onto the same point.
 * 3. Every member's transform is lossless: a unit quaternion, a pure turn about
 *    `+y`, and three independently drawn scale axes inside the declared range.
 * 4. The arrangement is a pure function of the cluster: two calls agree bit for
 *    bit, a different seed disagrees, and slot ids and indices are stable.
 * 5. Boundaries: a single member with zero extent lands exactly on the anchor; a
 *    cluster with zero yaw jitter hands out the exact identity rotation; and a
 *    cluster whose extent is zero but whose spacing is positive rejects every
 *    slot after the first.
 * 6. A four-thousand-member meadow places, accounts for and spaces every slot, and
 *    reproduces itself exactly. The spacing test is answered through a uniform
 *    grid of side `minSpacing` rather than against every member placed so far,
 *    which is what makes the declared budget bounded work instead of a number
 *    of distance tests nobody could wait for.
 * 7. The cost of the whole bed is derived from the recipe and the cluster alone,
 *    with no branch grown: the complete `k`-ary tree times the member count, so
 *    a production can be refused before anything is derived. Foliage is counted
 *    the same way and not read off the declared cap — a bare winter branch
 *    costs no leaves at all, and a leafed recipe costs exactly the eight blades
 *    the derivation goes on to emit.
 */
export const test_planting_cluster_arrangement = (): void => {
  const cluster = plantingCluster();
  const arrangement = arrangePlantingCluster(cluster);
  TestValidator.equals(
    "an ordinary cluster places every member inside its rectangle",
    namedFacts([
      ["count", () => arrangement.placements.length === 6],
      ["rejected", () => arrangement.rejected === 0],
      ["cluster", () => arrangement.cluster === "atrium-bed"],
      ["domain", () => arrangement.domain === "fern"],
      [
        "inside",
        () =>
          arrangement.placements.every(
            (placement) =>
              Math.abs(placement.translation.x) <= 2 &&
              Math.abs(placement.translation.z) <= 2 &&
              placement.translation.y === 0,
          ),
      ],
      ["bounds", () => arrangement.bounds !== null],
    ]),
    {
      count: true,
      rejected: true,
      cluster: true,
      domain: true,
      inside: true,
      bounds: true,
    },
  );

  const tight = arrangePlantingCluster(
    plantingCluster({ count: 8, minSpacing: 3 }),
  );
  TestValidator.equals(
    "the spacing rule is honoured, and what it refuses is counted",
    namedFacts([
      ["spacing", () => closestPair(arrangement.placements) >= 0.5],
      ["tightSpacing", () => closestPair(tight.placements) >= 3],
      ["refused", () => tight.rejected === 8 - tight.placements.length],
      ["someRefused", () => tight.rejected > 0],
      [
        "noRuleRefusesNothing",
        () => {
          const packed = arrangePlantingCluster(
            plantingCluster({
              count: 12,
              minSpacing: 0,
              extent: { x: 0, z: 0 },
            }),
          );
          return (
            packed.placements.length === 12 &&
            packed.rejected === 0 &&
            closestPair(packed.placements) === 0
          );
        },
      ],
    ]),
    {
      spacing: true,
      tightSpacing: true,
      refused: true,
      someRefused: true,
      noRuleRefusesNothing: true,
    },
  );

  TestValidator.equals(
    "every member's transform is lossless",
    namedFacts([
      [
        "unit",
        () =>
          arrangement.placements.every((placement) =>
            qunit(placement.rotation),
          ),
      ],
      [
        "yawOnly",
        () =>
          arrangement.placements.every(
            (placement) =>
              placement.rotation.x === 0 && placement.rotation.z === 0,
          ),
      ],
      [
        "scaleRange",
        () =>
          arrangement.placements.every(
            (placement) =>
              placement.scale.x >= 0.75 &&
              placement.scale.x <= 1.25 &&
              placement.scale.y >= 0.5 &&
              placement.scale.y <= 1.5 &&
              placement.scale.z >= 0.75 &&
              placement.scale.z <= 1.25,
          ),
      ],
      [
        "perAxis",
        () =>
          arrangement.placements.some(
            (placement) =>
              placement.scale.x !== placement.scale.y &&
              placement.scale.y !== placement.scale.z,
          ),
      ],
      [
        "turned",
        () => new Set(arrangement.placements.map((p) => p.rotation.y)).size > 1,
      ],
    ]),
    {
      unit: true,
      yawOnly: true,
      scaleRange: true,
      perAxis: true,
      turned: true,
    },
  );

  TestValidator.equals(
    "the arrangement is a pure function of the cluster",
    namedFacts([
      [
        "identical",
        () =>
          arrangePlantingCluster(plantingCluster()).placements.every(
            (placement, index) =>
              Object.is(
                placement.translation.x,
                arrangement.placements[index].translation.x,
              ) &&
              Object.is(
                placement.rotation.w,
                arrangement.placements[index].rotation.w,
              ) &&
              Object.is(
                placement.scale.y,
                arrangement.placements[index].scale.y,
              ),
          ),
      ],
      [
        "reseeded",
        () =>
          arrangePlantingCluster(plantingCluster({ seed: 99 })).placements[0]
            .translation.x !== arrangement.placements[0].translation.x,
      ],
      [
        "identity",
        () =>
          arrangement.placements.every(
            (placement, index) =>
              placement.slot === index &&
              placement.id === `atrium-bed#${index}`,
          ),
      ],
    ]),
    { identical: true, reseeded: true, identity: true },
  );

  const lone = arrangePlantingCluster(
    plantingCluster({
      count: 1,
      extent: { x: 0, z: 0 },
      anchor: { x: 3, y: 1, z: -2 },
      yawJitter: 0,
      scale: { min: { x: 1, y: 1, z: 1 }, max: { x: 1, y: 1, z: 1 } },
    }),
  );
  const crowded = arrangePlantingCluster(
    plantingCluster({ count: 4, extent: { x: 0, z: 0 }, minSpacing: 1 }),
  );
  TestValidator.equals(
    "the boundary cases behave",
    namedFacts([
      [
        "onAnchor",
        () =>
          lone.placements[0].translation.x === 3 &&
          lone.placements[0].translation.y === 1 &&
          lone.placements[0].translation.z === -2,
      ],
      [
        "identityRotation",
        () =>
          lone.placements[0].rotation.w === 1 &&
          lone.placements[0].rotation.y === 0,
      ],
      [
        "fixedScale",
        () =>
          lone.placements[0].scale.x === 1 && lone.placements[0].scale.z === 1,
      ],
      ["onlyOneFits", () => crowded.placements.length === 1],
      ["restRefused", () => crowded.rejected === 3],
      [
        "degenerateBounds",
        () =>
          crowded.bounds !== null &&
          crowded.bounds.min.x === crowded.bounds.max.x,
      ],
    ]),
    {
      onAnchor: true,
      identityRotation: true,
      fixedScale: true,
      onlyOneFits: true,
      restRefused: true,
      degenerateBounds: true,
    },
  );

  const crowd = arrangePlantingCluster(
    plantingCluster({
      id: "meadow",
      count: 4_000,
      extent: { x: 40, z: 40 },
      minSpacing: 1,
      attempts: 16,
    }),
  );
  TestValidator.equals(
    "the declared member budget is bounded work, not a quarter-trillion tests",
    namedFacts([
      ["placed", () => crowd.placements.length > 3_000],
      ["accounted", () => crowd.placements.length + crowd.rejected === 4_000],
      ["spacing", () => closestPair(crowd.placements) >= 1],
      [
        "reproducible",
        () => {
          const again = arrangePlantingCluster(
            plantingCluster({
              id: "meadow",
              count: 4_000,
              extent: { x: 40, z: 40 },
              minSpacing: 1,
              attempts: 16,
            }),
          );
          return (
            again.rejected === crowd.rejected &&
            again.placements.every((placement, index) =>
              Object.is(
                placement.translation.x,
                crowd.placements[index].translation.x,
              ),
            )
          );
        },
      ],
    ]),
    { placed: true, accounted: true, spacing: true, reproducible: true },
  );

  TestValidator.equals(
    "a bare recipe's cost counts no leaf, however large its cap",
    plantingBudget({ domain: plantingRecipe(), cluster }),
    {
      domain: "fern",
      worstCaseBranches: 7,
      worstCaseLeaves: 0,
      maxBranches: 64,
      maxLeaves: 512,
      members: 6,
      worstCaseBranchInstances: 42,
      worstCaseLeafInstances: 0,
    },
  );

  const leafed = plantingRecipe({
    foliage: {
      density: 4,
      minLevel: 1,
      size: { x: 0.05, y: 0.1, z: 0.05 },
      scaleJitter: 0,
      rollJitter: 0,
    },
  });
  TestValidator.equals(
    "a leafed recipe costs the blades its density rule actually bears",
    namedFacts([
      [
        "worstCase",
        () => plantingBudget({ domain: leafed }).worstCaseLeaves === 8,
      ],
      ["grown", () => growPlanting(leafed).leaves.length === 8],
      [
        "instances",
        () =>
          plantingBudget({ domain: leafed, cluster }).worstCaseLeafInstances ===
          48,
      ],
      [
        "jitterWidensTheBound",
        () =>
          plantingBudget({
            domain: plantingRecipe({
              structure: { ...leafed.structure, lengthJitter: 0.5 },
              foliage: leafed.foliage,
            }),
          }).worstCaseLeaves > 8,
      ],
    ]),
    {
      worstCase: true,
      grown: true,
      instances: true,
      jitterWidensTheBound: true,
    },
  );
};
