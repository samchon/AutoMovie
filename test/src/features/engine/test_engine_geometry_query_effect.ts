import {
  measureAutoMovieGeometry,
  sampleCompiledEffect,
} from "@automovie/engine";
import {
  AutoMovieGeometryQuery,
  IAutoMovieCompiledEffect,
  IAutoMovieCompiledShotSource,
  IAutoMovieEffectRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieQuaternion,
  IAutoMovieSceneNode,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

const RECIPE: IAutoMovieEffectRecipe = {
  id: "fog",
  kind: "fog",
  seed: 1,
  emission: { rate: 10, burst: 5, duration: 2 },
  particle: {
    lifetime: { min: 1, max: 3 },
    size: { min: 0.1, max: 0.2 },
    color: "#ffffff",
    opacity: { min: 0.2, max: 0.6 },
  },
  motion: { wind: { x: 0, y: 0, z: 0 }, rise: 0, turbulence: 0 },
  budget: { maxParticles: 100, lodDistance: 1_000 },
  blend: "alpha",
};

/** A ten-metre cube of fog centred on the origin, active from 1 s to 3 s. */
const effect = (
  id: string,
  start: number,
  end: number,
): IAutoMovieCompiledEffect => ({
  version: 1,
  id,
  zone: "haze",
  kind: "fog",
  bounds: { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } },
  seed: 7,
  recipe: RECIPE,
  start,
  end,
  intensity: { from: 1, to: 1 },
  fixedStepSeconds: 0.25,
  digest: `sha256:${"e".repeat(64)}`,
});

const FACING_NEGATIVE_Z: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };
/** Turned 45 degrees clockwise seen from above, so it looks toward +x and -z. */
const TURNED_AWAY: IAutoMovieQuaternion = {
  x: 0,
  y: Math.sin(-Math.PI / 8),
  z: 0,
  w: Math.cos(Math.PI / 8),
};

