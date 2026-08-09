import {
  IAutoMovieFormationGrounding,
  IAutoMovieFormationPlacement,
  formationSlot,
  formationSlotPosition,
  worldHeightfield,
  worldRamp,
  worldSurfaceHeight,
  worldTerrain,
} from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieWorldSurface,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const FILES = 5;
const RANKS = 4;
const COUNT = FILES * RANKS;

/**
 * One block of twenty, four ranks deep and five files wide, on stated terrain.
 *
 * The files span `x` in `[-4, 4]` and the ranks span `z` in `[0, 9]`, so every
 * member of it sits somewhere different on the ground plan and a surface that
 * varies in either axis moves them apart.
 */
const block = (props: {
  ground?: readonly IAutoMovieWorldSurface[];
  anchor?: { x: number; y: number; z: number };
}): IAutoMovieFormationPlacement => ({
  id: "block",
  count: COUNT,
  layout: {
    kind: "line",
    ranks: RANKS,
    files: FILES,
    spacing: { lateral: 2, depth: 3 },
  },
  anchor: props.anchor ?? { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 11,
  ...(props.ground === undefined ? {} : { ground: props.ground }),
});

/** A wide level floor the whole block stands inside. */
const floor = (height: number): IAutoMovieWorldSurface =>
  worldTerrain({
    id: "floor",
    polygon: [
      { x: -20, z: -20 },
      { x: 20, z: -20 },
      { x: 20, z: 20 },
      { x: -20, z: 20 },
    ],
    height,
    walkable: true,
  });

/** A slope climbing one metre for every two metres of `z`. */
const slope = (): IAutoMovieWorldSurface =>
  worldRamp({
    id: "slope",
    from: { x: 0, z: -20 },
    to: { x: 0, z: 20 },
    width: 60,
    baseHeight: -5,
    rise: 20,
    walkable: true,
  });

/** A ridge along `z`, highest on the centre file and falling to either side. */
const ridge = (): IAutoMovieWorldSurface =>
  worldHeightfield({
    id: "ridge",
    polygon: [
      { x: -20, z: -20 },
      { x: 20, z: -20 },
      { x: 20, z: 20 },
      { x: -20, z: 20 },
    ],
    origin: { x: -20, z: -20 },
    spacing: { x: 4, z: 40 },
    columns: 11,
    rows: 2,
    height: (point) => 5 - Math.abs(point.x) * 0.25,
    walkable: true,
  });

/** Every member's placed position on stated terrain, in slot order. */
const placed = (
  ground?: readonly IAutoMovieWorldSurface[],
  anchor?: { x: number; y: number; z: number },
): Array<{ x: number; y: number; z: number }> => {
  const formation = block({ ground, anchor });
  return Array.from({ length: COUNT }, (_unused, slot) =>
    formationSlotPosition(formation, slot),
  );
};

/**
 * A crowd stands on the ground under each of its members.
 *
 * A formation used to place every member at its group anchor's height, which is
 * correct only where the ground is level and where the anchor was authored onto
 * it. On anything else — a slope, a rise, a stepped plaza, a bank — the whole
 * unit floated over the terrain or stood inside it, and nothing anywhere in the
 * pipeline could express otherwise: the only vertical channel a shot had for a
 * unit was one translation for all of it. So no production staging figures on
 * real ground could be made at all.
 *
 * Height is now the ground under the member, read as relief against the ground
 * under the anchor. That second half is what keeps `anchor.y` meaning what it
 * always meant: a unit staged on its terrain lands on it member by member, a
 * unit deliberately staged above its terrain keeps that clearance up the whole
 * hill, and level ground is arithmetically the old answer, so a production on a
 * flat floor compiles to the frames it compiled to before.
 *
 * The relief is read through the one engine placement every consumer calls,
 * because a compiler that judged a unit at one height while a renderer drew it
 * at another would be worse than the flat placement it replaced.
 *
 * Scenarios:
 *
 * 1. A flat floor places every member exactly where a formation with no terrain at
 *    all places it, at any floor height. This is the negative twin and the
 *    compatibility claim in one: sampling ground changed nothing about level
 *    ground.
 * 2. On a slope every member sits on the slope: its height is the terrain's own
 *    height at its own position, member by member, not one height for the
 *    unit.
 * 3. Two members standing on different ground stand at different heights, and the
 *    difference is the terrain's. A unit four ranks deep on a slope is four
 *    heights, which is the thing that could not be expressed before.
 * 4. A rise that is not a plane relieves a unit too: on a ridge the centre file
 *    stands above the flanking files, which no `constant` or `plane` surface
 *    can produce and which is the case the third height rule exists for.
 * 5. An anchor staged above its terrain keeps exactly that clearance everywhere,
 *    so the authored height is a height above the ground rather than a height
 *    the ground overrides.
 * 6. Terrain that does not reach a member leaves that member at the staged height
 *    rather than dropping it to the world origin, and terrain that does not
 *    reach the anchor leaves the whole unit at the staged height, because
 *    relief without a datum is not a rise but a guess.
 * 7. The full slot, not only the position, carries the relief, so a consumer
 *    reading a member's whole record sees the same height as one reading only
 *    where it stands.
 * 8. The same design places the same army twice, because relief is arithmetic over
 *    stored numbers and nothing about the machine can reach it.
 */
export const test_world_formation_ground = (): void => {
  const bare = placed();
  TestValidator.equals(
    "a level floor places exactly where no terrain at all places",
    namedFacts([
      [
        "atZero",
        () =>
          placed([floor(0)]).every((point, index) =>
            nclose(point.y, bare[index]!.y, 1e-12),
          ),
      ],
      [
        "raised",
        () =>
          placed([floor(7.25)]).every((point, index) =>
            nclose(point.y, bare[index]!.y, 1e-12),
          ),
      ],
      [
        "plan",
        () =>
          placed([floor(7.25)]).every(
            (point, index) =>
              nclose(point.x, bare[index]!.x, 1e-12) &&
              nclose(point.z, bare[index]!.z, 1e-12),
          ),
      ],
      ["staged", () => bare.every((point) => point.y === 0)],
    ]),
    { atZero: true, raised: true, plan: true, staged: true },
  );

  // The anchor stands on the slope, so the relief is the terrain itself and each
  // member's height is readable straight off the surface record.
  const hillside = slope();
  const anchorHeight = worldSurfaceHeight(hillside, { x: 0, z: 0 });
  const climbed = placed([hillside], { x: 0, y: anchorHeight, z: 0 });
  TestValidator.predicate(
    "on a slope every member stands on the slope under itself",
    climbed.every((point) =>
      nclose(point.y, worldSurfaceHeight(hillside, point), 1e-9),
    ),
  );

  TestValidator.equals(
    "members on different ground stand at different heights",
    namedFacts([
      // Slot 0 is the front rank and slot 15 the rear one, three metres apart
      // per rank on a slope that climbs half a metre per metre.
      [
        "differ",
        () => nclose(climbed[0]!.y, climbed[COUNT - FILES]!.y, 1e-9) === false,
      ],
      [
        "byTheTerrain",
        () =>
          nclose(
            climbed[COUNT - FILES]!.y - climbed[0]!.y,
            (climbed[COUNT - FILES]!.z - climbed[0]!.z) * 0.5,
            1e-9,
          ),
      ],
      // Four ranks, four heights: a slope is not one number for the unit.
      [
        "fourHeights",
        () =>
          new Set(climbed.map((point) => Math.round(point.y * 1e6) / 1e6))
            .size === RANKS,
      ],
      // Across a rank the slope is level, so the files share a height and the
      // difference above really is the terrain rather than slot index noise.
      ["acrossARank", () => nclose(climbed[0]!.y, climbed[FILES - 1]!.y, 1e-9)],
    ]),
    { differ: true, byTheTerrain: true, fourHeights: true, acrossARank: true },
  );

  const crest = ridge();
  const ridden = placed([crest], {
    x: 0,
    y: worldSurfaceHeight(crest, { x: 0, z: 0 }),
    z: 0,
  });
  TestValidator.equals(
    "a rise that is not a plane relieves a unit across its own files",
    namedFacts([
      [
        "onTheRidge",
        () =>
          ridden.every((point) =>
            nclose(point.y, worldSurfaceHeight(crest, point), 1e-9),
          ),
      ],
      // Files run -4, -2, 0, 2, 4 in x; the centre one is the crest.
      ["crestHighest", () => ridden[2]!.y > ridden[1]!.y],
      ["symmetric", () => nclose(ridden[1]!.y, ridden[3]!.y, 1e-9)],
      ["flanksLower", () => ridden[0]!.y < ridden[1]!.y],
      // A plane through the two flanks would put the crest between them at
      // their own height. It stands a metre above that, so no plane holds it.
      [
        "noPlaneHoldsIt",
        () =>
          nclose(ridden[0]!.y, ridden[FILES - 1]!.y, 1e-9) &&
          nclose(ridden[2]!.y - ridden[0]!.y, 1, 1e-9),
      ],
    ]),
    {
      onTheRidge: true,
      crestHighest: true,
      symmetric: true,
      flanksLower: true,
      noPlaneHoldsIt: true,
    },
  );

  TestValidator.predicate(
    "an anchor staged above its terrain keeps that clearance everywhere",
    placed([hillside], { x: 0, y: anchorHeight + 2.5, z: 0 }).every(
      (point, index) => nclose(point.y, climbed[index]!.y + 2.5, 1e-9),
    ),
  );

  // A slope covering only the near half of the block: its front two ranks stand
  // on it and its rear two reach past the polygon's edge onto nothing. The rule
  // itself would happily extrapolate there, which is exactly why the footprint
  // and not the rule decides where a surface exists.
  const nearSlope: IAutoMovieWorldSurface = {
    id: "near-slope",
    polygon: [
      { x: -20, z: -20 },
      { x: 20, z: -20 },
      { x: 20, z: 4 },
      { x: -20, z: 4 },
    ],
    height: { kind: "plane", originHeight: 0, slopeX: 0, slopeZ: 0.5 },
    walkable: true,
  };
  const partial = placed([nearSlope], { x: 0, y: 0, z: 0 });
  const offset = worldTerrain({
    id: "offset",
    polygon: [
      { x: -20, z: 5 },
      { x: 20, z: 5 },
      { x: 20, z: 20 },
      { x: -20, z: 20 },
    ],
    height: 3,
    walkable: true,
  });
  TestValidator.equals(
    "relief without a datum is not a rise, so the staged height is kept",
    namedFacts([
      // The rank on the covered ground rises with it: three metres of depth at
      // half a metre per metre.
      [
        "coveredRises",
        () =>
          partial
            .slice(FILES, 2 * FILES)
            .every((point) => nclose(point.y, 1.5, 1e-9)),
      ],
      // The ranks past the footprint keep the height the unit was staged at
      // rather than the 3 and 4.5 the rule would extrapolate to.
      [
        "uncoveredStaged",
        () => partial.slice(2 * FILES).every((point) => point.y === 0),
      ],
      // The anchor at the origin is over nothing here, so the unit has no datum
      // to measure a rise from and keeps the height it was staged at, even
      // though its rear ranks do stand over terrain.
      [
        "noDatum",
        () =>
          placed([offset], { x: 0, y: 1.5, z: 0 }).every(
            (point) => point.y === 1.5,
          ),
      ],
      // And a unit whose terrain reaches none of it keeps it too.
      [
        "noGroundAtAll",
        () =>
          placed([floor(0)], { x: 0, y: 0.75, z: 40 }).every(
            (point) => point.y === 0.75,
          ),
      ],
    ]),
    {
      coveredRises: true,
      uncoveredStaged: true,
      noDatum: true,
      noGroundAtAll: true,
    },
  );

  const design: IAutoMovieFormationDesign & IAutoMovieFormationGrounding = {
    id: "block",
    modelRecipe: "member",
    count: COUNT,
    layout: {
      kind: "line",
      ranks: RANKS,
      files: FILES,
      spacing: { lateral: 2, depth: 3 },
    },
    anchor: { x: 0, y: anchorHeight, z: 0 },
    facingDeg: 0,
    seed: 11,
    capabilities: [],
    heroOverrides: [],
    ground: [hillside],
  };
  TestValidator.predicate(
    "the whole slot carries the relief, not only the position query",
    Array.from({ length: COUNT }, (_unused, slot) => slot).every((slot) =>
      nclose(formationSlot(design, slot).position.y, climbed[slot]!.y, 1e-12),
    ),
  );

  TestValidator.predicate(
    "the same design places the same army twice",
    placed([hillside], { x: 0, y: anchorHeight, z: 0 }).every(
      (point, index) => point.y === climbed[index]!.y,
    ),
  );
};
