import {
  compileCameraMove,
  computeModelRestExtent,
  framedBoxOf,
  intersectsPerspectiveFrustumBox,
  nodeSubjectBox,
  nodeSubjectExtent,
  performShot,
  realizeShotContract,
  resolveCameraAt,
  stageScene,
} from "@automovie/engine";
import type {
  IAutoMovieCamera,
  IAutoMovieCameraAction,
  IAutoMovieClip,
  IAutoMovieFormationDesign,
  IAutoMovieModel,
  IAutoMovieShotContract,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { namedFacts, nclose, vclose } from "../internal/predicates";

const NODE = "civic/west-facade";

/** The facade runs 60 m along +X, stands 24 m, and is 2 m thick. */
const WIDTH = 60;
const HEIGHT = 24;
const DEPTH = 2;

const FOV_Y = 40;
const ASPECT = 16 / 9;
const HALF_Y = Math.tan(((FOV_Y / 2) * Math.PI) / 180);
const HALF_X = HALF_Y * ASPECT;

const transform = (
  x: number,
  y: number,
  z: number,
  rotation: IAutoMovieTransform["rotation"] = { x: 0, y: 0, z: 0, w: 1 },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation,
  scale: { x: 1, y: 1, z: 1 },
});

/** A yaw of `deg` about +Y, the only rotation staging gives a set piece. */
const yaw = (deg: number): IAutoMovieTransform["rotation"] => ({
  x: 0,
  y: Math.sin(((deg / 2) * Math.PI) / 180),
  z: 0,
  w: Math.cos(((deg / 2) * Math.PI) / 180),
});

/**
 * A facade authored the way a building element is: the element origin sits
 * where the building was placed, and the wall runs outward from it. `offset` is
 * where the slab's centre lands, so `offset - WIDTH / 2` is the near end of the
 * mass in model space.
 */
const facade = (id: string, offset: number): IAutoMovieModel => ({
  id,
  name: null,
  origin: "generated",
  parts: [
    {
      id: "wall",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: WIDTH, height: HEIGHT, depth: DEPTH },
      },
      material: null,
      attachedBone: null,
      transform: transform(offset, HEIGHT / 2, 0),
    },
  ],
  skeleton: null,
  body: null,
  materials: [],
  asset: null,
});

const camera = (): IAutoMovieCamera => ({
  id: "cam",
  transform: transform(0, 2, 200),
  fovY: FOV_Y,
  near: 0.1,
  far: 1000,
});

const action: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam",
  start: 0,
  duration: "auto",
  framing: "full",
  move: "static",
  on: { kind: "node", node: NODE },
};

/** The world box a node subject is framed and graded from, both sides alike. */
const worldBox = (model: IAutoMovieModel, placement: IAutoMovieTransform) =>
  nodeSubjectBox(
    placement,
    nodeSubjectExtent(computeModelRestExtent(model), null),
  );

/** Compile the one-entry move a `full` framing on this subject produces. */
const solve = (subject: {
  base: IAutoMovieVector3;
  height: number;
  radius?: number;
}): IAutoMovieClip =>
  compileCameraMove({
    clipId: "clip",
    camera: camera(),
    entries: [{ action, subject: { ...subject, at: null } }],
    shotDuration: 2,
    aspect: ASPECT,
  })!;

const contract = (): IAutoMovieShotContract => ({
  id: "shot-facade",
  beat: "beat",
  source: { module: "src/shots/facade.ts", export: "shot" },
  durationSeconds: 2,
  participants: [],
  opening: [],
  closing: [],
  camera: {
    intent: "hold the west facade",
    requiredSubjects: [NODE],
    maxOcclusionRatio: 1,
  },
  events: [],
  reviewFrames: [{ id: "mid", time: 1, passes: ["beauty"] }],
});

/** Grade the contract for one staged model under one solved camera. */
const grade = (
  model: IAutoMovieModel,
  placement: IAutoMovieTransform,
  cameraMotion: IAutoMovieClip,
): { readable: number[]; refused: boolean } => {
  const result = realizeShotContract({
    contract: contract(),
    production: null,
    frameFormat: { width: 1920, height: 1080 },
    world: null,
    formations: new Map<string, IAutoMovieFormationDesign>(),
    compiled: {
      eventSamples: [],
      scene: {
        id: "scene",
        name: null,
        nodes: [
          {
            id: NODE,
            model: model.id,
            transform: placement,
            pose: null,
            motion: null,
          },
        ],
        cameras: [camera()],
        lights: [],
      },
      motions: [],
      shot: {
        id: "shot-facade",
        name: null,
        scene: "scene",
        camera: "cam",
        duration: 2,
        performances: [],
        objectMotions: [],
        cameraMotion,
      },
      models: [model],
    },
    collisions: [],
  });
  return {
    readable: result.realization.camera.map((entry) => entry.readableSubjects),
    refused: result.diagnostics.length !== 0,
  };
};

