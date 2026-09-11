import {
  materializeCompiledFormation,
  measureAutoMovieGeometry,
  worldRamp,
} from "@automovie/engine";
import {
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledShotSource,
  IAutoMovieFormationDesign,
  IAutoMovieFormationSlotMotion,
  IAutoMovieProductionDesign,
  IAutoMovieQuaternion,
  IAutoMovieSceneNode,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  createModel,
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

/** Ground height `(z + 10) / 2`: 5 m under z = 0, 6.5 m under z = 3. */
const RISE = worldRamp({
  id: "rise",
  from: { x: 0, z: -10 },
  to: { x: 0, z: 30 },
  width: 40,
  baseHeight: 0,
  rise: 20,
  walkable: true,
});
const groundAt = (z: number): number => (z + 10) / 2;

/** Level ground nobody may stand on, far along +x. */
const BOG = worldRamp({
  id: "bog",
  from: { x: 100, z: -10 },
  to: { x: 100, z: 30 },
  width: 20,
  baseHeight: 0,
  rise: 0,
  walkable: false,
});

const WORLD: Pick<IAutoMovieWorldDesign, "landmarks" | "surfaces" | "routes"> =
  {
    landmarks: [],
    surfaces: [RISE, BOG],
    routes: [
      {
        id: "road",
        waypoints: [
          { x: 0, z: -10 },
          { x: 0, z: 30 },
        ],
        allowedFormationWidth: 10,
      },
    ],
  };

const PRODUCTION: Pick<IAutoMovieProductionDesign, "frameFormat"> = {
  frameFormat: { width: 200, height: 100, fps: 24, colorSpace: "srgb" },
};

/**
 * Two ranks of three, two metres between files and three between ranks, with
 * slot 1 promoted to a banner. Staged on its own ground at the anchor.
 */
const unit = (
  overrides: Partial<IAutoMovieFormationDesign> = {},
): IAutoMovieFormationDesign => ({
  id: "unit",
  modelRecipe: "member",
  count: 6,
  layout: {
    kind: "line",
    files: 3,
    ranks: 2,
    spacing: { lateral: 2, depth: 3 },
  },
  anchor: { x: 0, y: groundAt(0), z: 0 },
  facingDeg: 0,
  seed: 1,
  capabilities: [],
  heroOverrides: [{ slot: 1, actor: "banner" }],
  ...overrides,
});

const LOOKING_BACK: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };
const LOOKING_AWAY: IAutoMovieQuaternion = { x: 0, y: 1, z: 0, w: 0 };

