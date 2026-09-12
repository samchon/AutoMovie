import { measureAutoMovieGeometry, worldRamp } from "@automovie/engine";
import {
  AutoMovieGeometryQuery,
  IAutoMovieCamera,
  IAutoMovieClip,
  IAutoMovieCompiledShotSource,
  IAutoMovieGeometryResult,
  IAutoMovieModel,
  IAutoMovieSceneNode,
  IAutoMovieShot,
  IAutoMovieTransform,
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

const QUARTER_Y = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };

const place = (
  translation: { x: number; y: number; z: number },
  rotation = { x: 0, y: 0, z: 0, w: 1 },
  scale = { x: 1, y: 1, z: 1 },
): IAutoMovieTransform => ({ translation, rotation, scale });

const node = (
  id: string,
  model: string,
  transform: IAutoMovieTransform,
  extra: Partial<IAutoMovieSceneNode> = {},
): IAutoMovieSceneNode => ({
  id,
  model,
  transform,
  motion: null,
  pose: null,
  ...extra,
});

const camera: IAutoMovieCamera = {
  id: "cam",
  transform: place({ x: 0, y: 1, z: 10 }),
  fovY: 60,
  near: 0.1,
  far: 100,
  depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
};

const RIGGED: IAutoMovieModel = {
  ...createModel(createSkeleton()),
  id: "rigged",
};
const PROP: IAutoMovieModel = { ...createModel(null), id: "prop" };

/** A two-second clip whose every key holds the root one metre forward. */
const WALK = {
  ...makeMotion(
    [
      keyframe(
        0,
        makePose(
          [joint("leftLowerArm", { flexion: 10 })],
          place({ x: 0, y: 0, z: 1 }),
        ),
      ),
      keyframe(
        2,
        makePose(
          [joint("leftLowerArm", { flexion: 10 })],
          place({ x: 0, y: 0, z: 1 }),
        ),
      ),
    ],
    2,
  ),
  id: "walk",
};

/** Eight metres along +x over four seconds, under a fixed quarter turn and doubled scale. */
const CART_PATH: IAutoMovieClip = {
  id: "cart-path",
  name: null,
  duration: 4,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "cart", path: "translation" },
      times: [0, 4],
      values: [0, 0, 0, 8, 0, 0],
      interpolation: "linear",
    },
    {
      channel: { kind: "node", node: "cart", path: "rotation" },
      times: [0, 4],
      values: [
        0,
        Math.SQRT1_2,
        0,
        Math.SQRT1_2,
        0,
        Math.SQRT1_2,
        0,
        Math.SQRT1_2,
      ],
      interpolation: "linear",
    },
    {
      channel: { kind: "node", node: "cart", path: "scale" },
      times: [0, 4],
      values: [2, 2, 2, 2, 2, 2],
      interpolation: "linear",
    },
  ],
};

const shot = (
  id: string,
  overrides: Partial<IAutoMovieShot> = {},
): IAutoMovieShot => ({
  id,
  name: null,
  scene: `${id}-scene`,
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 4,
  ...overrides,
});

const compiled = (
  value: IAutoMovieShot,
  nodes: IAutoMovieSceneNode[],
  models: IAutoMovieModel[],
  motions: IAutoMovieCompiledShotSource["motions"] = [],
): IAutoMovieCompiledShotSource => ({
  eventSamples: [],
  scene: { id: value.scene, name: null, nodes, cameras: [camera], lights: [] },
  motions,
  shot: value,
  models,
  formations: [],
  instanceSets: [],
  formationMotions: [],
  formationSlotMotions: [],
  effects: [],
});

