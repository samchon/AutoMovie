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

const camera = (
  position: IAutoMovieVector3,
  focus: IAutoMovieVector3 = point(0, 0.9, 0),
): IAutoMovieGrammarShotObservation["camera"] => ({
  position,
  rotation: lookRotation({
    x: focus.x - position.x,
    y: focus.y - position.y,
    z: focus.z - position.z,
  }),
  fovY: 60,
  aspect: 16 / 9,
});

const subject = (
  id: string,
  start: IAutoMovieVector3,
  end: IAutoMovieVector3 = start,
  eyelineTarget?: string,
): IAutoMovieGrammarShotObservation["subjects"][number] => ({
  id,
  start,
  end,
  height: 1.8,
  ...(eyelineTarget === undefined ? {} : { eyelineTarget }),
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
  onScreenAxisCrossing: false,
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
 * 2. Reversing subject collection order cannot alter diagnostics.
 * 3. `jump-cut` suppresses only its warning and preserves screen direction.
 * 4. Eyeline, measured shot size, displacement re-establishment and pacing
 *    diagnostics expose fact, impact and recovery text through review notes.
 * 5. Invalid observations and thresholds fail before analysis.
 */
export const test_film_grammar = (): void => {
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

  const looking = shot("looking", {
    camera: camera(point(0, 0.9, 5)),
    subjects: [
      subject("hero", point(0, 0, 0), point(0, 0, 0), "target"),
      subject("target", point(1, 0, 0)),
    ],
  });
  const reverseEyeline = shot("reverse-eyeline", {
    camera: camera(point(0, 0.9, -5)),
    subjects: [
      subject("hero", point(0, 0, 0)),
      subject("target", point(1, 0, 0)),
    ],
  });
  TestValidator.predicate(
    "reverse relative screen position diagnoses eyeline",
    codes([looking, reverseEyeline]).includes("grammar-eyeline"),
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
};
