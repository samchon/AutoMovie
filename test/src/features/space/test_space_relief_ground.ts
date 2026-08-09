import {
  IAutoMovieFormationPlacement,
  followPathMotion,
  formationSlotPosition,
  heightAt,
  plantStanceFeet,
  spaceGround,
  stageScene,
  surfaceHeightAt,
  validateFootSkate,
  validateGroundContact,
  worldHeightfield,
  worldSurfaceHeight,
} from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieTransform,
  IAutoMovieWorldSurface,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import {
  namedFacts,
  nclose,
  validationHasNoWarnings,
  validationHasWarnings,
} from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});
const v = (x: number, z: number, y = 0) => ({ x, y, z });

/** Metres of rise per metre of +X, the one number both records are built on. */
const RISE = 0.2;

/**
 * Terrain that climbs along +X, stated as a sampled lattice.
 *
 * A lattice rather than a slope on purpose: a plane is the shape the scene's
 * two-anchor spelling can already say, so it could never show whether the
 * staged patch learned the world's rule. Bilinear interpolation reproduces a
 * function linear in X exactly, which is what lets a hand oracle read `RISE * x`
 * off both records.
 */
const terrain = (): IAutoMovieWorldSurface =>
  worldHeightfield({
    id: "slope",
    polygon: [
      { x: -8, z: -4 },
      { x: 12, z: -4 },
      { x: 12, z: 4 },
      { x: -8, z: 4 },
    ],
    origin: { x: -8, z: -4 },
    spacing: { x: 1, z: 1 },
    columns: 21,
    rows: 9,
    height: (point) => point.x * RISE,
    walkable: true,
  });

/** The same ground as the patch a shot stages performers and feet on. */
const reliefSurface = (): IAutoMovieSurface => ({
  id: "slope",
  kind: "floor",
  polygon: terrain().polygon.map((point) => v(point.x, point.z)),
  height: terrain().height,
});

const reliefSpace = (): IAutoMovieSpace => ({
  id: "slope-space",
  surfaces: [reliefSurface()],
  walkable: ["slope"],
});

/** A rank of five abreast at `x` of -4, -2, 0, 2 and 4, standing on `ground`. */
const rank = (
  ground: readonly IAutoMovieWorldSurface[],
  anchorHeight: number,
): IAutoMovieFormationPlacement => ({
  id: "rank",
  count: 5,
  layout: { kind: "line", ranks: 1, files: 5, spacing: { lateral: 2, depth: 1 } },
  anchor: { x: 0, y: anchorHeight, z: 0 },
  facingDeg: 0,
  seed: 5,
  ground,
});

/** A level patch and a ramp, spelled the way every space was spelled before. */
const anchoredSpace = (): IAutoMovieSpace => ({
  id: "yard",
  surfaces: [
    {
      id: "floor",
      kind: "floor",
      polygon: [v(-2, -2), v(2, -2), v(2, 2), v(-2, 2)],
      anchor: { x: 0, y: 0.75, z: 0 },
      rampTo: null,
    },
    {
      id: "ramp",
      kind: "ramp",
      polygon: [v(2, -1), v(6, -1), v(6, 1), v(2, 1)],
      anchor: { x: 2, y: 0, z: 0 },
      rampTo: { x: 6, y: 2, z: 0 },
    },
  ],
  walkable: ["floor", "ramp"],
});

// The bent-rest leg of the plant-feet suites: foot on the ground with reach
// slack, so the pin can hold while the root climbs the relief.
const legSkeleton: IAutoMovieSkeleton = {
  id: "leg",
  bones: [
    { bone: "hips", parent: null, rest: t(0, 0.8, 0), constraint: null },
    {
      bone: "leftUpperLeg",
      parent: "hips",
      rest: t(0.1, 0, 0),
      constraint: null,
    },
    {
      bone: "leftLowerLeg",
      parent: "leftUpperLeg",
      rest: t(0, -0.4, 0.15),
      constraint: null,
    },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: t(0, -0.4, -0.15),
      constraint: null,
    },
  ],
};
const KNEE_REST_FLEXION = (2 * Math.atan2(0.15, 0.4) * 180) / Math.PI;
const REST_FRAMES = {
  leftLowerLeg: {
    flexion: { sign: 1 as const, neutral: KNEE_REST_FLEXION },
  },
};