/** Whether the delivered frame at t=0 holds a 10 cm probe at `point`. */
const framesPoint = (
  cameraMotion: IAutoMovieClip,
  point: IAutoMovieVector3,
): boolean =>
  intersectsPerspectiveFrustumBox({
    camera: resolveCameraAt(camera().transform, cameraMotion, "cam", 0),
    min: { x: point.x - 0.05, y: point.y - 0.05, z: point.z - 0.05 },
    max: { x: point.x + 0.05, y: point.y + 0.05, z: point.z + 0.05 },
    near: camera().near,
    far: camera().far,
    halfY: HALF_Y,
    aspect: ASPECT,
  });

/** How far the compiled move's first key stands from the framing's aim point. */
const solvedDistance = (
  cameraMotion: IAutoMovieClip,
  aim: IAutoMovieVector3,
): number => {
  const eye = resolveCameraAt(
    camera().transform,
    cameraMotion,
    "cam",
    0,
  ).position;
  return Math.hypot(eye.x - aim.x, eye.y - aim.y, eye.z - aim.z);
};

/**
 * The whole shot compiler resolving the same subject: a set piece staged at the
 * origin and framed `full` by the camera the fixture stages, so what reaches
 * {@link compileCameraMove} is `performShot`'s own reading rather than one the
 * test rebuilt beside it.
 */
const performFacade = (model: IAutoMovieModel): IAutoMovieClip | null => {
  const script = makeScriptWrite({
    cast: [
      { node: "west-facade", character: "the west facade", modelRef: model.id },
    ],
    beats: [
      {
        id: "beat-1",
        name: "the approach",
        summary: "the facade holds the frame",
        durationHint: 2,
      },
    ],
  });
  const staged = stageScene(
    script,
    makeStagingWrite({
      actors: [
        { node: "west-facade", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
      ],
      cameras: [
        {
          node: "cam",
          position: { x: 0, y: 2, z: 200 },
          lookAt: { kind: "node", node: "west-facade" },
          fovDeg: FOV_Y,
        },
      ],
    }),
  );
  if (staged.success !== true) throw new Error("staging fixture must succeed");
  const result = performShot({
    script,
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        {
          verb: "frame",
          actor: "cam",
          start: 0,
          duration: "auto",
          framing: "full",
          move: "static",
          on: { kind: "node", node: "west-facade" },
        },
      ],
      revise: { review: "the facade reads.", final: null },
      duration: 2,
    }),
    synthesize: validSynthesizer,
    // A set piece carries no rig, which is why its height had to be measured
    // from geometry in the first place.
    skeleton: () => null,
    models: [model],
    frameFormat: { width: 1920, height: 1080 },
  });
  return result.success === true ? result.shot.cameraMotion : null;
};

/**
 * A required node subject is framed and graded on the width its geometry
 * actually fills, at the place that geometry actually stands.
 *
 * A node subject used to carry a height and nothing else. `performShot` framed
 * it from that height and stated no `radius`, and `realizeShotContract` boxed it
 * with `pointSubjectBox`, so a 60 m facade authored outward from its element
 * origin was solved and checked as a pole: a graded box of `(0,0,0)…(0,24,0)`
 * against a drawn box of `x 0…60, y 0…24, z −1…1`, the pole standing 30.000 m
 * from the mass's own centre with 60 m of width and 2 m of depth dropped.
 *
 * Both sides now read one measured box, and they had to move together: widening
 * the grade alone would refuse shots no authored camera could satisfy, and
 * widening the solve alone would deliver a frame the check still graded against
 * a pole.
 *
 * The oracles are hand arithmetic rather than the engine's own output. The
 * drawn box is the slab's dimensions about its authored centre; `radius` is
 * half the horizontal diagonal, `hypot(60, 2) / 2 = 30.016662…`; a `full`
 * framing shows 1.15 subject extents, so the vertical fit stands at
 * `24 × 1.15 / 2 / tan(20°) = 37.915…` m and the horizontal fit at
 * `60.033… × 1.15 / 2 / (tan(20°) × 16/9) = 53.331…` m, and the solve takes the
 * further of the two.
 *
 * Scenarios:
 *
 * 1. The fixture draws where it claims: the model's rest box runs
 *    `x 0…60, y 0…24, z −1…1`, so every number below is about a 60 m width and
 *    a 2 m depth measured off a 24 m height.
 * 2. Restated for the framing grammar, that box has its base at the middle of
 *    the mass and a radius of half its horizontal diagonal — not a base at the
 *    element origin and a radius of zero.
 * 3. A yawed element is boxed where it stands: a 90° set piece placed at
 *    `(100, 0, 5)` fills `x 99…101, z −55…5`, which a vertical segment at a
 *    point could not express at all.
 * 4. The width decides the distance exactly where it demands the further stand.
 *    The measured solve stands at the horizontal fit, 53.331 m, against the
 *    37.915 m the height alone asked for, and it aims at the middle of the mass
 *    rather than at its corner.
 * 5. The delivered frame is the difference: the measured camera holds both ends
 *    of the facade, and the height-only camera does not hold the far one.
 * 6. Solve and grade agree. The facade reads at every contract sample under the
 *    camera the measured subject produced.
 * 7. The grade moved to where the geometry is rather than merely growing around
 *    the origin: a facade authored entirely away from its element origin is
 *    refused under the camera the height-only solve produced — that camera
 *    delivers a frame with none of the subject in it — and reads under the
 *    measured one.
 * 8. Boundaries. A node with nothing to measure keeps the horizontally
 *    degenerate stand-in segment it always had, and a slab too thin to measure
 *    vertically keeps its real width while taking the stand-in height.
 */