const SHOTS = new Map<string, IAutoMovieCompiledShotSource>([
  [
    "a",
    compiled(
      shot("a", {
        performances: [
          { node: "walker", motion: "walk", startOffset: 0.5 },
          { node: "idle", motion: null, startOffset: 0 },
        ],
        objectMotions: [CART_PATH],
      }),
      [
        node(
          "hero",
          "rigged",
          place({ x: 10, y: 0, z: 0 }, QUARTER_Y, { x: 2, y: 2, z: 2 }),
        ),
        node("crate", "prop", place({ x: 1, y: 2, z: 2 })),
        node("cart", "prop", place({ x: 0, y: 0, z: 0 })),
        node("walker", "rigged", place({ x: 0, y: 0, z: 5 })),
        node("statue", "rigged", place({ x: 3, y: 0, z: 0 }), {
          pose: makePose([joint("leftLowerArm", { flexion: 20 })]),
        }),
        node("idle", "rigged", place({ x: 4, y: 0, z: 0 })),
        node("dancer", "rigged", place({ x: 5, y: 0, z: 0 }), {
          motion: "missing-motion",
        }),
      ],
      [RIGGED, PROP],
      [WALK],
    ),
  ],
  [
    "b",
    compiled(
      shot("b"),
      [node("hero", "rigged", place({ x: 0, y: 0, z: 0 }))],
      [RIGGED],
    ),
  ],
  [
    "c",
    compiled(
      shot("c"),
      [node("ghost", "absent", place({ x: 0, y: 0, z: 0 }))],
      [],
    ),
  ],
]);

const WORLD: Pick<IAutoMovieWorldDesign, "landmarks" | "surfaces" | "routes"> =
  {
    landmarks: [
      {
        id: "well",
        position: { x: 6, y: 0, z: 8 },
        radius: 1,
        meaning: "water",
      },
    ],
    surfaces: [
      // One metre high at z = 0, five metres at z = 10.
      worldRamp({
        id: "slope",
        from: { x: 0, z: 0 },
        to: { x: 0, z: 10 },
        width: 10,
        baseHeight: 1,
        rise: 4,
        walkable: true,
      }),
      worldRamp({
        id: "ledge",
        from: { x: 20, z: 0 },
        to: { x: 20, z: 10 },
        width: 4,
        baseHeight: 3,
        rise: 0,
        walkable: false,
      }),
    ],
    routes: [],
  };

const ask = (
  request: AutoMovieGeometryQuery,
  world: Pick<
    IAutoMovieWorldDesign,
    "landmarks" | "surfaces" | "routes"
  > | null = WORLD,
): IAutoMovieGeometryResult =>
  measureAutoMovieGeometry({
    request,
    design: {
      production: null,
      world,
      formations: new Map(),
      shots: new Map(),
    },
    compiled: SHOTS,
    timeline: null,
  });

const meters = (request: AutoMovieGeometryQuery): number => {
  const result = ask(request);
  if (result.kind !== "distance") throw new Error("a distance was expected");
  return result.meters;
};

const values = (
  request: AutoMovieGeometryQuery,
): Record<string, number | string | boolean> => {
  const result = ask(request);
  if (result.kind !== "measurement")
    throw new Error("a measurement was expected");
  return result.values;
};

const point = (x: number, y: number, z: number) => ({
  kind: "point" as const,
  position: { x, y, z },
});

/**
 * Distance, ground and pose queries resolve selectors, actors and terrain from
 * the compiled records they are handed, and refuse by name what those records
 * cannot answer.
 *
 * Every expected number is hand geometry. The shared humanoid's left hand rests
 * 0.75 m out and 1.4 m up in model space, which doubled in scale and turned a
 * quarter about +Y becomes 1.5 m toward -z and 2.8 m up; its head rests 1.7 m
 * up. The slope rises from one metre at z = 0 to five at z = 10.
 *
 * Scenarios:
 *
 * 1. Point, landmark, actor-root and actor-bone selectors measure 13, 10, 5 and
 *    zero metres, the bone through its actor's scale and turn; the same actor in
 *    another shot measures its head 1.7 m above its root.
 * 2. An object motion moves an actor's root along its path, and an absent sample
 *    time measures at zero.
 * 3. An invalid distance time, an absent landmark, a bone on an actor without a
 *    skeleton, an unresolved bone, an actor in several shots without a shot, an
 *    absent actor with and without a shot, and an actor whose model is absent
 *    each refuse by name.
 * 4. Ground under a point answers the first containing surface's height and
 *    walkability, and zero and not walkable over no surface or no world.
 * 5. A performed actor's root is its node plus the pose root at the performance's
 *    local time; a held actor reports its node, its authored pose, or an empty
 *    pose; a time outside the shot and a missing motion refuse.
 */