const subject = (
  id: string,
  x: number,
  y: number,
  z: number,
): IAutoMovieSceneNode => ({
  id,
  model: "prop",
  transform: {
    translation: { x, y, z },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  motion: null,
  pose: null,
});

/** One subject inside the cube, and one just past each of its six faces. */
const SUBJECTS = [
  subject("inside", 0, 0, 0),
  subject("west", -6, 0, 0),
  subject("east", 6, 0, 0),
  subject("below", 0, -6, 0),
  subject("above", 0, 6, 0),
  subject("back", 0, 0, -6),
  subject("fore", 0, 0, 6),
];

const storm = (
  props: {
    effects?: IAutoMovieCompiledEffect[];
    camera?: { x: number; y: number; z: number };
    rotation?: IAutoMovieQuaternion;
    far?: number;
    cameraId?: string;
  } = {},
): IAutoMovieCompiledShotSource => ({
  eventSamples: [],
  scene: {
    id: "storm-scene",
    name: null,
    nodes: SUBJECTS,
    cameras: [
      {
        id: "cam",
        transform: {
          translation: props.camera ?? { x: 0, y: 0, z: 10 },
          rotation: props.rotation ?? FACING_NEGATIVE_Z,
          scale: { x: 1, y: 1, z: 1 },
        },
        fovY: 60,
        near: 0.1,
        far: props.far ?? 100,
        depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
      },
    ],
    lights: [],
  },
  motions: [],
  shot: {
    id: "storm",
    name: null,
    scene: "storm-scene",
    camera: props.cameraId ?? "cam",
    cameraMotion: null,
    performances: [],
    objectMotions: [],
    duration: 4,
  },
  models: [{ ...createModel(null), id: "prop" }],
  formations: [],
  instanceSets: [],
  formationMotions: [],
  formationSlotMotions: [],
  effects: props.effects ?? [effect("gust", 1, 3)],
});

const PRODUCTION: Pick<IAutoMovieProductionDesign, "frameFormat"> = {
  frameFormat: { width: 200, height: 100, fps: 24, colorSpace: "srgb" },
};

const measure = (
  request: Partial<Extract<AutoMovieGeometryQuery, { query: "effect" }>>,
  shot: IAutoMovieCompiledShotSource = storm(),
  production: typeof PRODUCTION | null = PRODUCTION,
): Record<string, number | string | boolean> => {
  const result = measureAutoMovieGeometry({
    request: {
      query: "effect",
      zone: "haze",
      shot: "storm",
      time: 2,
      ...request,
    },
    design: {
      production,
      world: null,
      formations: new Map(),
      shots: new Map(),
    },
    compiled: new Map([["storm", shot]]),
    timeline: null,
  });
  if (result.kind !== "measurement")
    throw new Error("a measurement was expected");
  return result.values;
};

/**
 * An effect query samples its zone's compiled stream at the asked time and
 * measures how much of the camera's view the stream fills.
 *
 * The stream's own sampler decides its particles; this query composes them.
 * Every composed value is hand arithmetic on the ten-metre cube: its volume is
 * 1,000 cubic metres, a camera ten metres out on +z looking down -Z passes
 * through ten metres of it and stands ten metres from its centre, and density
 * times that length times the peak opacity is the visibility risk.
 *
 * Scenarios:
 *
 * 1. At 2 s, inside the cue, the stream is active with the sampler's particles;
 *    density, opacity range, camera distance, crossing length, risk and the
 *    representative frame follow by hand, and of seven subjects only the one
 *    inside the cube is counted, each of the other six lying past a different
 *    face.
 * 2. Without subjects none are counted. At half a second, outside the cue, the
 *    zone's only stream is still the one measured and it is inactive.
 * 3. The crossing length stops at the camera's far plane, is zero for a camera
 *    beside the cube looking parallel to one of its faces, and zero for a camera
 *    looking away from it.
 * 4. A zone with no stream, a time between two streams of one zone, an invalid
 *    or late time, an absent shot, an absent camera, a missing production frame
 *    format, and a subject list too long or repeated each refuse.
 */
export const test_engine_geometry_query_effect = (): void => {
  const reference = sampleCompiledEffect(effect("gust", 1, 3), 2, 10);
  const inside = measure({ subjects: SUBJECTS.map((node) => node.id) });
  const count = reference.particles.length;
  TestValidator.equals(
    "an effect query composes the sampled stream with hand geometry",
    namedFacts([
      [
        "sampledParticles",
        () =>
          count > 0 && inside.particleCount === count && inside.active === true,
      ],
      [
        "sampledTime",
        () => inside.sampledTime === 2 && inside.representativeFrame === 48,
      ],
      ["cap", () => inside.particleCap === 100 && inside.intensity === 1],
      ["density", () => nclose(inside.density as number, count / 1_000, 1e-15)],
      [
        "opacity",
        () =>
          nclose(inside.minimumOpacity as number, 0.2, 1e-15) &&
          nclose(inside.maximumOpacity as number, 0.6, 1e-15),
      ],
      ["cameraDistance", () => inside.cameraDistance === 10],
      [
        "crossing",
        () => nclose(inside.cameraIntersectionLength as number, 10, 1e-12),
      ],
      [
        "risk",
        () =>
          nclose(
            inside.visibilityRisk as number,
            Math.min(1, (count / 1_000) * 10 * 0.6),
            1e-12,
          ),
      ],
      [
        "subjects",
        () => inside.subjectCount === 7 && inside.subjectsInside === 1,
      ],
      ["digest", () => inside.effectDigest === `sha256:${"e".repeat(64)}`],
    ]),
    {
      sampledParticles: true,
      sampledTime: true,
      cap: true,
      density: true,
      opacity: true,
      cameraDistance: true,
      crossing: true,
      risk: true,
      subjects: true,
      digest: true,
    },
  );

  const early = measure({ time: 0.5 });
  TestValidator.equals(
    "an effect query measures the only stream of its zone and clips the camera ray",
    namedFacts([
      [
        "noSubjects",
        () =>
          measure({}).subjectCount === 0 && measure({}).subjectsInside === 0,
      ],
      [
        "onlyStreamInactive",
        () =>
          early.active === false &&
          early.particleCount === 0 &&
          early.representativeFrame === 12,
      ],
      [
        "farPlane",
        () =>
          nclose(
            measure({}, storm({ far: 12 })).cameraIntersectionLength as number,
            7,
            1e-12,
          ),
      ],
      [
        "besideAndParallel",
        () =>
          measure({}, storm({ camera: { x: 7, y: 0, z: 10 } }))
            .cameraIntersectionLength === 0,
      ],
      [
        "lookingAway",
        () =>
          measure(
            {},
            storm({ camera: { x: 7, y: 0, z: 10 }, rotation: TURNED_AWAY }),
          ).cameraIntersectionLength === 0,
      ],
    ]),
    {
      noSubjects: true,
      onlyStreamInactive: true,
      farPlane: true,
      besideAndParallel: true,
      lookingAway: true,
    },
  );

  TestValidator.equals(
    "an effect query refuses what it cannot measure",
    namedFacts([
      [
        "noStream",
        () =>
          throwsError(
            () => measure({ zone: "calm" }),
            'Shot "storm" has no compiled effect cue for zone "calm"',
          ),
      ],
      [
        "betweenStreams",
        () =>
          throwsError(
            () =>
              measure(
                { time: 0.5 },
                storm({
                  effects: [effect("gust", 1, 3), effect("squall", 3.5, 4)],
                }),
              ),
            'Shot "storm" has no unambiguous effect cue for zone "haze" at 0.5s',
          ),
      ],
      [
        "negativeTime",
        () =>
          throwsError(
            () => measure({ time: -1 }),
            "Effect sample time -1 is invalid",
          ),
      ],
      [
        "nanTime",
        () =>
          throwsError(
            () => measure({ time: Number.NaN }),
            "Effect sample time NaN is invalid",
          ),
      ],
      [
        "lateTime",
        () =>
          throwsError(
            () => measure({ time: 5 }),
            'Effect sample time 5 exceeds shot "storm" duration 4',
          ),
      ],
      [
        "absentShot",
        () =>
          throwsError(
            () => measure({ shot: "calm-shot" }),
            'Shot "calm-shot" has no current compiled source',
          ),
      ],
      [
        "absentCamera",
        () =>
          throwsError(
            () => measure({}, storm({ cameraId: "gone" })),
            'Shot "storm" has no current compiled camera "gone"',
          ),
      ],
      [
        "noProduction",
        () =>
          throwsError(
            () => measure({}, storm(), null),
            "Effect measurement requires current production frame format. Restore production design and compile.",
          ),
      ],
      [
        "tooManySubjects",
        () =>
          throwsError(
            () =>
              measure({
                subjects: Array.from(
                  { length: 257 },
                  (_, index) => `subject-${index}`,
                ),
              }),
            "at most 256 unique compiled scene-node ids",
          ),
      ],
      [
        "repeatedSubjects",
        () =>
          throwsError(
            () => measure({ subjects: ["inside", "inside"] }),
            "at most 256 unique compiled scene-node ids",
          ),
      ],
    ]),
    {
      noStream: true,
      betweenStreams: true,
      negativeTime: true,
      nanTime: true,
      lateTime: true,
      absentShot: true,
      absentCamera: true,
      noProduction: true,
      tooManySubjects: true,
      repeatedSubjects: true,
    },
  );
};