export const test_film_camera_node_subject_width = (): void => {
  const model = facade("facade-model", WIDTH / 2);
  const origin = transform(0, 0, 0);

  // 1. the fixture draws what it claims.
  TestValidator.equals(
    "the fixture draws a sixty metre facade two metres thick",
    computeModelRestExtent(model),
    {
      min: { x: 0, y: 0, z: -DEPTH / 2 },
      max: { x: WIDTH, y: HEIGHT, z: DEPTH / 2 },
    },
  );

  // 2. restated for the framing grammar.
  const measured = framedBoxOf(worldBox(model, origin));
  const RADIUS = Math.hypot(WIDTH, DEPTH) / 2;
  TestValidator.equals(
    "the framed box centres on the mass and carries its half diagonal",
    namedFacts([
      [
        "baseAtTheMiddleOfTheMass",
        () => vclose(measured.base, { x: WIDTH / 2, y: 0, z: 0 }),
      ],
      ["heightUnchanged", () => nclose(measured.height, HEIGHT)],
      [
        "radiusIsHalfTheHorizontalDiagonal",
        () => nclose(measured.radius, RADIUS),
      ],
      ["andTheOldReadWasThirtyMetresOff", () => nclose(measured.base.x, 30)],
    ]),
    {
      baseAtTheMiddleOfTheMass: true,
      heightUnchanged: true,
      radiusIsHalfTheHorizontalDiagonal: true,
      andTheOldReadWasThirtyMetresOff: true,
    },
  );

  // 3. a yawed element is boxed where it stands.
  TestValidator.equals(
    "a quarter-turned set piece fills the footprint its yaw gives it",
    ((): { min: IAutoMovieVector3; max: IAutoMovieVector3 } => {
      const box = worldBox(model, transform(100, 0, 5, yaw(90)));
      const round = (value: number): number => Math.round(value * 1e6) / 1e6;
      return {
        min: { x: round(box.min.x), y: round(box.min.y), z: round(box.min.z) },
        max: { x: round(box.max.x), y: round(box.max.y), z: round(box.max.z) },
      };
    })(),
    {
      min: { x: 100 - DEPTH / 2, y: 0, z: 5 - WIDTH },
      max: { x: 100 + DEPTH / 2, y: HEIGHT, z: 5 },
    },
  );

  // 4. the width decides the distance, and the aim moves to the mass.
  const measuredMove = solve(measured);
  const poleMove = solve({ base: { x: 0, y: 0, z: 0 }, height: HEIGHT });
  const AIM_FRACTION_FULL = 0.5;
  const measuredAim = {
    x: WIDTH / 2,
    y: HEIGHT * AIM_FRACTION_FULL,
    z: 0,
  };
  const poleAim = { x: 0, y: HEIGHT * AIM_FRACTION_FULL, z: 0 };
  const verticalFit = (HEIGHT * 1.15) / 2 / HALF_Y;
  const horizontalFit = (RADIUS * 2 * 1.15) / 2 / HALF_X;
  TestValidator.equals(
    "the measured solve stands at the horizontal fit and the pole at the vertical one",
    namedFacts([
      ["horizontalIsTheFurther", () => horizontalFit > verticalFit],
      [
        "measuredStandsAtTheHorizontalFit",
        () =>
          nclose(
            solvedDistance(measuredMove, measuredAim),
            horizontalFit,
            1e-6,
          ),
      ],
      [
        "poleStandsAtTheVerticalFit",
        () => nclose(solvedDistance(poleMove, poleAim), verticalFit, 1e-6),
      ],
    ]),
    {
      horizontalIsTheFurther: true,
      measuredStandsAtTheHorizontalFit: true,
      poleStandsAtTheVerticalFit: true,
    },
  );

  // 5. the delivered frame is the difference.
  const nearEnd = { x: 0.5, y: HEIGHT / 2, z: 0 };
  const farEnd = { x: WIDTH - 0.5, y: HEIGHT / 2, z: 0 };
  TestValidator.equals(
    "the measured camera holds both ends and the height-only camera loses the far one",
    namedFacts([
      ["measuredHoldsTheNearEnd", () => framesPoint(measuredMove, nearEnd)],
      ["measuredHoldsTheFarEnd", () => framesPoint(measuredMove, farEnd)],
      ["poleHoldsTheNearEnd", () => framesPoint(poleMove, nearEnd)],
      ["poleLosesTheFarEnd", () => framesPoint(poleMove, farEnd) === false],
    ]),
    {
      measuredHoldsTheNearEnd: true,
      measuredHoldsTheFarEnd: true,
      poleHoldsTheNearEnd: true,
      poleLosesTheFarEnd: true,
    },
  );

  // 6. solve and grade agree on the subject that was framed.
  const graded = grade(model, origin, measuredMove);
  TestValidator.equals(
    "the facade reads at every contract sample under the camera solved for it",
    namedFacts([
      ["readEverySample", () => graded.readable.every((count) => count === 1)],
      ["sampledThrice", () => graded.readable.length === 3],
      ["notRefused", () => graded.refused === false],
    ]),
    { readEverySample: true, sampledThrice: true, notRefused: true },
  );

  // 7. the grade follows the geometry rather than growing around the origin.
  const remote = facade("remote-facade-model", 100);
  const remoteMeasured = framedBoxOf(worldBox(remote, origin));
  const remotePole = grade(
    remote,
    origin,
    solve({ base: { x: 0, y: 0, z: 0 }, height: HEIGHT }),
  );
  const remoteSolved = grade(remote, origin, solve(remoteMeasured));
  TestValidator.equals(
    "a facade built away from its origin is refused where it is not, and reads where it is",
    namedFacts([
      ["drawnAwayFromTheOrigin", () => nclose(remoteMeasured.base.x, 100)],
      ["poleReadsAtNoSample", () => remotePole.readable.every((c) => c === 0)],
      ["poleIsRefused", () => remotePole.refused],
      [
        "measuredReadsEverySample",
        () => remoteSolved.readable.every((c) => c === 1),
      ],
      ["measuredIsNotRefused", () => remoteSolved.refused === false],
    ]),
    {
      drawnAwayFromTheOrigin: true,
      poleReadsAtNoSample: true,
      poleIsRefused: true,
      measuredReadsEverySample: true,
      measuredIsNotRefused: true,
    },
  );

  // 8. the shot compiler itself resolves the subject that way.
  const performed = performFacade(model);
  TestValidator.equals(
    "performShot frames a set piece from the box it draws",
    namedFacts([
      ["performs", () => performed !== null],
      [
        "standsAtTheHorizontalFit",
        () =>
          performed !== null &&
          nclose(solvedDistance(performed, measuredAim), horizontalFit, 1e-6),
      ],
      [
        "holdsTheFarEnd",
        () => performed !== null && framesPoint(performed, farEnd),
      ],
    ]),
    { performs: true, standsAtTheHorizontalFit: true, holdsTheFarEnd: true },
  );

  // 9. boundaries: nothing to measure, and nothing vertical to measure.
  TestValidator.equals(
    "a node with nothing to measure keeps the degenerate stand-in segment",
    nodeSubjectExtent(null, null),
    { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1.7, z: 0 } },
  );
  TestValidator.equals(
    "a rig span stands in for a height without inventing a width",
    nodeSubjectExtent(null, 1.9),
    { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1.9, z: 0 } },
  );
  TestValidator.equals(
    "a slab too thin to measure vertically keeps the width it draws",
    nodeSubjectExtent(
      {
        min: { x: 0, y: 4, z: -WIDTH / 2 },
        max: { x: WIDTH, y: 4.02, z: WIDTH / 2 },
      },
      null,
    ),
    {
      min: { x: 0, y: 4, z: -WIDTH / 2 },
      max: { x: WIDTH, y: 5.7, z: WIDTH / 2 },
    },
  );
};
