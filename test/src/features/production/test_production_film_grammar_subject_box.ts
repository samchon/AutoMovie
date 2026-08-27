import {
  DEFAULT_SUBJECT_HEIGHT,
  FRAMING_AIM_FRACTION,
  FRAMING_HEIGHT_FRACTION,
  classifyGrammarShotSize,
  computeModelRestExtent,
  framedBoxOf,
  lookRotation,
  nodeSubjectBox,
  nodeSubjectExtent,
  projectToNdc,
} from "@automovie/engine";
import type {
  IAutoMovieCameraIntent,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFilmTimeline,
  IAutoMovieModel,
  IAutoMovieQuaternion,
  IAutoMovieShotContract,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { filmGrammarDiagnostics } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const FPS = 24;
const SECONDS = 4;
const ASPECT = 16 / 9;
const FOV_Y = 40;
const HALF_Y = Math.tan(((FOV_Y / 2) * Math.PI) / 180);
const HALF_X = HALF_Y * ASPECT;

const point = (x: number, y: number, z: number): IAutoMovieVector3 => ({
  x,
  y,
  z,
});

const placed = (
  translation: IAutoMovieVector3,
  rotation: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 },
): IAutoMovieTransform => ({
  translation,
  rotation,
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * A set piece authored the way a building element is: the element origin is
 * where the building was placed, and the mass runs outward and upward from it.
 * `offset` is where the slab's centre lands in model space.
 */
const element = (
  id: string,
  size: { width: number; height: number; depth: number },
  offset: IAutoMovieVector3,
): IAutoMovieModel => ({
  ...makeProp([
    primitivePart("mass", { type: "box", ...size }, placed(offset)),
  ]),
  id,
});

/** A 60 m facade running outward from its element origin, 24 m tall, 2 m thick. */
const FACADE = element(
  "facade",
  { width: 60, height: 24, depth: 2 },
  point(30, 12, 0),
);

/** A rig span far enough from the stand-in height to classify differently. */
const RIG_SPAN = 6;

/**
 * A two-joint mast: nothing to draw, so the rig span is what stands in for the
 * subject's height, and it states no width any more than it states a floor.
 */
const MAST: IAutoMovieSkeleton = {
  id: "mast",
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: placed(point(0, 0, 0)),
      constraint: null,
    },
    {
      bone: "head",
      parent: "hips",
      rest: placed(point(0, RIG_SPAN, 0)),
      constraint: null,
    },
  ],
};

/** A canopy whose 4 m deck hangs 8 m above its element origin. */
const CANOPY = element(
  "canopy",
  { width: 12, height: 4, depth: 6 },
  point(0, 10, 0),
);

/**
 * The camera `performShot` solves for this subject at this framing: the
 * greater of the height-derived and the width-derived distance, on the staged
 * +Z bearing, aimed at the framing's own fraction of the subject's height.
 * Hand arithmetic rather than a call, so the fixture states the geometry it
 * expects the reader to check.
 */
const solvedCamera = (
  framed: ReturnType<typeof framedBoxOf>,
  framing: IAutoMovieCameraIntent["framing"],
): IAutoMovieTransform => {
  const fraction = FRAMING_HEIGHT_FRACTION[framing];
  const distance = Math.max(
    (framed.height * fraction) / 2 / HALF_Y,
    (framed.radius * 2 * fraction) / 2 / HALF_X,
  );
  const aim = {
    ...framed.base,
    y: framed.base.y + framed.height * FRAMING_AIM_FRACTION[framing],
  };
  const position = { ...aim, z: aim.z + distance };
  return placed(
    position,
    lookRotation({
      x: aim.x - position.x,
      y: aim.y - position.y,
      z: aim.z - position.z,
    }),
  );
};

/** The world box the framing solve and the contract grade both read. */
const framedBoxAt = (
  model: IAutoMovieModel,
  placement: IAutoMovieTransform,
): ReturnType<typeof framedBoxOf> =>
  framedBoxOf(
    nodeSubjectBox(
      placement,
      nodeSubjectExtent(computeModelRestExtent(model), null),
    ),
  );

