import {
  compileCameraMove,
  computeModelRestExtentY,
  realizeShotContract,
} from "@automovie/engine";
import type {
  IAutoMovieCamera,
  IAutoMovieCameraAction,
  IAutoMovieClip,
  IAutoMovieFormationDesign,
  IAutoMovieModel,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const NODE = "civic/entry-canopy";

/** The deck hangs 8 m above the element origin and is 4 m tall. */
const FLOOR = 8;
const HEIGHT = 4;
/** Keep this vertical-floor fixture outside every solved camera's near plane. */
const THICKNESS = 0.2;

const transform = (x: number, y: number, z: number) => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * A canopy authored the way a building element is: the element origin sits on
 * the ground where the building was placed, and the geometry it draws stands
 * 8 m up in the air. Nothing about the model is unusual — this is what a
 * lowered `<environment>/<element>` set piece looks like whenever the part is
 * not authored around its own origin.
 */
const canopy = (): IAutoMovieModel => ({
  id: "canopy-model",
  name: null,
  origin: "generated",
  parts: [
    {
      id: "deck",
      name: null,
      geometry: {
        type: "primitive",
        shape: {
          type: "box",
          width: 12,
          height: HEIGHT,
          depth: THICKNESS,
        },
      },
      material: null,
      attachedBone: null,
      transform: transform(0, FLOOR + HEIGHT / 2, 0),
    },
  ],
  skeleton: null,
  body: null,
  materials: [],
  asset: null,
});

const camera = (): IAutoMovieCamera => ({
  id: "cam",
  transform: transform(0, 2, 40),
  fovY: 40,
  near: 0.1,
  far: 500,
  depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
});

const action = (
  framing: IAutoMovieCameraAction["framing"],
): IAutoMovieCameraAction => ({
  verb: "frame",
  actor: "cam",
  start: 0,
  duration: "auto",
  framing,
  move: "static",
  on: { kind: "node", node: NODE },
});

/**
 * The camera `performShot` solves for a subject standing at `base`: its framed
 * base is the placement raised by the model's drawn floor, which is the whole
 * point of this fixture.
 */
const solve = (
  framing: IAutoMovieCameraAction["framing"],
  baseY: number,
): IAutoMovieClip | null =>
  compileCameraMove({
    clipId: "clip",
    camera: camera(),
    entries: [
      {
        action: action(framing),
        subject: { base: { x: 0, y: baseY, z: 0 }, height: HEIGHT, at: null },
      },
    ],
    shotDuration: 2,
    aspect: 16 / 9,
  });

const contract = (): IAutoMovieShotContract => ({
  id: "shot-canopy",
  beat: "beat",
  source: { module: "src/shots/canopy.ts", export: "shot" },
  durationSeconds: 2,
  participants: [],
  opening: [],
  closing: [],
  camera: {
    intent: "hold the entry canopy",
    requiredSubjects: [NODE],
    maxOcclusionRatio: 1,
  },
  events: [],
  reviewFrames: [{ id: "mid", time: 1, passes: ["beauty"] }],
});

/**
 * Grade the contract for one staged model under one solved camera, and report
 * what the compiler found at each of the three contract samples.
 */
const grade = (
  model: IAutoMovieModel | null,
  cameraMotion: IAutoMovieClip | null,
): {
  samples: number;
  resolved: number[];
  readable: number[];
  refused: boolean;
} => {
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
            // A node always names a model; `null` here is the staged node
            // whose model is not among the compiled ones, which is the path
            // that falls back to the stand-in span.
            model: model === null ? "unstaged-model" : model.id,
            transform: transform(0, 0, 0),
            pose: null,
            motion: null,
          },
        ],
        cameras: [camera()],
        lights: [],
      },
      motions: [],
      shot: {
        id: "shot-canopy",
        name: null,
        scene: "scene",
        camera: "cam",
        duration: 2,
        performances: [],
        objectMotions: [],
        cameraMotion,
      },
      models: model === null ? [] : [model],
    },
    collisions: [],
  });
  return {
    samples: result.realization.camera.length,
    resolved: result.realization.camera.map((entry) => entry.resolvedSubjects),
    readable: result.realization.camera.map((entry) => entry.readableSubjects),
    refused: result.diagnostics.length !== 0,
  };
};

