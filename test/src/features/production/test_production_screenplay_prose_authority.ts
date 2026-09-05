import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const { parseScreenplayProse, screenplayProseDiagnostics } = loadSourceModule<{
  parseScreenplayProse: (content: string) => Array<{
    id: string;
    authority: {
      location: string;
      storyTime: string;
      participants: Array<{ id: string; mode: string }>;
      beats: string[];
    } | null;
    authorityErrors: string[];
    timing: Array<{ text: string; seconds: number; selector: string | null }>;
  }>;
  screenplayProseDiagnostics: (props: {
    screenplay: IAutoMovieScreenplayIndex | null;
    read: (relativePath: string) => string | null;
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/screenplayProseDiagnostics.ts",
  ),
);

const base = (): IAutoMovieScreenplayIndex =>
  ({
    version: 2,
    production: "authority",
    treatment: {
      path: "docs/treatment.md",
      sequences: [
        {
          id: "SEQ-1",
          title: "Sequence",
          beats: [{ id: "BEAT-1", text: "The signal arrives." }],
        },
      ],
    },
    screenplay: {
      path: "docs/screenplay.md",
      lock: null,
      scenes: [
        {
          id: "SCN-1",
          title: "Signal",
          status: "active",
          covers: [
            {
              id: "BEAT-1",
              beat: "The signal arrives.",
              reason: "This scene delivers the signal.",
            },
          ],
          location: "LOC-1",
          storyTime: "NIGHT",
          participants: [
            { id: "CHAR-1", mode: "on-screen" },
            { id: "VOICE-1", mode: "off-screen" },
            { id: "CROWD-1", mode: "crowd" },
            { id: "PROP-1", mode: "object" },
            { id: "RAIN-1", mode: "environmental" },
            { id: "CHAR-2", mode: "referenced" },
          ],
          disposition: null,
        },
      ],
    },
    catalog: { characters: [], factions: [], locations: [] },
    continuity: [],
  }) as IAutoMovieScreenplayIndex;

const carrier = (props?: {
  location?: string;
  storyTime?: string;
  participants?: string[];
  beats?: string[];
}): string =>
  [
    "# SCN-1 - Signal",
    "@automovie-scene",
    `location: ${props?.location ?? "LOC-1"}`,
    `story-time: ${props?.storyTime ?? "NIGHT"}`,
    ...(
      props?.participants ?? [
        "CHAR-1 on-screen",
        "VOICE-1 off-screen",
        "CROWD-1 crowd",
        "PROP-1 object",
        "RAIN-1 environmental",
        "CHAR-2 referenced",
      ]
    ).map((participant) => `participant: ${participant}`),
    ...(props?.beats ?? ["BEAT-1"]).map((beat) => `beat: ${beat}`),
    "@end-automovie-scene",
    "The signal arrives.",
  ].join("\n");

const run = (
  index: IAutoMovieScreenplayIndex,
  screenplay: string,
): IAutoMovieDiagnostic[] =>
  screenplayProseDiagnostics({
    screenplay: index,
    read: (relativePath) =>
      relativePath === "docs/treatment.md"
        ? "The signal arrives."
        : relativePath === "docs/screenplay.md" ||
            relativePath === "docs/scene.md"
          ? screenplay
          : null,
  });

/**
 * Prove exact scene authority across whole and split screenplay layouts.
 *
 * Scenarios:
 * 1. Exact location, unknown/time, every participant mode and beat identity pass.
 * 2. Place, time, participant and beat mismatches each emit their stable code.
 * 3. Comments, fences, malformed carriers and OMITTED carriers cannot become authority.
 * 4. A split scene path yields the same normalized comparison as a whole screenplay.
 * 5. The carrier parser names every malformed line: a missing end marker, a
 *    line without a field separator, a repeated location or story-time, a
 *    participant without a mode, a blank beat, an unsupported field, a blank
 *    location or story-time, and a repeated participant or beat; a timing
 *    range contributes its opening number without a selector.
 */
export const test_production_screenplay_prose_authority = (): void => {
  const exact = base();
  const exactDiagnostics = run(exact, carrier());
  const unknown = base();
  unknown.screenplay.scenes[0]!.storyTime = "unknown";
  const split = base();
  split.screenplay.scenes[0]!.path = "docs/scene.md";
  const omitted = base();
  omitted.screenplay.scenes[0]!.status = "OMITTED";
  omitted.screenplay.scenes[0]!.title = "Signal";
  const hidden = [
    "# SCN-1 - Signal",
    "<!-- @automovie-scene",
    "location: LOC-1",
    "story-time: NIGHT",
    "@end-automovie-scene -->",
    "```md",
    carrier(),
    "```",
    "The signal arrives.",
  ].join("\n");
  const codes = (index: IAutoMovieScreenplayIndex, prose: string) =>
    run(index, prose).map((diagnostic) => diagnostic.code);

  TestValidator.equals(
    "screenplay prose authority has one exact scene-local owner",
    namedFacts([
      ["exactCarrierPasses", () => exactDiagnostics.length === 0],
      [
        "explicitUnknownPasses",
        () => run(unknown, carrier({ storyTime: "unknown" })).length === 0,
      ],
      ["splitLayoutPasses", () => run(split, carrier()).length === 0],
      [
        "locationConflictIsNamed",
        () =>
          codes(base(), carrier({ location: "loc-1" })).includes(
            "screenplay-scene-location-conflict",
          ),
      ],
      [
        "storyTimeConflictIsNamed",
        () =>
          codes(base(), carrier({ storyTime: "DAY" })).includes(
            "screenplay-scene-story-time-conflict",
          ),
      ],
      [
        "participantConflictIsNamed",
        () =>
          codes(
            base(),
            carrier({ participants: ["CHAR-1 referenced"] }),
          ).includes("screenplay-scene-participant-conflict"),
      ],
      [
        "beatConflictIsNamed",
        () =>
          codes(base(), carrier({ beats: ["BEAT-OTHER"] })).includes(
            "screenplay-scene-beat-conflict",
          ),
      ],
      [
        "hiddenCarrierIsAbsent",
        () =>
          codes(base(), hidden).includes("screenplay-scene-authority-absent"),
      ],
      [
        "malformedCarrierIsInvalid",
        () =>
          codes(
            base(),
            carrier({ participants: ["CHAR-1 performer"] }),
          ).includes("screenplay-scene-authority-invalid"),
      ],
      [
        "omittedCarrierIsUnexpected",
        () =>
          codes(omitted, carrier()).includes(
            "screenplay-scene-authority-unexpected",
          ),
      ],
    ]),
    {
      exactCarrierPasses: true,
      explicitUnknownPasses: true,
      splitLayoutPasses: true,
      locationConflictIsNamed: true,
      storyTimeConflictIsNamed: true,
      participantConflictIsNamed: true,
      beatConflictIsNamed: true,
      hiddenCarrierIsAbsent: true,
      malformedCarrierIsInvalid: true,
      omittedCarrierIsUnexpected: true,
    },
  );

  const parsed = (
    lines: readonly string[],
  ): { authority: boolean; errors: string[] } => {
    const scene = parseScreenplayProse(
      ["# SCN-1 - Signal", "@automovie-scene", ...lines].join("\n"),
    )[0]!;
    return {
      authority: scene.authority !== null,
      errors: scene.authorityErrors,
    };
  };
  const valid = ["location: LOC-1", "story-time: NIGHT"];
  TestValidator.equals(
    "the carrier parser names every malformed authority line",
    {
      unterminated: parsed(valid),
      noSeparator: parsed([...valid, "mood tense", "@end-automovie-scene"]),
      repeatedLocation: parsed([
        ...valid,
        "location: LOC-2",
        "@end-automovie-scene",
      ]),
      repeatedStoryTime: parsed([
        ...valid,
        "story-time: DAY",
        "@end-automovie-scene",
      ]),
      participantWithoutMode: parsed([
        ...valid,
        "participant: CHAR-1",
        "@end-automovie-scene",
      ]),
      blankBeat: parsed([...valid, "beat:", "@end-automovie-scene"]),
      unsupportedField: parsed([
        ...valid,
        "mood: tense",
        "@end-automovie-scene",
      ]),
      blankLocation: parsed([
        "location:",
        "story-time:",
        "@end-automovie-scene",
      ]),
      missingStoryTime: parsed(["location: LOC-1", "@end-automovie-scene"]),
      repeatedParticipant: parsed([
        ...valid,
        "participant: CHAR-1 on-screen",
        "participant: CHAR-1 on-screen",
        "@end-automovie-scene",
      ]),
      repeatedBeat: parsed([
        ...valid,
        "beat: BEAT-1",
        "beat: BEAT-1",
        "@end-automovie-scene",
      ]),
      exact: parsed([
        ...valid,
        "",
        "participant: CHAR-1 on-screen",
        "beat: BEAT-1",
        "@end-automovie-scene",
      ]),
      rangeTiming: parseScreenplayProse(
        "# SCN-1 - Signal\nThe hold lasts two to three seconds.",
      )[0]!.timing,
    },
    {
      unterminated: {
        authority: false,
        errors: ["@automovie-scene has no @end-automovie-scene"],
      },
      noSeparator: {
        authority: true,
        errors: ['authority line "mood tense" has no field separator'],
      },
      repeatedLocation: {
        authority: true,
        errors: ["location is declared twice"],
      },
      repeatedStoryTime: {
        authority: true,
        errors: ["story-time is declared twice"],
      },
      participantWithoutMode: {
        authority: true,
        errors: ['participant "CHAR-1" has no valid identity and mode'],
      },
      blankBeat: { authority: true, errors: ["beat identity is blank"] },
      unsupportedField: {
        authority: true,
        errors: ['authority field "mood" is not supported'],
      },
      blankLocation: {
        authority: true,
        errors: [
          "location is absent or blank",
          "story-time is absent or blank",
        ],
      },
      missingStoryTime: {
        authority: false,
        errors: ["story-time is absent or blank"],
      },
      repeatedParticipant: {
        authority: true,
        errors: ["a participant identity and mode pair is repeated"],
      },
      repeatedBeat: {
        authority: true,
        errors: ["a beat identity is repeated"],
      },
      exact: { authority: true, errors: [] },
      rangeTiming: [
        { text: "three", seconds: 3, selector: null },
        { text: "two", seconds: 2, selector: null },
      ],
    },
  );
};
