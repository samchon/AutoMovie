import {
  joinAutoMovieDialogueVisemes,
  sampleAutoMovieDialogueExpression,
} from "@automovie/engine";
import type {
  IAutoMovieExpression,
  IAutoMovieProductionDialogueLine,
  IAutoMovieProductionViseme,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const line = (
  speaker: string | null = "narrator",
): IAutoMovieProductionDialogueLine => ({
  id: "line",
  text: "A line",
  language: "en",
  ...(speaker === null ? {} : { speaker }),
  startFrame: 10,
  endFrame: 20,
});

const visemes: IAutoMovieProductionViseme[] = [
  { phoneme: "a", viseme: "aa", startFrame: 12, endFrame: 15 },
  { phoneme: "i", viseme: "ih", startFrame: 17, endFrame: 19 },
];

/** Final-byte visemes join explicitly, preserve gaps, and seek without history. */
export const test_engine_dialogue_viseme_join = (): void => {
  const compiled = joinAutoMovieDialogueVisemes({
    line: line(),
    bindings: [{ speaker: "narrator", actor: "actor" }],
    visemes,
  });
  if (compiled.timeline === null)
    throw new Error("positive dialogue join unexpectedly produced no timeline");
  TestValidator.equals(
    "an explicit speaker join creates a gap-free emission-clock timeline",
    {
      join: compiled.join,
      ranges: compiled.timeline.ranges,
    },
    {
      join: {
        status: "available",
        actor: "actor",
        timing: "emission",
        composition: "mouth-layer-over-authored-expression",
      },
      ranges: [
        { startFrame: 10, endFrame: 12, viseme: "rest" },
        { startFrame: 12, endFrame: 15, viseme: "aa" },
        { startFrame: 15, endFrame: 17, viseme: "rest" },
        { startFrame: 17, endFrame: 19, viseme: "ih" },
        { startFrame: 19, endFrame: 20, viseme: "rest" },
      ],
    },
  );

  const authored: IAutoMovieExpression = {
    preset: "sad",
    intensity: 0.75,
    blendshapes: null,
  };
  const active = sampleAutoMovieDialogueExpression({
    timeline: compiled.timeline,
    frame: 13,
    authored,
  });
  const gapAfterSeek = sampleAutoMovieDialogueExpression({
    timeline: compiled.timeline,
    frame: 16,
    authored,
  });
  const activeAgain = sampleAutoMovieDialogueExpression({
    timeline: compiled.timeline,
    frame: 13,
    authored,
  });
  TestValidator.equals(
    "mouth-only sampling preserves authored emotion and arbitrary seek",
    {
      active,
      gapAfterSeek,
      activeAgain,
      sameAuthoredObject: active.authored === authored,
    },
    {
      active: { authored, mouth: { preset: "aa", intensity: 1 } },
      gapAfterSeek: { authored, mouth: { preset: "neutral", intensity: 0 } },
      activeAgain: { authored, mouth: { preset: "aa", intensity: 1 } },
      sameAuthoredObject: true,
    },
  );

  TestValidator.equals(
    "missing and ambiguous speaker facts remain closed not-run outcomes",
    {
      missingSpeaker: joinAutoMovieDialogueVisemes({
        line: line(null),
        bindings: [],
        visemes,
      }).join,
      missingActor: joinAutoMovieDialogueVisemes({
        line: line(),
        bindings: [],
        visemes,
      }).join,
      ambiguous: joinAutoMovieDialogueVisemes({
        line: line(),
        bindings: [
          { speaker: "narrator", actor: "one" },
          { speaker: "narrator", actor: "two" },
        ],
        visemes,
      }).join,
    },
    {
      missingSpeaker: { status: "not-run", reason: "speaker-not-declared" },
      missingActor: { status: "not-run", reason: "speaker-actor-not-found" },
      ambiguous: { status: "not-run", reason: "speaker-actor-ambiguous" },
    },
  );

  TestValidator.equals(
    "corrupt final timing and invalid sampling are refused",
    {
      absentTiming: throwsError(
        () =>
          joinAutoMovieDialogueVisemes({
            line: line(),
            bindings: [{ speaker: "narrator", actor: "actor" }],
            visemes: [],
          }),
        "final-byte viseme timing",
      ),
      overlap: throwsError(
        () =>
          joinAutoMovieDialogueVisemes({
            line: line(),
            bindings: [{ speaker: "narrator", actor: "actor" }],
            visemes: [
              { phoneme: "a", viseme: "aa", startFrame: 12, endFrame: 16 },
              { phoneme: "i", viseme: "ih", startFrame: 15, endFrame: 18 },
            ],
          }),
        "overlaps",
      ),
      badFrame: throwsError(
        () =>
          sampleAutoMovieDialogueExpression({
            timeline: compiled.timeline!,
            frame: -1,
            authored: null,
          }),
        "non-negative integer",
      ),
    },
    { absentTiming: true, overlap: true, badFrame: true },
  );

  const joinWith = (props: {
    line?: IAutoMovieProductionDialogueLine;
    visemes?: IAutoMovieProductionViseme[];
    actor?: string;
  }) =>
    joinAutoMovieDialogueVisemes({
      line: props.line ?? line(),
      bindings: [
        {
          speaker: "narrator",
          actor: props.actor === undefined ? "actor" : props.actor,
        },
      ],
      visemes: props.visemes ?? visemes,
    });
  TestValidator.equals(
    "every malformed line and viseme boundary is refused at the join",
    {
      blankActor: throwsError(
        () => joinWith({ actor: " " }),
        "must not be blank",
      ),
      fractionalLineStart: throwsError(
        () => joinWith({ line: { ...line(), startFrame: 10.5 } }),
        "invalid range",
      ),
      fractionalLineEnd: throwsError(
        () => joinWith({ line: { ...line(), endFrame: 19.5 } }),
        "invalid range",
      ),
      negativeLineStart: throwsError(
        () =>
          joinWith({
            line: { ...line(), startFrame: -1 },
            visemes: [
              { phoneme: "a", viseme: "aa", startFrame: 0, endFrame: 1 },
            ],
          }),
        "invalid range",
      ),
      reversedLine: throwsError(
        () => joinWith({ line: { ...line(), endFrame: 10 } }),
        "invalid range",
      ),
      fractionalVisemeStart: throwsError(
        () =>
          joinWith({
            visemes: [
              { phoneme: "a", viseme: "aa", startFrame: 10.5, endFrame: 12 },
            ],
          }),
        "outside or overlaps",
      ),
      fractionalVisemeEnd: throwsError(
        () =>
          joinWith({
            visemes: [
              { phoneme: "a", viseme: "aa", startFrame: 10, endFrame: 12.5 },
            ],
          }),
        "outside or overlaps",
      ),
      emptyViseme: throwsError(
        () =>
          joinWith({
            visemes: [
              { phoneme: "a", viseme: "aa", startFrame: 12, endFrame: 12 },
            ],
          }),
        "outside or overlaps",
      ),
      beyondLine: throwsError(
        () =>
          joinWith({
            visemes: [
              { phoneme: "a", viseme: "aa", startFrame: 19, endFrame: 21 },
            ],
          }),
        "outside or overlaps",
      ),
      unsupportedViseme: throwsError(
        () =>
          joinWith({
            visemes: [
              {
                phoneme: "x",
                viseme: "bogus" as IAutoMovieProductionViseme["viseme"],
                startFrame: 12,
                endFrame: 13,
              },
            ],
          }),
        "unsupported mouth target",
      ),
      fractionalSample: throwsError(
        () =>
          sampleAutoMovieDialogueExpression({
            timeline: compiled.timeline!,
            frame: 1.5,
            authored: null,
          }),
        "non-negative integer",
      ),
    },
    {
      blankActor: true,
      fractionalLineStart: true,
      fractionalLineEnd: true,
      negativeLineStart: true,
      reversedLine: true,
      fractionalVisemeStart: true,
      fractionalVisemeEnd: true,
      emptyViseme: true,
      beyondLine: true,
      unsupportedViseme: true,
      fractionalSample: true,
    },
  );
};
