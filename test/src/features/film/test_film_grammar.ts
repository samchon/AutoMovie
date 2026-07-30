import {
  IAutoMovieGrammarShotObservation,
  analyzeFilmGrammar,
  classifyGrammarShotSize,
  grammarDiagnosticsToReviewNotes,
  lookRotation,
} from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const point = (x: number, y: number, z: number): IAutoMovieVector3 => ({
  x,
  y,
  z,
});

const cameraSample = (
  position: IAutoMovieVector3,
  focus: IAutoMovieVector3 = point(0, 0.9, 0),
): IAutoMovieGrammarShotObservation["camera"]["start"] => ({
  position,
  rotation: lookRotation({
    x: focus.x - position.x,
    y: focus.y - position.y,
    z: focus.z - position.z,
  }),
  fovY: 60,
  aspect: 16 / 9,
});

const camera = (
  position: IAutoMovieVector3,
  focus: IAutoMovieVector3 = point(0, 0.9, 0),
): IAutoMovieGrammarShotObservation["camera"] => {
  const sample = cameraSample(position, focus);
  return { start: sample, end: sample };
};

const subject = (
  id: string,
  start: IAutoMovieVector3,
  end: IAutoMovieVector3 = start,
  eyeline?: { target: string; point: IAutoMovieVector3 },
): IAutoMovieGrammarShotObservation["subjects"][number] => ({
  id,
  start,
  end,
  height: 1.8,
  eyeline:
    eyeline === undefined
      ? null
      : {
          target: eyeline.target,
          start: eyeline.point,
          end: eyeline.point,
        },
});

const shot = (
  id: string,
  overrides: Partial<IAutoMovieGrammarShotObservation> = {},
): IAutoMovieGrammarShotObservation => ({
  id,
  duration: 2,
  camera: camera(point(0, 0.9, 3)),
  subjects: [subject("hero", point(0, 0, 0))],
  primarySubject: "hero",
  declaredShotSize: null,
  actionAxis: null,
  ...overrides,
});

const codes = (shots: readonly IAutoMovieGrammarShotObservation[]): string[] =>
  analyzeFilmGrammar({ shots }).map((diagnostic) => diagnostic.code);

/**
 * Mechanical film grammar stays deterministic and keeps style suppression
 * one-to-one.
 *
 * Scenarios:
 *
 * 1. A hidden camera crossing fires, while a neutral intermediary removes it.
 * 2. End-to-start axis boundaries and visible in-shot crossings remain legal.
 * 3. Reversing subject collection order cannot alter diagnostics.
 * 4. Moving cameras contribute to screen direction and three-dimensional cut angle
 *    measurements use each subject's own boundary position.
 * 5. Each B-group style marker suppresses only its mapped diagnostic.
 * 6. Primary-switch, continuation, vertical, and off-screen gaze geometry
 *    distinguish matched from broken eyelines.
 * 7. Measured shot size, displacement, entrant re-establishment, and pacing
 *    diagnostics expose fact, impact, and recovery through review notes.
 * 8. Empty, valid-boundary, and malformed observation inputs exercise every public
 *    validation family without relying on runtime schema coercion.
 */