const kf = (time: number): IAutoMovieKeyframe => ({
  time,
  pose: { skeleton: "leg", root: null, joints: [] },
  expression: null,
  easing: "linear",
  bezier: null,
});
const gait: IAutoMovieMotion = {
  id: "stand",
  skeleton: "leg",
  duration: 1,
  loop: true,
  keyframes: [kf(0), kf(0.5), kf(1)],
};

/** Do the two records answer one number, bit for bit, at this point? */
const agrees = (
  world: IAutoMovieWorldSurface,
  patch: IAutoMovieSurface,
  x: number,
  z: number,
): boolean =>
  worldSurfaceHeight(world, { x, z }) === surfaceHeightAt(patch, x, z);

/** Does one crowd member stand where a performer standing there would? */
const standsWith = (
  crowd: IAutoMovieFormationPlacement,
  space: IAutoMovieSpace,
  slot: number,
): boolean => {
  const member = formationSlotPosition(crowd, slot);
  return member.y === heightAt(space, member.x, member.z);
};

/**
 * A named performer and a crowd member stand on one ground.
 *
 * They used to stand on two. The world's terrain could state sampled relief and
 * a crowd was placed on it bilinearly, while the scene patch a performer stands
 * and foot-plants on could only be a level or a single plane, so the same rise
 * moved the crowd and left the figure beside it flat. Two records answered "how
 * high is the ground here" and one of them could not say.
 *
 * The scene surface now carries the same `IAutoMovieHeightRule` the world
 * surface carries, and `surfaceHeightAt` is the one function that reads it, for
 * both records and every consumer downstream of them.
 *
 * Scenarios:
 *
 * 1. Both records answer the same number, bit for bit, at lattice points, inside
 *    cells, and off the lattice edge: not close, identical, because one function
 *    answers.
 * 2. A crowd member placed on the terrain and a performer standing at that
 *    member's exact point read one height. Five members abreast across the
 *    slope, each compared with the ground query the foot planter uses.
 * 3. A foot plant on relieved ground lands on it: the raw path bake skates,
 *    `plantStanceFeet` against the staged relief corrects it, and the corrected
 *    clip passes `validateGroundContact` judged against that same relief.
 * 4. A staged space that declares no relief is unchanged: the two-anchor
 *    spelling answers exactly the heights it always answered, and `stageScene`
 *    composes it byte for byte, with no field it did not carry before.
 */
