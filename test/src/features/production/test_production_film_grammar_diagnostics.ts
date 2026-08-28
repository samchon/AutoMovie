import { lookRotation } from "@automovie/engine";
import {
  AutoMovieGrammarStyleIntent,
  IAutoMovieCameraIntent,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFilmTimeline,
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMovieShotContract,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { filmGrammarDiagnostics } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import {
  keyframe,
  makeMotion,
  makePose,
  makeProp,
  primitivePart,
} from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const FPS = 24;
const ASPECT = 16 / 9;
const SECONDS = 4;

const point = (x: number, y: number, z: number): IAutoMovieVector3 => ({
  x,
  y,
  z,
});

const placed = (translation: IAutoMovieVector3): IAutoMovieTransform => ({
  translation,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** A skeleton-less figure of a stated height, measurable through its geometry. */
const boxModel = (id: string, height: number): IAutoMovieModel => ({
  ...makeProp([
    primitivePart("body", { type: "box", width: 0.4, height, depth: 0.3 }),
  ]),
  id,
});

/** A model with nothing to measure, so the subject height has no source. */
const emptyModel = (id: string): IAutoMovieModel => ({
  ...makeProp([]),
  id,
});

/** A clip walking its performer four metres along positive X over the shot. */
const walk = (): IAutoMovieMotion =>
  makeMotion(
    [
      keyframe(0, makePose([], placed(point(0, 0, 0)))),
      keyframe(SECONDS, makePose([], placed(point(4, 0, 0)))),
    ],
    SECONDS,
  );

interface ISubject {
  id: string;
  position: IAutoMovieVector3;
  model?: string;
  motion?: string;
}

const compiledShot = (props: {
  id: string;
  camera: IAutoMovieVector3;
  subjects: readonly ISubject[];
  liveCamera?: string;
  models?: IAutoMovieModel[];
  motions?: IAutoMovieMotion[];
  cameraIntent?: IAutoMovieCameraIntent[];
}): IAutoMovieCompiledShotSource => ({
  eventSamples: [],
  scene: {
    id: "stage",
    name: null,
    nodes: props.subjects.map((subject) => ({
      id: subject.id,
      model: subject.model ?? "figure",
      transform: placed(subject.position),
      motion: null,
      pose: null,
    })),
    cameras: [
      {
        id: "lens",
        transform: {
          translation: props.camera,
          rotation: lookRotation({
            x: -props.camera.x,
            y: 0.9 - props.camera.y,
            z: -props.camera.z,
          }),
          scale: { x: 1, y: 1, z: 1 },
        },
        fovY: 50,
        near: 0.1,
        far: 200,
        depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
      },
    ],
    lights: [],
  },
  motions: props.motions ?? [],
  shot: {
    id: props.id,
    name: null,
    scene: "stage",
    camera: props.liveCamera ?? "lens",
    cameraMotion: null,
    performances: props.subjects.flatMap((subject) =>
      subject.motion === undefined
        ? []
        : [{ node: subject.id, motion: subject.motion, startOffset: 0 }],
    ),
    objectMotions: [],
    events: [],
    cameraIntent: props.cameraIntent ?? [],
    coverage: [],
    duration: SECONDS,
  },
  models: props.models ?? [boxModel("figure", 1.8)],
  formations: [],
  instanceSets: [],
  formationMotions: [],
  formationSlotMotions: [],
  effects: [],
});

const shotContract = (props: {
  id: string;
  requiredSubjects: string[];
  styleIntent?: AutoMovieGrammarStyleIntent[];
}): IAutoMovieShotContract => ({
  id: props.id,
  beat: `beat-${props.id}`,
  source: { module: `src/shots/${props.id}.ts`, export: props.id },
  durationSeconds: SECONDS,
  ...(props.styleIntent === undefined
    ? {}
    : { styleIntent: props.styleIntent }),
  participants: [],
  opening: [],
  closing: [],
  camera: {
    intent: "hold the marked pair readable across the cut",
    requiredSubjects: props.requiredSubjects,
    maxOcclusionRatio: 0.2,
  },
  events: [],
  reviewFrames: [{ id: `${props.id}-entry`, time: 0, passes: ["beauty"] }],
});

const segmentOf = (
  shot: string,
  index: number,
): IAutoMovieFilmTimeline["segments"][number] => ({
  shot,
  sourceInFrame: 0,
  sourceOutFrame: SECONDS * FPS,
  startFrame: index * SECONDS * FPS,
  endFrame: (index + 1) * SECONDS * FPS,
  headHandleFrames: 0,
  tailHandleFrames: 0,
  transitionIn: { kind: "cut" },
  transitionOut: { kind: "cut" },
});

interface IPlacement {
  contract: IAutoMovieShotContract;
  compiled: IAutoMovieCompiledShotSource;
}

const readEdit = (placements: readonly IPlacement[]): IAutoMovieDiagnostic[] =>
  filmGrammarDiagnostics({
    segments: placements.map((placement, index) =>
      segmentOf(placement.contract.id, index),
    ),
    fps: FPS,
    aspect: ASPECT,
    contracts: new Map(
      placements.map((placement) => [
        placement.contract.id,
        placement.contract,
      ]),
    ),
    compiled: new Map(
      placements.map((placement) => [
        placement.contract.id,
        placement.compiled,
      ]),
    ),
  });

const codes = (diagnostics: readonly IAutoMovieDiagnostic[]): string[] =>
  diagnostics.map((diagnostic) => diagnostic.code);

/** Two marks defining one line of action, static on either side of it. */
const PAIR: readonly ISubject[] = [
  { id: "alpha", position: { x: -1, y: 0, z: 0 } },
  { id: "bravo", position: { x: 1, y: 0, z: 0 } },
];

/**
 * The film compile reads the assembled edit and files what it finds.
 *
 * The analyzer measured all of this before and nobody asked it, so a declared
 * `styleIntent` suppressed nothing and an undeclared break was never named.
 * These cases pin the wire-up at the point the compiler calls it: observations
 * built from compiled shot output at the edited boundaries, findings routed as
 * ordinary warnings, and a declaration reported when it excepts nothing.
 *
 * Scenarios:
 *
 * 1. Cutting across the line of action is reported, naming both shots, and
 *    declaring the matching exception silences exactly that finding.
 * 2. An exception declared over an edit that never breaks the rule is itself
 *    reported, while an edit with neither break nor declaration says nothing.
 * 3. Boundaries are read from the compiled performance: the same two cameras stop
 *    crossing once the subject walks past its partner on screen.
 * 4. A framing claim covering the whole placement is measured against the compiled
 *    camera; a placement spanning two claims is measured against neither.
 * 5. Placements with no contract, no compiled output or no staged camera are
 *    skipped, and subjects with no node, no model or no measurable geometry
 *    still observe.
 */
export const test_production_film_grammar_diagnostics = (): void => {
  const crossing = (
    styleIntent?: AutoMovieGrammarStyleIntent[],
  ): IAutoMovieDiagnostic[] =>
    readEdit([
      {
        contract: shotContract({
          id: "first",
          requiredSubjects: ["alpha", "bravo"],
        }),
        compiled: compiledShot({
          id: "first",
          camera: point(0, 1, 5),
          subjects: PAIR,
        }),
      },
      {
        contract: shotContract({
          id: "second",
          requiredSubjects: ["alpha", "bravo"],
          styleIntent,
        }),
        compiled: compiledShot({
          id: "second",
          camera: point(0, 1, -5),
          subjects: PAIR,
        }),
      },
    ]);
  const undeclared = crossing();
  TestValidator.equals(
    "an undeclared axis crossing is reported naming both shots",
    namedFacts([
      ["one finding", () => undeclared.length === 1],
      ["axis family", () => undeclared[0]!.code === "grammar-axis-crossed"],
      [
        "advises rather than refuses",
        () => undeclared[0]!.category === "warning",
      ],
      ["compile phase", () => undeclared[0]!.phase === "compile"],
      [
        "filed on the incoming shot",
        () => undeclared[0]!.target === "shot:second",
      ],
      [
        "owned by its source",
        () => undeclared[0]!.path === "src/shots/second.ts",
      ],
      [
        "names the outgoing shot",
        () => undeclared[0]!.message.includes(`"first"`),
      ],
      [
        "names the incoming shot",
        () => undeclared[0]!.message.includes(`"second"`),
      ],
    ]),
    {
      "one finding": true,
      "axis family": true,
      "advises rather than refuses": true,
      "compile phase": true,
      "filed on the incoming shot": true,
      "owned by its source": true,
      "names the outgoing shot": true,
      "names the incoming shot": true,
    },
  );
  TestValidator.equals(
    "the matching declared exception suppresses that crossing",
    crossing(["axis-cross"]),
    [],
  );

  const level = (
    styleIntent?: AutoMovieGrammarStyleIntent[],
  ): IAutoMovieDiagnostic[] =>
    readEdit([
      {
        contract: shotContract({
          id: "first",
          requiredSubjects: ["alpha", "bravo"],
        }),
        compiled: compiledShot({
          id: "first",
          camera: point(0, 1, 5),
          subjects: PAIR,
        }),
      },
      {
        contract: shotContract({
          id: "second",
          requiredSubjects: ["alpha", "bravo"],
          styleIntent,
        }),
        compiled: compiledShot({
          id: "second",
          camera: point(5, 1, 3),
          subjects: PAIR,
        }),
      },
    ]);
  TestValidator.equals(
    "an edit with neither break nor declaration is unchanged",
    level(),
    [],
  );
  const unexercised = level(["axis-cross"]);
  TestValidator.equals(
    "an exception that excepts nothing is reported against its shot",
    namedFacts([
      ["one finding", () => unexercised.length === 1],
      [
        "unmatched family",
        () => unexercised[0]!.code === "grammar-style-intent-unmatched",
      ],
      [
        "filed on the declaring shot",
        () => unexercised[0]!.target === "shot:second",
      ],
      [
        "names the declaration",
        () => unexercised[0]!.message.includes(`"axis-cross"`),
      ],
      [
        "names the finding it would have excepted",
        () => unexercised[0]!.message.includes("grammar-axis-crossed"),
      ],
    ]),
    {
      "one finding": true,
      "unmatched family": true,
      "filed on the declaring shot": true,
      "names the declaration": true,
      "names the finding it would have excepted": true,
    },
  );

  TestValidator.equals(
    "a subject walking past its partner crosses the line on screen",
    readEdit([
      {
        contract: shotContract({
          id: "first",
          requiredSubjects: ["alpha", "bravo"],
        }),
        compiled: compiledShot({
          id: "first",
          camera: point(0, 1, 5),
          subjects: [{ ...PAIR[0]!, motion: "motion-1" }, PAIR[1]!],
          motions: [walk()],
        }),
      },
      {
        contract: shotContract({
          id: "second",
          requiredSubjects: ["alpha", "bravo"],
        }),
        compiled: compiledShot({
          id: "second",
          camera: point(0, 1, -5),
          subjects: PAIR,
        }),
      },
    ]),
    [],
  );

  const framed = (
    cameraIntent: IAutoMovieCameraIntent[],
  ): IAutoMovieDiagnostic[] =>
    readEdit([
      {
        contract: shotContract({ id: "only", requiredSubjects: ["alpha"] }),
        compiled: compiledShot({
          id: "only",
          camera: point(0, 1, 5),
          subjects: [PAIR[0]!],
          cameraIntent,
        }),
      },
    ]);
  const intent = (
    start: number,
    framing: IAutoMovieCameraIntent["framing"],
  ): IAutoMovieCameraIntent => ({
    start,
    framing,
    move: "static",
    focus: null,
    focalLength: null,
  });
  TestValidator.equals(
    "a framing claim the compiled camera does not deliver is reported",
    codes(framed([intent(0, "close")])),
    ["grammar-shot-size"],
  );
  TestValidator.equals(
    "a placement spanning two framing claims measures against neither",
    framed([intent(2, "close"), intent(0, "wide")]),
    [],
  );

  TestValidator.equals(
    "a placement nothing can be observed from is skipped",
    filmGrammarDiagnostics({
      segments: [
        segmentOf("unregistered", 0),
        segmentOf("uncompiled", 1),
        segmentOf("blind", 2),
      ],
      fps: FPS,
      aspect: ASPECT,
      contracts: new Map([
        [
          "uncompiled",
          shotContract({ id: "uncompiled", requiredSubjects: ["alpha"] }),
        ],
        ["blind", shotContract({ id: "blind", requiredSubjects: ["alpha"] })],
      ]),
      compiled: new Map([
        [
          "blind",
          compiledShot({
            id: "blind",
            camera: point(0, 1, 5),
            subjects: [PAIR[0]!],
            liveCamera: "struck",
          }),
        ],
      ]),
    }),
    [],
  );

  TestValidator.equals(
    "unstaged, model-less and unmeasurable subjects still observe",
    readEdit([
      {
        contract: shotContract({
          id: "only",
          requiredSubjects: ["alpha", "bravo", "thin", "hollow", "absent"],
        }),
        compiled: compiledShot({
          id: "only",
          camera: point(0, 1, 5),
          subjects: [
            PAIR[0]!,
            { ...PAIR[1]!, model: "unbuilt" },
            { id: "thin", position: point(-3, 0, 0), model: "thin" },
            { id: "hollow", position: point(3, 0, 0), model: "hollow" },
          ],
          models: [
            boxModel("figure", 1.8),
            boxModel("thin", 0.05),
            emptyModel("hollow"),
          ],
        }),
      },
    ]),
    [],
  );
};