export const test_engine_geometry_query_selectors = (): void => {
  const handWorld = { x: 10, y: 2.8, z: -1.5 };
  TestValidator.equals(
    "selectors resolve to hand-computed world points",
    namedFacts([
      [
        "points",
        () =>
          meters({
            query: "distance",
            from: point(0, 0, 0),
            to: point(3, 4, 12),
          }) === 13,
      ],
      [
        "landmark",
        () =>
          meters({
            query: "distance",
            from: { kind: "landmark", landmark: "well" },
            to: point(0, 0, 0),
          }) === 10,
      ],
      [
        "actorRoot",
        () =>
          meters({
            query: "distance",
            from: { kind: "actor", actor: "crate" },
            to: point(1, 5, 6),
          }) === 5,
      ],
      [
        "turnedScaledBone",
        () =>
          nclose(
            meters({
              query: "distance",
              shot: "a",
              from: { kind: "actor", actor: "hero", bone: "leftHand" },
              to: point(handWorld.x, handWorld.y, handWorld.z),
            }),
            0,
            1e-9,
          ),
      ],
      [
        "headInOtherShot",
        () =>
          nclose(
            meters({
              query: "distance",
              shot: "b",
              from: { kind: "actor", actor: "hero", bone: "head" },
              to: point(0, 0, 0),
            }),
            1.7,
            1e-12,
          ),
      ],
      [
        "pathMidway",
        () =>
          nclose(
            meters({
              query: "distance",
              time: 2,
              from: { kind: "actor", actor: "cart" },
              to: point(0, 0, 0),
            }),
            4,
            1e-12,
          ),
      ],
      [
        "pathStart",
        () =>
          meters({
            query: "distance",
            from: { kind: "actor", actor: "cart" },
            to: point(0, 0, 0),
          }) === 0,
      ],
    ]),
    {
      points: true,
      landmark: true,
      actorRoot: true,
      turnedScaledBone: true,
      headInOtherShot: true,
      pathMidway: true,
      pathStart: true,
    },
  );

  const actor = (name: string, extra: { bone?: string } = {}) => ({
    kind: "actor" as const,
    actor: name,
    ...extra,
  });
  TestValidator.equals(
    "a selector the records cannot resolve refuses by name",
    namedFacts([
      [
        "negativeTime",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                time: -1,
                from: point(0, 0, 0),
                to: point(1, 0, 0),
              }),
            "Distance sample time -1 is invalid",
          ),
      ],
      [
        "nanTime",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                time: Number.NaN,
                from: point(0, 0, 0),
                to: point(1, 0, 0),
              }),
            "Distance sample time NaN is invalid",
          ),
      ],
      [
        "landmark",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                from: { kind: "landmark", landmark: "nope" },
                to: point(0, 0, 0),
              }),
            'Landmark "nope" does not exist',
          ),
      ],
      [
        "landmarkWithoutWorld",
        () =>
          throwsError(
            () =>
              ask(
                {
                  query: "distance",
                  from: { kind: "landmark", landmark: "well" },
                  to: point(0, 0, 0),
                },
                null,
              ),
            'Landmark "well" does not exist',
          ),
      ],
      [
        "boneWithoutSkeleton",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                from: actor("crate", { bone: "head" }),
                to: point(0, 0, 0),
              }),
            'Actor "crate" has no skeleton, so bone "head" cannot resolve.',
          ),
      ],
      [
        "unresolvedBone",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                shot: "a",
                from: actor("hero", { bone: "rightHand" }),
                to: point(0, 0, 0),
              }),
            'Actor "hero" has no resolved bone "rightHand"',
          ),
      ],
      [
        "ambiguous",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                from: actor("hero"),
                to: point(0, 0, 0),
              }),
            'Actor "hero" appears in multiple compiled shots (a, b)',
          ),
      ],
      [
        "absent",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                from: actor("nobody"),
                to: point(0, 0, 0),
              }),
            'Actor "nobody" does not exist in current compiled scenes',
          ),
      ],
      [
        "absentInShot",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                shot: "a",
                from: actor("nobody"),
                to: point(0, 0, 0),
              }),
            'Actor "nobody" does not exist in shot "a"',
          ),
      ],
      [
        "absentShot",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                shot: "zzz",
                from: actor("crate"),
                to: point(0, 0, 0),
              }),
            'Actor "crate" does not exist in shot "zzz"',
          ),
      ],
      [
        "absentModel",
        () =>
          throwsError(
            () =>
              meters({
                query: "distance",
                from: actor("ghost"),
                to: point(0, 0, 0),
              }),
            'Actor "ghost" references missing model "absent" in shot "c"',
          ),
      ],
    ]),
    {
      negativeTime: true,
      nanTime: true,
      landmark: true,
      landmarkWithoutWorld: true,
      boneWithoutSkeleton: true,
      unresolvedBone: true,
      ambiguous: true,
      absent: true,
      absentInShot: true,
      absentShot: true,
      absentModel: true,
    },
  );

  const ground = (x: number, z: number, world: typeof WORLD | null = WORLD) =>
    ask({ query: "ground", point: { x, z } }, world);
  TestValidator.equals(
    "ground answers the first containing surface or none",
    namedFacts([
      [
        "slope",
        () => {
          const answer = ground(0, 5);
          return (
            answer.kind === "ground" &&
            nclose(answer.height, 3, 1e-12) &&
            answer.surface === "slope" &&
            answer.walkable === true
          );
        },
      ],
      [
        "ledge",
        () => {
          const answer = ground(20, 5);
          return (
            answer.kind === "ground" &&
            nclose(answer.height, 3, 1e-12) &&
            answer.surface === "ledge" &&
            answer.walkable === false
          );
        },
      ],
      [
        "nothing",
        () => {
          const answer = ground(100, 100);
          return (
            answer.kind === "ground" &&
            answer.height === 0 &&
            answer.surface === null &&
            answer.walkable === false
          );
        },
      ],
      [
        "noWorld",
        () => {
          const answer = ground(0, 5, null);
          return (
            answer.kind === "ground" &&
            answer.height === 0 &&
            answer.surface === null
          );
        },
      ],
    ]),
    { slope: true, ledge: true, nothing: true, noWorld: true },
  );

  const walker = values({ query: "pose", actor: "walker", shot: "a", time: 1 });
  const statue = values({ query: "pose", actor: "statue", shot: "a", time: 0 });
  const idle = values({ query: "pose", actor: "idle", shot: "a", time: 0 });
  const crate = values({ query: "pose", actor: "crate", shot: "a", time: 0 });
  TestValidator.equals(
    "a pose query reports the performed or held root and joints",
    namedFacts([
      [
        "walkerRoot",
        () =>
          walker.held === false &&
          walker.rootX === 0 &&
          walker.rootY === 0 &&
          nclose(walker.rootZ as number, 6, 1e-12),
      ],
      [
        "walkerJoints",
        () =>
          walker.jointCount === 1 &&
          walker.shot === "a" &&
          walker.actor === "walker",
      ],
      [
        "statue",
        () =>
          statue.held === true && statue.jointCount === 1 && statue.rootX === 3,
      ],
      [
        "idle",
        () => idle.held === true && idle.jointCount === 0 && idle.rootX === 4,
      ],
      [
        "crate",
        () =>
          crate.held === true && crate.jointCount === 0 && crate.rootY === 2,
      ],
      [
        "late",
        () =>
          throwsError(
            () => values({ query: "pose", actor: "crate", shot: "a", time: 5 }),
            'Actor sample time 5 is outside shot "a" duration 0..4',
          ),
      ],
      [
        "early",
        () =>
          throwsError(
            () =>
              values({ query: "pose", actor: "crate", shot: "a", time: -1 }),
            'Actor sample time -1 is outside shot "a"',
          ),
      ],
      [
        "missingMotion",
        () =>
          throwsError(
            () =>
              values({ query: "pose", actor: "dancer", shot: "a", time: 0 }),
            'Actor "dancer" references missing motion "missing-motion"',
          ),
      ],
    ]),
    {
      walkerRoot: true,
      walkerJoints: true,
      statue: true,
      idle: true,
      crate: true,
      late: true,
      early: true,
      missingMotion: true,
    },
  );
};