export const test_space_relief_ground = (): void => {
  const world = terrain();
  const patch = reliefSurface();
  const space = reliefSpace();

  TestValidator.equals(
    "the world record and the staged patch answer one height",
    namedFacts([
      // On a lattice point, inside a cell, and clamped past the lattice edge.
      ["onSample", () => agrees(world, patch, 0, 0)],
      ["insideCell", () => agrees(world, patch, 3.5, 1.25)],
      ["acrossRows", () => agrees(world, patch, 11.75, -3.5)],
      ["atCorner", () => agrees(world, patch, -8, -4)],
      ["pastTheLattice", () => agrees(world, patch, 40, 40)],
      // The hand oracle, so "identical" cannot be two copies of one mistake.
      ["oracle", () => nclose(surfaceHeightAt(patch, 3.5, 1.25), 0.7, 1e-12)],
      // Clamping, not extrapolating: past the lattice the edge sample stands.
      ["clamped", () => nclose(surfaceHeightAt(patch, 40, 40), 2.4, 1e-12)],
    ]),
    {
      onSample: true,
      insideCell: true,
      acrossRows: true,
      atCorner: true,
      pastTheLattice: true,
      oracle: true,
      clamped: true,
    },
  );

  // The unit is staged on its own ground, so a member's height IS the ground
  // under it and can be compared with what a performer standing there reads.
  const crowd = rank([world], worldSurfaceHeight(world, { x: 0, z: 0 }));
  TestValidator.equals(
    "a crowd member and a performer at that point stand at one height",
    namedFacts([
      ["farLeft", () => standsWith(crowd, space, 0)],
      ["left", () => standsWith(crowd, space, 1)],
      ["centre", () => standsWith(crowd, space, 2)],
      ["right", () => standsWith(crowd, space, 3)],
      ["farRight", () => standsWith(crowd, space, 4)],
      // The rank is not level: without relief every fact above would hold by
      // agreeing on one flat number.
      [
        "spread",
        () =>
          nclose(
            formationSlotPosition(crowd, 4).y -
              formationSlotPosition(crowd, 0).y,
            8 * RISE,
            1e-12,
          ),
      ],
    ]),
    {
      farLeft: true,
      left: true,
      centre: true,
      right: true,
      farRight: true,
      spread: true,
    },
  );

  const ground = spaceGround(space);
  const path = followPathMotion({
    id: "climb",
    gait,
    waypoints: [v(0, 0), v(0.15, 0)],
    speed: 0.15,
    ground,
  });
  const mid = path.frames.find((frame) => nclose(frame.time, 0.5));
  const contacts = [{ bone: "leftFoot", start: 0, end: 1 } as const];
  const planted = plantStanceFeet({
    skeleton: legSkeleton,
    motion: path.motion,
    groundY: ground,
    tolerance: 0.05,
    legs: [{ foot: "leftFoot", upper: "leftUpperLeg", lower: "leftLowerLeg" }],
    restFrames: REST_FRAMES,
  });
  TestValidator.equals(
    "a foot plant on relieved ground lands on the relief",
    namedFacts([
      ["mid", () => mid !== undefined],
      // h(x) = 0.2x, so the half-way frame at x = 0.075 stands at 0.015.
      ["climbs", () => mid !== undefined && nclose(mid.position.y, 0.015)],
      [
        "rawBakeSkates",
        () =>
          validationHasWarnings(
            "raw relief foot-skate",
            validateFootSkate({
              motion: path.motion,
              skeleton: legSkeleton,
              contacts,
              restFrames: REST_FRAMES,
            }),
          ),
      ],
      [
        "plantedHolds",
        () =>
          validationHasNoWarnings(
            "planted relief foot-skate",
            validateFootSkate({
              motion: planted.motion,
              skeleton: legSkeleton,
              contacts,
              restFrames: REST_FRAMES,
            }),
          ),
      ],
      [
        "plantedContacts",
        () =>
          validationHasNoWarnings(
            "planted relief ground-contact",
            validateGroundContact({
              motion: planted.motion,
              skeleton: legSkeleton,
              footBones: ["leftFoot"],
              groundY: ground,
              tolerance: 1e-3,
              restFrames: REST_FRAMES,
            }),
          ),
      ],
    ]),
    {
      mid: true,
      climbs: true,
      rawBakeSkates: true,
      plantedHolds: true,
      plantedContacts: true,
    },
  );

  const flat = anchoredSpace();
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({ space: anchoredSpace() }),
  );
  TestValidator.equals(
    "a space that declares no relief is exactly the space it was",
    namedFacts([
      // Exact, not close: the two-anchor spelling still runs its own
      // arithmetic, so a production on a floor or a ramp keeps its bytes.
      ["level", () => surfaceHeightAt(flat.surfaces[0]!, 1.5, -1.5) === 0.75],
      ["rampFoot", () => surfaceHeightAt(flat.surfaces[1]!, 2, 0) === 0],
      ["rampMid", () => surfaceHeightAt(flat.surfaces[1]!, 4, 0.5) === 1],
      ["rampHead", () => surfaceHeightAt(flat.surfaces[1]!, 6, -0.5) === 2],
      ["staged", () => staged.success === true],
      [
        "verbatim",
        () =>
          staged.success === true &&
          JSON.stringify(staged.scene.space) === JSON.stringify(flat),
      ],
    ]),
    {
      level: true,
      rampFoot: true,
      rampMid: true,
      rampHead: true,
      staged: true,
      verbatim: true,
    },
  );
};
