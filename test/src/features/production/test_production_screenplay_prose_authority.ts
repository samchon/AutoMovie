import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const { screenplayProseDiagnostics } = loadSourceModule<{
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
};