/** One shot holding one staged set piece, framed by the camera solved for it. */
const readEdit = (props: {
  model: IAutoMovieModel;
  placement: IAutoMovieTransform;
  framing: IAutoMovieCameraIntent["framing"];
  /** What the camera was solved for, when that is not what the shot declares. */
  solveFor?: IAutoMovieCameraIntent["framing"];
  /** The box the camera was solved for, when the model does not state it. */
  solveBox?: ReturnType<typeof framedBoxOf>;
}): IAutoMovieDiagnostic[] => {
  const contract: IAutoMovieShotContract = {
    id: "elevation",
    beat: "beat-elevation",
    source: { module: "src/shots/elevation.ts", export: "elevation" },
    durationSeconds: SECONDS,
    participants: [],
    opening: [],
    closing: [],
    camera: {
      intent: "hold the whole elevation",
      requiredSubjects: ["civic/element"],
      maxOcclusionRatio: 0.2,
    },
    events: [],
    reviewFrames: [{ id: "elevation-entry", time: 0, passes: ["beauty"] }],
  };
  const compiled: IAutoMovieCompiledShotSource = {
    eventSamples: [],
    scene: {
      id: "stage",
      name: null,
      nodes: [
        {
          id: "civic/element",
          model: props.model.id,
          transform: props.placement,
          motion: null,
          pose: null,
        },
      ],
      cameras: [
        {
          id: "lens",
          transform: solvedCamera(
            props.solveBox ?? framedBoxAt(props.model, props.placement),
            props.solveFor ?? props.framing,
          ),
          fovY: FOV_Y,
          near: 0.1,
          far: 2000,
        },
      ],
      lights: [],
    },
    motions: [],
    shot: {
      id: contract.id,
      name: null,
      scene: "stage",
      camera: "lens",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      events: [],
      cameraIntent: [
        {
          start: 0,
          framing: props.framing,
          move: "static",
          focus: null,
          focalLength: null,
        },
      ],
      coverage: [],
      duration: SECONDS,
    },
    models: [props.model],
    formations: [],
    instanceSets: [],
    formationMotions: [],
    formationSlotMotions: [],
    effects: [],
  };
  const segment: IAutoMovieFilmTimeline["segments"][number] = {
    shot: contract.id,
    sourceInFrame: 0,
    sourceOutFrame: SECONDS * FPS,
    startFrame: 0,
    endFrame: SECONDS * FPS,
    headHandleFrames: 0,
    tailHandleFrames: 0,
    transitionIn: { kind: "cut" },
    transitionOut: { kind: "cut" },
  };
  return filmGrammarDiagnostics({
    segments: [segment],
    fps: FPS,
    aspect: ASPECT,
    contracts: new Map([[contract.id, contract]]),
    compiled: new Map([[contract.id, compiled]]),
  });
};

/**
 * What the edit read reported before it shared the subject definition: the
 * node's root translation carrying the model's vertical span, projected for
 * vertical frame occupancy alone.
 */
const rootAndHeightSize = (props: {
  model: IAutoMovieModel;
  placement: IAutoMovieTransform;
  framing: IAutoMovieCameraIntent["framing"];
}): IAutoMovieCameraIntent["framing"] | null => {
  const framed = framedBoxAt(props.model, props.placement);
  const camera = solvedCamera(framed, props.framing);
  const resolved = { position: camera.translation, rotation: camera.rotation };
  const drawn = computeModelRestExtent(props.model)!;
  const root = props.placement.translation;
  const base = projectToNdc(resolved, root, HALF_Y, ASPECT);
  const top = projectToNdc(
    resolved,
    { ...root, y: root.y + (drawn.max.y - drawn.min.y) },
    HALF_Y,
    ASPECT,
  );
  if (base.depth <= 1e-6 || top.depth <= 1e-6) return null;
  return classifyGrammarShotSize(Math.abs(top.ndcY - base.ndcY) / 2);
};