const SWAY = {
  ...makeMotion(
    [
      keyframe(
        0,
        makePose([joint("leftLowerArm", { flexion: 5 })], {
          translation: { x: 0, y: 0, z: 1 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
      keyframe(
        4,
        makePose([joint("leftLowerArm", { flexion: 5 })], {
          translation: { x: 0, y: 0, z: 1 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
    ],
    4,
  ),
  id: "sway",
};

const compiledShot = (props: {
  id: string;
  runtime: IAutoMovieCompiledFormation | null;
  cameraRotation?: IAutoMovieQuaternion;
  cameraId?: string;
  banner?: "static" | "performed" | "absent";
  slotMotions?: IAutoMovieFormationSlotMotion[];
}): IAutoMovieCompiledShotSource => {
  const hero = props.runtime?.heroes[0];
  const nodes: IAutoMovieSceneNode[] =
    props.banner === "absent" || hero === undefined
      ? []
      : [
          {
            id: "banner",
            model: props.banner === "performed" ? "rigged-banner" : "banner",
            transform: hero.transform,
            motion: props.banner === "performed" ? "sway" : null,
            pose: null,
          },
        ];
  return {
    eventSamples: [],
    scene: {
      id: `${props.id}-scene`,
      name: null,
      nodes,
      cameras: [
        {
          id: "cam",
          transform: {
            translation: { x: 0, y: 6, z: 20 },
            rotation: props.cameraRotation ?? LOOKING_BACK,
            scale: { x: 1, y: 1, z: 1 },
          },
          fovY: 60,
          near: 0.1,
          far: 100,
          depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
        },
      ],
      lights: [],
    },
    motions: [SWAY],
    shot: {
      id: props.id,
      name: null,
      scene: `${props.id}-scene`,
      camera: props.cameraId ?? "cam",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      duration: 4,
    },
    models: [
      { ...createModel(null), id: "banner" },
      { ...createModel(createSkeleton()), id: "rigged-banner" },
    ],
    formations: props.runtime === null ? [] : [props.runtime],
    instanceSets: [],
    formationMotions: [],
    formationSlotMotions: props.slotMotions ?? [],
    effects: [],
  };
};

type IContract = Pick<IAutoMovieShotContract, "participants" | "camera">;
const contract = (formation: boolean): IContract => ({
  participants: formation
    ? [
        { kind: "formation", id: "unit" },
        { kind: "actor", id: "banner" },
      ]
    : [{ kind: "actor", id: "banner" }],
  camera: {
    intent: "frame the unit",
    requiredSubjects: [],
    maxOcclusionRatio: 0.2,
  },
});

const measure = (props: {
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  contracts?: ReadonlyMap<string, IContract>;
  design?: IAutoMovieFormationDesign;
  world?: Pick<IAutoMovieWorldDesign, "landmarks" | "surfaces" | "routes">;
  formation?: string;
  shot?: string;
  time?: number;
}): Record<string, number | string | boolean> => {
  const result = measureAutoMovieGeometry({
    request: {
      query: "formation",
      formation: props.formation ?? "unit",
      ...(props.shot === undefined ? {} : { shot: props.shot }),
      ...(props.time === undefined ? {} : { time: props.time }),
    },
    design: {
      production: PRODUCTION,
      world: props.world ?? WORLD,
      formations: new Map([["unit", props.design ?? unit()]]),
      shots:
        props.contracts ??
        new Map([
          ["march", contract(true)],
          ["elsewhere", contract(false)],
        ]),
    },
    compiled: props.compiled,
    timeline: null,
  });
  if (result.kind !== "measurement")
    throw new Error("a measurement was expected");
  return result.values;
};

const removeSlotFive: IAutoMovieFormationSlotMotion = {
  id: "fall",
  formation: "unit",
  slots: [5],
  start: 0,
  end: 4,
  from: { present: false, offset: { x: 0, y: 0, z: 0 }, facingOffsetDeg: 0 },
  to: { present: false, offset: { x: 0, y: 0, z: 0 }, facingOffsetDeg: 0 },
  easing: "linear",
};

/**
 * A formation query reads a unit where its compiled runtime places it, and
 * checks its representative members against the ground under each of them.
 *
 * This pins the defect the query carried while it lived in the production
 * oracle: a representative member was placed from the formation design, which
 * has no terrain, so every member stood at its anchor's height and a unit
 * standing correctly on a rise was reported off its ground. The expected heights
 * come from the rise itself, `(z + 10) / 2`: the front rank at z = 0 stands on
 * 5 m and the rear rank at z = 3 on 6.5 m. The representative members of the one
 * chunk are slots 0, 2 and 5, and slot 5 is in the rear rank.
 *
 * Scenarios:
 *
 * 1. The unit staged on its ground compiles its rear rank at 6.5 m and reports no
 *    ground violation. Placed from the design instead, slot 5 would stand at 5 m
 *    under ground at 6.5 m and be reported.
 * 2. The same unit staged one metre above its ground reports all three
 *    representative members, one staged over ground nobody may stand on reports
 *    all three for walkability alone, and a representative member the shot has
 *    removed is not measured.
 * 3. The unit's counts, extent, centroid, heading, identity motion, route
 *    clearance and digest are reported; from in front its five anonymous members
 *    are drawn near and its banner is visible, and from behind all five are
 *    culled and the banner is not.
 * 4. A world without routes reports no clearance, a shot without the banner's
 *    node counts no visible hero, and a second participating shot whose banner
 *    performs a root offset is selectable by name at an asked time.
 * 5. A missing formation, a unit no current shot fully materializes, a shot the
 *    unit is not in, a time outside the shot, and a missing camera each refuse.
 */
export const test_engine_geometry_query_formation = (): void => {
  const grounded = materializeCompiledFormation({
    formation: unit(),
    surfaces: WORLD.surfaces,
  });
  const march = new Map([
    ["march", compiledShot({ id: "march", runtime: grounded })],
  ]);
  const onGround = measure({ compiled: march });

  TestValidator.equals(
    "a unit on its rise stands on it and reports no ground violation",
    namedFacts([
      [
        "frontRankHeight",
        () => nclose(grounded.bounds.min.y, groundAt(0), 1e-12),
      ],
      [
        "rearRankHeight",
        () => nclose(grounded.bounds.max.y, groundAt(3), 1e-12),
      ],
      ["representatives", () => onGround.representativeSlots === 3],
      ["noViolation", () => onGround.groundViolations === 0],
    ]),
    {
      frontRankHeight: true,
      rearRankHeight: true,
      representatives: true,
      noViolation: true,
    },
  );

  const raisedDesign = unit({ anchor: { x: 0, y: groundAt(0) + 1, z: 0 } });
  const raised = materializeCompiledFormation({
    formation: raisedDesign,
    surfaces: WORLD.surfaces,
  });
  const boggedDesign = unit({ anchor: { x: 100, y: 0, z: 0 } });
  const bogged = materializeCompiledFormation({
    formation: boggedDesign,
    surfaces: WORLD.surfaces,
  });
  TestValidator.equals(
    "a unit off its ground is reported and a removed member is not",
    namedFacts([
      [
        "raised",
        () =>
          measure({
            compiled: new Map([
              ["march", compiledShot({ id: "march", runtime: raised })],
            ]),
            design: raisedDesign,
          }).groundViolations === 3,
      ],
      [
        "notWalkable",
        () =>
          measure({
            compiled: new Map([
              ["march", compiledShot({ id: "march", runtime: bogged })],
            ]),
            design: boggedDesign,
          }).groundViolations === 3,
      ],
      [
        "removedNotMeasured",
        () =>
          measure({
            compiled: new Map([
              [
                "march",
                compiledShot({
                  id: "march",
                  runtime: raised,
                  slotMotions: [removeSlotFive],
                }),
              ],
            ]),
            design: raisedDesign,
          }).groundViolations === 2,
      ],
    ]),
    { raised: true, notWalkable: true, removedNotMeasured: true },
  );

  const fromBehind = measure({
    compiled: new Map([
      [
        "march",
        compiledShot({
          id: "march",
          runtime: grounded,
          cameraRotation: LOOKING_AWAY,
        }),
      ],
    ]),
  });
  TestValidator.equals(
    "a formation query reports the unit's compiled measure and resolution",
    namedFacts([
      [
        "counts",
        () =>
          onGround.designCount === 6 &&
          onGround.materializedCount === 6 &&
          onGround.anonymousCount === 5 &&
          onGround.heroCount === 1,
      ],
      [
        "chunks",
        () => onGround.chunkCount === 1 && onGround.participatingShots === 1,
      ],
      ["extent", () => onGround.width === 4 && onGround.depth === 3],
      [
        "centroid",
        () =>
          nclose(onGround.centroidX as number, 0, 1e-12) &&
          nclose(
            onGround.centroidY as number,
            (3 * groundAt(0) + 3 * groundAt(3)) / 6,
            1e-9,
          ) &&
          nclose(onGround.centroidZ as number, 1.5, 1e-12),
      ],
      [
        "identityMotion",
        () =>
          onGround.sampledTime === 0 &&
          onGround.motionOffsetX === 0 &&
          onGround.motionOffsetY === 0 &&
          onGround.motionOffsetZ === 0 &&
          onGround.motionFacingOffsetDeg === 0 &&
          onGround.lateralSpacingScale === 1 &&
          onGround.depthSpacingScale === 1 &&
          onGround.facingDeg === 0,
      ],
      ["routeClearance", () => onGround.routeClearance === 10 - 4],
      [
        "identity",
        () =>
          onGround.compiledDigest === grounded.digest &&
          onGround.state === "compiled",
      ],
      [
        "distance",
        () =>
          onGround.nearestDistance === onGround.farthestDistance &&
          nclose(
            onGround.nearestDistance as number,
            Math.hypot(0, 5.75 - 6, 1.5 - 20),
            1e-9,
          ),
      ],
      [
        "drawnNear",
        () =>
          onGround.nearVisible === 5 &&
          onGround.farVisible === 0 &&
          onGround.culled === 0,
      ],
      ["bannerVisible", () => onGround.heroVisible === 1],
      [
        "culledFromBehind",
        () =>
          fromBehind.culled === 5 &&
          fromBehind.nearVisible === 0 &&
          fromBehind.heroVisible === 0,
      ],
    ]),
    {
      counts: true,
      chunks: true,
      extent: true,
      centroid: true,
      identityMotion: true,
      routeClearance: true,
      identity: true,
      distance: true,
      drawnNear: true,
      bannerVisible: true,
      culledFromBehind: true,
    },
  );

  const parade = compiledShot({
    id: "parade",
    runtime: grounded,
    banner: "performed",
  });
  const twoShots = measure({
    compiled: new Map([
      ["march", compiledShot({ id: "march", runtime: grounded })],
      ["parade", parade],
    ]),
    contracts: new Map([
      ["march", contract(true)],
      ["parade", contract(true)],
    ]),
    shot: "parade",
    time: 1,
  });
  TestValidator.equals(
    "a formation query follows the world, the banner node and the named shot",
    namedFacts([
      [
        "noRoutes",
        () =>
          measure({ compiled: march, world: { ...WORLD, routes: [] } })
            .routeClearance === 0,
      ],
      [
        "noBannerNode",
        () =>
          measure({
            compiled: new Map([
              [
                "march",
                compiledShot({
                  id: "march",
                  runtime: grounded,
                  banner: "absent",
                }),
              ],
            ]),
          }).heroVisible === 0,
      ],
      [
        "twoParticipating",
        () => twoShots.participatingShots === 2 && twoShots.sampledTime === 1,
      ],
      ["performedBanner", () => twoShots.heroVisible === 1],
    ]),
    {
      noRoutes: true,
      noBannerNode: true,
      twoParticipating: true,
      performedBanner: true,
    },
  );

  const unmaterialized =
    'Formation "unit" is not fully materialized in every current participating shot';
  const other = materializeCompiledFormation({
    formation: unit({ seed: 2 }),
    surfaces: WORLD.surfaces,
  });
  TestValidator.equals(
    "a formation query refuses what no current shot answers",
    namedFacts([
      [
        "missing",
        () =>
          throwsError(
            () => measure({ compiled: march, formation: "ghost" }),
            'Formation "ghost" does not exist',
          ),
      ],
      [
        "noParticipant",
        () =>
          throwsError(
            () =>
              measure({
                compiled: march,
                contracts: new Map([["elsewhere", contract(false)]]),
              }),
            unmaterialized,
          ),
      ],
      [
        "noRuntime",
        () =>
          throwsError(
            () =>
              measure({
                compiled: new Map([
                  ["march", compiledShot({ id: "march", runtime: null })],
                ]),
              }),
            unmaterialized,
          ),
      ],
      [
        "noCompiledShot",
        () =>
          throwsError(() => measure({ compiled: new Map() }), unmaterialized),
      ],
      [
        "digestsDisagree",
        () =>
          throwsError(
            () =>
              measure({
                compiled: new Map([
                  ["march", compiledShot({ id: "march", runtime: grounded })],
                  ["parade", compiledShot({ id: "parade", runtime: other })],
                ]),
                contracts: new Map([
                  ["march", contract(true)],
                  ["parade", contract(true)],
                ]),
              }),
            unmaterialized,
          ),
      ],
      [
        "countDisagrees",
        () =>
          throwsError(
            () => measure({ compiled: march, design: unit({ count: 7 }) }),
            unmaterialized,
          ),
      ],
      [
        "noChunks",
        () =>
          throwsError(
            () =>
              measure({
                compiled: new Map([
                  [
                    "march",
                    compiledShot({
                      id: "march",
                      runtime: { ...grounded, chunks: [] },
                    }),
                  ],
                ]),
              }),
            unmaterialized,
          ),
      ],
      [
        "notParticipating",
        () =>
          throwsError(
            () => measure({ compiled: march, shot: "elsewhere" }),
            'Shot "elsewhere" does not participate in formation "unit". Select one of march.',
          ),
      ],
      [
        "late",
        () =>
          throwsError(
            () => measure({ compiled: march, time: 5 }),
            'Formation sample time 5 is outside current shot "march"',
          ),
      ],
      [
        "early",
        () =>
          throwsError(
            () => measure({ compiled: march, time: -1 }),
            'Formation sample time -1 is outside current shot "march"',
          ),
      ],
      [
        "noCamera",
        () =>
          throwsError(
            () =>
              measure({
                compiled: new Map([
                  [
                    "march",
                    compiledShot({
                      id: "march",
                      runtime: grounded,
                      cameraId: "gone",
                    }),
                  ],
                ]),
              }),
            'Shot "march" has no current compiled camera "gone"',
          ),
      ],
    ]),
    {
      missing: true,
      noParticipant: true,
      noRuntime: true,
      noCompiledShot: true,
      digestsDisagree: true,
      countDisagrees: true,
      noChunks: true,
      notParticipating: true,
      late: true,
      early: true,
      noCamera: true,
    },
  );
};