/** Every contract sample found the one required subject readable. */
const allRead = (graded: ReturnType<typeof grade>): boolean =>
  graded.samples === 3 &&
  graded.resolved.every((count) => count === 1) &&
  graded.readable.every((count) => count === 1) &&
  graded.refused === false;

/**
 * A required node subject is graded on the segment its geometry actually fills,
 * not on one hanging off its node origin.
 *
 * The framing solve and the contract check are meant to read one subject.
 * `performShot` raises a node's framed base by the drawn floor of its model's
 * rest extent, because that extent is model-space and a building element's
 * origin is where the building was placed rather than where its geometry
 * starts. The check dropped that floor and measured a segment from the origin
 * upward, so a canopy authored 8 m up was framed at 8 m and graded at 0 m; the
 * disagreement was exactly the floor, 8.000 m on this fixture.
 *
 * That is not a stricter check but an unsatisfiable one. Aiming lower to catch
 * the graded segment carries the geometry out of frame, so no camera an author
 * could write passes, and the diagnostic names neither height. `wide` hides it,
 * showing four subject heights and so holding both the deck and the empty air
 * beneath it, which is why the defect survives the one shot size a first probe
 * tries.
 *
 * The oracle is the framing arithmetic rather than the engine's output: with
 * `FRAMING_HEIGHT_FRACTION` and `FRAMING_AIM_FRACTION`, a `full` shot shows
 * 1.15 subject heights centred on 0.5 h, so its visible band is 7.7 m … 12.3 m
 * around a deck at 8 … 12 m and an origin-based segment at 0 … 4 m is well
 * below its lower edge.
 *
 * Scenarios:
 *
 * 1. The fixture draws where it claims to: the model's rest extent runs 8 … 12,
 *    so every number below is about a floor of exactly 8 m.
 * 2. Every shot size grades the canopy readable at all three contract samples
 *    and raises no diagnostic. `full`, `medium` and `close` are the three that
 *    failed before the floor was carried; `wide` is the control that passed
 *    either way, so a green run at `wide` alone would be no evidence.
 * 3. The negative twin: the same subject under a camera solved as though the
 *    deck stood on the placement reads at no sample and is refused. Carrying
 *    the floor made the two sides agree; it did not make readability
 *    unconditional.
 * 4. A model drawn from its own origin upward has a zero floor, so its grade is
 *    exactly what it always was. The correction reaches only the subjects whose
 *    geometry never stood where it was being graded.
 * 5. A node with no model keeps the stand-in span measured from the placement
 *    itself: neither a rig span nor `DEFAULT_SUBJECT_HEIGHT` states a floor, so
 *    there is none to carry and a camera framed on the placement still reads.
 */
export const test_film_camera_node_subject_floor = (): void => {
  const framings = ["wide", "full", "medium", "close"] as const;
  const model = canopy();

  TestValidator.equals(
    "the fixture draws its deck eight metres above the node origin",
    computeModelRestExtentY(model),
    { min: FLOOR, max: FLOOR + HEIGHT },
  );

  TestValidator.equals(
    "every shot size grades the canopy readable at every sample",
    namedFacts(
      framings.map((framing) => [
        framing,
        () => allRead(grade(model, solve(framing, FLOOR))),
      ]),
    ),
    { wide: true, full: true, medium: true, close: true },
  );

  const misaimed = grade(model, solve("close", 0));
  TestValidator.equals(
    "a camera aimed at the placement still fails to read the raised deck",
    namedFacts([
      ["resolvedEverySample", () => misaimed.resolved.every((c) => c === 1)],
      ["readAtNoSample", () => misaimed.readable.every((c) => c === 0)],
      ["refused", () => misaimed.refused],
    ]),
    { resolvedEverySample: true, readAtNoSample: true, refused: true },
  );

  const grounded: IAutoMovieModel = {
    ...model,
    id: "grounded-model",
    parts: [{ ...model.parts[0]!, transform: transform(0, HEIGHT / 2, 0) }],
  };
  TestValidator.equals(
    "a model standing on its origin has a zero floor and an unchanged grade",
    namedFacts([
      ["zeroFloor", () => computeModelRestExtentY(grounded)?.min === 0],
      ["readable", () => allRead(grade(grounded, solve("close", 0)))],
    ]),
    { zeroFloor: true, readable: true },
  );

  TestValidator.equals(
    "a node with no model keeps the stand-in span at its placement",
    allRead(grade(null, solve("full", 0))),
    true,
  );
};