export const test_film_grammar = (): void => {
  const rejects = (
    name: string,
    mutate: (input: IAutoMovieGrammarShotObservation) => void,
  ): void => {
    TestValidator.error(name, () => {
      const input = structuredClone(shot(`invalid-${name}`));
      mutate(input);
      analyzeFilmGrammar({ shots: [input] });
    });
  };
  TestValidator.equals(
    "empty edit has no pacing or grammar diagnostic",
    analyzeFilmGrammar({ shots: [] }),
    [],
  );
  const axisSubjects = [
    subject("alpha", point(-1, 0, 0)),
    subject("bravo", point(1, 0, 0)),
  ];
  const positive = shot("positive", {
    camera: camera(point(0, 1, 5)),
    subjects: axisSubjects,
    primarySubject: null,
    actionAxis: ["alpha", "bravo"],
  });
  const negative = shot("negative", {
    camera: camera(point(0, 1, -5)),
    subjects: [...axisSubjects].reverse(),
    primarySubject: null,
    actionAxis: ["bravo", "alpha"],
  });
  TestValidator.predicate(
    "hidden action-axis crossing is diagnosed",
    codes([positive, negative]).includes("grammar-axis-crossed"),
  );
  const neutral = shot("neutral", {
    camera: camera(point(0, 5, 0)),
    subjects: axisSubjects,
    primarySubject: null,
    actionAxis: ["alpha", "bravo"],
  });
  TestValidator.predicate(
    "neutral intermediary removes the axis crossing",
    codes([positive, neutral, negative]).includes("grammar-axis-crossed") ===
      false,
  );
  const rotatingAxis = shot("rotating-axis", {
    camera: camera(point(5, 1, 5)),
    subjects: [
      subject("alpha", point(-1, 0, 0), point(0, 0, -1)),
      subject("bravo", point(1, 0, 0), point(0, 0, 1)),
    ],
    primarySubject: null,
    actionAxis: ["alpha", "bravo"],
  });
  const afterRotation = shot("after-rotation", {
    camera: camera(point(5, 1, 5)),
    subjects: [
      subject("alpha", point(0, 0, -1)),
      subject("bravo", point(0, 0, 1)),
    ],
    primarySubject: null,
    actionAxis: ["alpha", "bravo"],
  });
  TestValidator.predicate(
    "outgoing end axis and incoming start axis define the cut boundary",
    codes([rotatingAxis, afterRotation]).includes("grammar-axis-crossed") ===
      false,
  );
  const visibleCrossing = shot("visible-crossing", {
    camera: {
      start: cameraSample(point(0, 1, 5)),
      end: cameraSample(point(0, 1, -5)),
    },
    subjects: axisSubjects,
    primarySubject: null,
    actionAxis: ["alpha", "bravo"],
  });
  TestValidator.predicate(
    "camera crossing the action axis inside a shot legalizes the next cut",
    codes([visibleCrossing, positive]).includes("grammar-axis-crossed") ===
      false,
  );
  TestValidator.predicate(
    "same action-axis half-plane stays continuous",
    codes([positive, { ...positive, id: "positive-again" }]).includes(
      "grammar-axis-crossed",
    ) === false,
  );
  const incomingCrossing = {
    ...visibleCrossing,
    id: "incoming-visible-crossing",
    camera: {
      start: cameraSample(point(0, 1, -5)),
      end: cameraSample(point(0, 1, 5)),
    },
  };
  TestValidator.predicate(
    "incoming on-screen camera crossing legalizes its boundary",
    codes([positive, incomingCrossing]).includes("grammar-axis-crossed") ===
      false,
  );
  TestValidator.predicate(
    "different action axes do not fabricate a crossing",
    codes([
      {
        ...positive,
        id: "axis-alpha-bravo",
        subjects: [...axisSubjects, subject("charlie", point(0, 0, 1))],
      },
      {
        ...negative,
        id: "axis-alpha-charlie",
        subjects: [...axisSubjects, subject("charlie", point(0, 0, 1))],
        actionAxis: ["alpha", "charlie"],
      },
    ]).includes("grammar-axis-crossed") === false,
  );
  TestValidator.equals(
    "subject and action-axis collection spelling normalize deterministically",
    analyzeFilmGrammar({ shots: [positive, negative] }),
    analyzeFilmGrammar({
      shots: [
        { ...positive, subjects: [...positive.subjects].reverse() },
        {
          ...negative,
          subjects: [...negative.subjects].reverse(),
          actionAxis: ["alpha", "bravo"],
        },
      ],
    }),
  );

  const movingRight = shot("moving-right", {
    subjects: [subject("hero", point(-0.5, 0, 0), point(0.5, 0, 0))],
  });
  const movingLeft = shot("moving-left", {
    camera: camera(point(0.2, 0.9, 3)),
    subjects: [subject("hero", point(0.5, 0, 0), point(-0.5, 0, 0))],
  });
  const unsuppressed = codes([movingRight, movingLeft]);
  TestValidator.predicate(
    "same-size shallow cut and screen reversal both report",
    unsuppressed.includes("grammar-jump-cut") &&
      unsuppressed.includes("grammar-screen-direction"),
  );
  const suppressed = codes([
    movingRight,
    { ...movingLeft, styleIntent: ["jump-cut"] },
  ]);
  TestValidator.predicate(
    "jump-cut style intent suppresses only its exact warning",
    suppressed.includes("grammar-jump-cut") === false &&
      suppressed.includes("grammar-screen-direction"),
  );
  const followedRight = shot("followed-right", {
    camera: {
      start: cameraSample(point(0, 0.9, 3)),
      end: cameraSample(point(1, 0.9, 3), point(1, 0.9, 0)),
    },
    subjects: [subject("hero", point(0, 0, 0), point(1, 0, 0))],
  });
  TestValidator.predicate(
    "following camera keeps matching world motion screen-neutral",
    codes([movingRight, followedRight]).includes("grammar-screen-direction") ===
      false,
  );
  const truckLeft = shot("truck-left", {
    camera: {
      start: cameraSample(point(-1, 0.9, 3), point(-1, 0.9, 0)),
      end: cameraSample(point(1, 0.9, 3), point(1, 0.9, 0)),
    },
    subjects: [subject("hero", point(0, 0, 0))],
  });
  TestValidator.predicate(
    "moving camera contributes to screen-direction measurement",
    codes([movingRight, truckLeft]).includes("grammar-screen-direction"),
  );
  const elevated = shot("elevated", {
    camera: camera(point(0, 7.971, 7.071)),
  });
  const levelWide = shot("level-wide", {
    camera: camera(point(0, 0.9, 10)),
  });
  TestValidator.predicate(
    "three-dimensional camera angle accepts an elevation change above 30 degrees",
    codes([levelWide, elevated]).includes("grammar-jump-cut") === false,
  );
  const relocatedSameBearing = shot("relocated-same-bearing", {
    camera: camera(point(20, 0.9, 3), point(20, 0.9, 0)),
    subjects: [subject("hero", point(20, 0, 0))],
  });
  TestValidator.predicate(
    "cut angle uses each camera's respective subject boundary position",
    codes([shot("before-relocation"), relocatedSameBearing]).includes(
      "grammar-jump-cut",
    ),
  );

  const looking = shot("looking", {
    camera: camera(point(0, 0.9, 5)),
    subjects: [
      subject("hero", point(0, 0, 0), point(0, 0, 0), {
        target: "target",
        point: point(1, 0, 0),
      }),
    ],
  });
  const reverseEyeline = shot("reverse-eyeline", {
    camera: camera(point(0, 0.9, -5)),
    subjects: [
      subject("hero", point(0, 0, 0)),
      subject("target", point(1, 0, 0), point(1, 0, 0), {
        target: "hero",
        point: point(0, 0, 0),
      }),
    ],
    primarySubject: "target",
  });
  TestValidator.predicate(
    "primary switch with a non-opposite reverse relation diagnoses eyeline",
    codes([looking, reverseEyeline]).includes("grammar-eyeline"),
  );
  TestValidator.predicate(
    "eyeline-break suppresses only the eyeline warning",
    codes([
      looking,
      { ...reverseEyeline, styleIntent: ["eyeline-break"] },
    ]).includes("grammar-eyeline") === false,
  );
  const verticalLook = shot("vertical-look", {
    subjects: [
      subject("hero", point(0, 0, 0), point(0, 0, 0), {
        target: "target",
        point: point(0, 1, 0),
      }),
    ],
  });
  const brokenVerticalLook = shot("broken-vertical-look", {
    subjects: [
      subject("hero", point(0, 0, 0), point(0, 0, 0), {
        target: "target",
        point: point(1, -1, 0),
      }),
    ],
  });
  TestValidator.predicate(
    "continuing eyeline compares horizontal and vertical screen components",
    analyzeFilmGrammar({
      shots: [verticalLook, brokenVerticalLook],
    }).some(
      (diagnostic) =>
        diagnostic.code === "grammar-eyeline" &&
        diagnostic.fact.includes("screen-center/above") &&
        diagnostic.fact.includes("screen-right/below"),
    ),
  );
  TestValidator.predicate(
    "unrelated gaze targets are not compared as one eyeline",
    codes([
      verticalLook,
      {
        ...brokenVerticalLook,
        id: "unrelated-look",
        subjects: [
          subject("hero", point(0, 0, 0), point(0, 0, 0), {
            target: "other",
            point: point(1, -1, 0),
          }),
        ],
      },
    ]).includes("grammar-eyeline") === false,
  );
  TestValidator.predicate(
    "gaze point behind the lens does not fabricate an eyeline side",
    codes([
      verticalLook,
      {
        ...brokenVerticalLook,
        id: "behind-look",
        subjects: [
          subject("hero", point(0, 0, 0), point(0, 0, 0), {
            target: "target",
            point: point(0, 0, 10),
          }),
        ],
      },
    ]).includes("grammar-eyeline") === false,
  );
  TestValidator.predicate(
    "primary switch with the opposite reverse relation preserves eyeline",
    codes([
      looking,
      {
        ...reverseEyeline,
        id: "matched-eyeline",
        camera: camera(point(0, 0.9, 5)),
      },
    ]).includes("grammar-eyeline") === false,
  );

  const wrongSize = shot("wrong-size", {
    camera: camera(point(0, 0.9, 5)),
    declaredShotSize: "close",
  });
  TestValidator.predicate(
    "measured subject scale diagnoses declared shot size",
    codes([wrongSize]).includes("grammar-shot-size"),
  );
  const displaced = shot("displaced", {
    camera: camera(point(20, 0.9, 3), point(20, 0.9, 0)),
    subjects: [subject("hero", point(20, 0, 0))],
  });
  TestValidator.predicate(
    "large displacement in a tight cut requires re-establishment",
    codes([shot("origin"), displaced]).includes("grammar-reestablish"),
  );
  TestValidator.predicate(
    "tight-reestablish suppresses only its matching warning",
    codes([
      shot("origin-style"),
      {
        ...displaced,
        id: "displaced-style",
        styleIntent: ["tight-reestablish"],
      },
    ]).includes("grammar-reestablish") === false,
  );
  const entrant = shot("entrant", {
    subjects: [
      subject("hero", point(0, 0, 0)),
      subject("newcomer", point(1, 0, 0)),
    ],
  });
  TestValidator.predicate(
    "new subject entering a tight shot requires re-establishment",
    codes([shot("before-entrant"), entrant]).includes("grammar-reestablish"),
  );
  TestValidator.equals(
    "a displacement plus entrant produces one re-establish diagnostic",
    analyzeFilmGrammar({
      shots: [
        shot("before-both"),
        {
          ...displaced,
          id: "displaced-with-entrant",
          subjects: [
            ...displaced.subjects,
            subject("newcomer", point(21, 0, 0)),
          ],
        },
      ],
    }).filter((diagnostic) => diagnostic.code === "grammar-reestablish").length,
    1,
  );
  TestValidator.predicate(
    "rhythmic-pacing on any participating shot suppresses sequence pacing",
    codes([
      { ...shot("rhythmic"), styleIntent: ["rhythmic-pacing"] },
      shot("rhythmic-tail"),
    ]).includes("grammar-pacing") === false,
  );

  const diagnostics = analyzeFilmGrammar({
    shots: [wrongSize, { ...displaced, duration: 3 }],
  });
  TestValidator.predicate(
    "every diagnostic carries fact impact and recovery",
    diagnostics.some((diagnostic) => diagnostic.code === "grammar-pacing") &&
      diagnostics.every(
        (diagnostic) =>
          diagnostic.fact.length !== 0 &&
          diagnostic.impact.length !== 0 &&
          diagnostic.recovery.length !== 0,
      ),
  );
  const notes = grammarDiagnosticsToReviewNotes({
    beat: "beat-grammar",
    diagnostics,
  });
  TestValidator.predicate(
    "review socket preserves diagnostic identity and recovery",
    notes.every(
      (note, index) =>
        note.tier === "visual" &&
        note.beat === "beat-grammar" &&
        note.issue.startsWith(`${diagnostics[index]!.code}: `) &&
        note.suggestion === diagnostics[index]!.recovery,
    ),
  );
  TestValidator.equals(
    "occupancy classification follows framing-height grammar",
    classifyGrammarShotSize(1 / 4),
    "wide",
  );
  TestValidator.predicate(
    "all framing-height classes are reachable",
    classifyGrammarShotSize(1 / 1.15) === "full" &&
      classifyGrammarShotSize(1 / 0.62) === "medium" &&
      classifyGrammarShotSize(1 / 0.28) === "close",
  );
  TestValidator.predicate(
    "matching measured and declared framing stays silent",
    codes([
      {
        ...shot("matching-size"),
        declaredShotSize: "full",
      },
    ]).includes("grammar-shot-size") === false,
  );
  TestValidator.predicate(
    "subject behind the camera has no fabricated shot-size diagnostic",
    codes([
      {
        ...shot("behind-camera"),
        camera: camera(point(0, 0.9, 0), point(0, 0.9, -1)),
        subjects: [subject("hero", point(0, 0, 5))],
        declaredShotSize: "close",
      },
    ]).includes("grammar-shot-size") === false,
  );
  TestValidator.error("zero occupancy is invalid", () =>
    classifyGrammarShotSize(0),
  );
  TestValidator.error("duplicate shot ids are invalid", () =>
    analyzeFilmGrammar({ shots: [shot("duplicate"), shot("duplicate")] }),
  );
  TestValidator.error("non-positive cut angle is invalid", () =>
    analyzeFilmGrammar({
      shots: [shot("valid")],
      minimumCutAngleDegrees: 0,
    }),
  );
  TestValidator.error("non-positive re-establish distance is invalid", () =>
    analyzeFilmGrammar({
      shots: [shot("valid-distance")],
      reestablishDistance: 0,
    }),
  );
  TestValidator.predicate(
    "explicit positive thresholds are accepted",
    analyzeFilmGrammar({
      shots: [shot("explicit-thresholds")],
      minimumCutAngleDegrees: 45,
      reestablishDistance: 20,
    }).length === 1,
  );
  rejects("blank shot id", (input) => {
    input.id = " ";
  });
  rejects("non-finite duration", (input) => {
    input.duration = Number.NaN;
  });
  rejects("zero duration", (input) => {
    input.duration = 0;
  });
  rejects("zero camera fov", (input) => {
    input.camera.start.fovY = 0;
  });
  rejects("camera fov at 180", (input) => {
    input.camera.end.fovY = 180;
  });
  rejects("zero camera aspect", (input) => {
    input.camera.start.aspect = 0;
  });
  rejects("non-finite camera position", (input) => {
    input.camera.end.position.x = Number.NaN;
  });
  rejects("non-finite camera rotation", (input) => {
    input.camera.start.rotation.w = Number.NaN;
  });
  rejects("blank subject id", (input) => {
    input.subjects[0]!.id = "";
  });
  rejects("duplicate subject id", (input) => {
    input.subjects.push(structuredClone(input.subjects[0]!));
  });
  rejects("non-finite subject start", (input) => {
    input.subjects[0]!.start.x = Number.NaN;
  });
  rejects("non-finite subject end", (input) => {
    input.subjects[0]!.end.z = Number.NaN;
  });
  rejects("zero subject height", (input) => {
    input.subjects[0]!.height = 0;
  });
  rejects("blank eyeline target", (input) => {
    input.subjects[0]!.eyeline = {
      target: "",
      start: point(1, 0, 0),
      end: point(1, 0, 0),
    };
  });
  rejects("non-finite eyeline start", (input) => {
    input.subjects[0]!.eyeline = {
      target: "target",
      start: point(Number.NaN, 0, 0),
      end: point(1, 0, 0),
    };
  });
  rejects("non-finite eyeline end", (input) => {
    input.subjects[0]!.eyeline = {
      target: "target",
      start: point(1, 0, 0),
      end: point(1, Number.NaN, 0),
    };
  });
  rejects("missing primary subject", (input) => {
    input.primarySubject = "missing";
  });
  rejects("repeated action-axis subject", (input) => {
    input.actionAxis = ["hero", "hero"];
  });
  rejects("missing first action-axis subject", (input) => {
    input.actionAxis = ["missing", "hero"];
  });
  rejects("missing second action-axis subject", (input) => {
    input.actionAxis = ["hero", "missing"];
  });
  rejects("duplicate style intent", (input) => {
    input.styleIntent = ["jump-cut", "jump-cut"];
  });
};