/**
 * The edit reads a staged set piece from the same box the camera was solved
 * from, so a building element is reported at the size it was framed at.
 *
 * `filmGrammarDiagnostics` was the third and last independent measurement of a
 * subject: it stood the subject at the node's root translation and gave it the
 * model's vertical span and no width, while `performShot` framed and
 * `realizeShotContract` graded the drawn box carried through the same
 * placement. On the fixtures below the two disagreed by 30.000 m of horizontal
 * centre and a 30.017 m half-diagonal the read did not have at all (the
 * facade), and by 8.000 m of floor with a 6.708 m half-diagonal (the canopy
 * deck), which is how an author came to be told to move a camera the engine had
 * already solved.
 *
 * Scenarios:
 *
 * 1. A 60 m facade authored outward from its element origin, declared
 *    `medium`, framed by the camera the solve produces for it. The 60 m width
 *    is what places that camera, so nothing is wrong with the shot and no
 *    finding is filed.
 * 2. The same shot measured the way it was measured before: a mass 60 m wide
 *    and 24 m tall fills only 0.873 of the frame's height at a distance solved
 *    for its width, so the vertical read alone classified `full` and a
 *    `grammar-shot-size` warning told the author to move a camera that already
 *    delivered `medium`.
 * 3. A canopy whose 4 m deck hangs 8 m above its element origin, declared
 *    `medium`: the converged read files nothing.
 * 4. The same canopy measured at its origin classifies `full`, the second
 *    shape of the same divergence, with the floor as well as the width.
 * 5. A node whose model draws nothing keeps the point it always was: its rig
 *    span stands in for the height, its horizontal extent stays 0, and a
 *    `full` camera solved for that 6.000 m span is read as `full`, while the
 *    camera a 1.700 m stand-in would have produced is reported.
 * 6. A framing the solved camera genuinely does not deliver is still reported:
 *    the facade camera solved for `medium` under a declared `close` intent
 *    keeps the finding, so the convergence did not silence the check.
 */
export const test_production_film_grammar_subject_box = (): void => {
  const facade = {
    model: FACADE,
    placement: placed(point(0, 0, 0)),
    framing: "medium",
  } as const;
  TestValidator.equals(
    "a facade framed by its own solve files no shot-size finding",
    readEdit(facade),
    [],
  );
  TestValidator.equals(
    "the root-and-height read of that shot misclassifies it",
    rootAndHeightSize(facade),
    "full",
  );

  const canopy = {
    model: CANOPY,
    placement: placed(point(0, 0, 0)),
    framing: "medium",
  } as const;
  TestValidator.equals(
    "a deck authored 8 m up is read where it draws",
    readEdit(canopy),
    [],
  );
  TestValidator.equals(
    "the root-and-height read of the deck misclassifies it",
    rootAndHeightSize(canopy),
    "full",
  );

  const rigged = {
    model: { ...makeProp([], null), id: "rigged", skeleton: MAST },
    placement: placed(point(0, 0, 0)),
    framing: "full",
  } as const;
  TestValidator.equals(
    "a subject with nothing to draw is framed and read on its rig span",
    readEdit({
      ...rigged,
      solveBox: { base: point(0, 0, 0), height: RIG_SPAN, radius: 0 },
    }),
    [],
  );
  TestValidator.equals(
    "the same subject read at the stand-in height would not be full",
    readEdit({
      ...rigged,
      solveBox: {
        base: point(0, 0, 0),
        height: DEFAULT_SUBJECT_HEIGHT,
        radius: 0,
      },
    }).map((diagnostic) => diagnostic.code),
    ["grammar-shot-size"],
  );

  const mismatched = readEdit({
    ...facade,
    framing: "close",
    solveFor: "medium",
  });
  TestValidator.equals(
    "a framing the solved camera does not deliver is still reported",
    namedFacts([
      ["one finding", () => mismatched.length === 1],
      ["shot-size family", () => mismatched[0]!.code === "grammar-shot-size"],
      ["filed on its shot", () => mismatched[0]!.target === "shot:elevation"],
      [
        "names the size the camera delivers",
        () => mismatched[0]!.message.includes("medium -> medium"),
      ],
    ]),
    {
      "one finding": true,
      "shot-size family": true,
      "filed on its shot": true,
      "names the size the camera delivers": true,
    },
  );
};
