import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const { screenplayLedgerDiagnostics } = loadSourceModule<{
  screenplayLedgerDiagnostics: (props: {
    acceptance: ReadonlyMap<string, never>;
    contracts: ReadonlyMap<string, never>;
    screenplay: IAutoMovieScreenplayIndex | null;
    designRecordPath: () => string;
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/screenplayLedgerDiagnostics.ts",
  ),
);

const index = (): IAutoMovieScreenplayIndex => ({
  version: 2,
  production: "ledger",
  treatment: {
    path: "treatment.md",
    sequences: [
      {
        id: "SEQ-1",
        title: "Sequence",
        beats: [{ id: "BEAT-1", text: "The signal arrives." }],
      },
    ],
  },
  screenplay: {
    path: "screenplay.md",
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
        storyTime: "unknown",
        participants: [{ id: "CHAR-1", mode: "on-screen" }],
        disposition: null,
      },
    ],
  },
  catalog: {
    characters: [
      {
        id: "CHAR-1",
        name: "Character",
        evidence: [{ scene: "SCN-1" }],
        bindings: [],
      },
    ],
    factions: [],
    locations: [
      {
        id: "LOC-1",
        name: "Location",
        evidence: [{ scene: "SCN-1" }],
        bindings: [],
      },
    ],
  },
  continuity: [],
});

const run = (screenplay: IAutoMovieScreenplayIndex): IAutoMovieDiagnostic[] =>
  screenplayLedgerDiagnostics({
    acceptance: new Map(),
    contracts: new Map(),
    screenplay,
    designRecordPath: () => "design.json",
  });

/**
 * Pin index facts introduced by the screenplay authority carrier.
 *
 * Scenarios:
 * 1. An explicit story-time state, unique participant and exact beat pair pass.
 * 2. Blank story time and participant identity fail independently.
 * 3. Duplicate participant pairs and blank or mismatched beat identities fail.
 */
export const test_production_screenplay_ledger_authority = (): void => {
  const blankTime = structuredClone(index());
  blankTime.screenplay.scenes[0]!.storyTime = " ";
  const blankParticipant = structuredClone(index());
  blankParticipant.screenplay.scenes[0]!.participants[0]!.id = "";
  const duplicateParticipant = structuredClone(index());
  duplicateParticipant.screenplay.scenes[0]!.participants.push({
    id: "CHAR-1",
    mode: "on-screen",
  });
  const blankBeat = structuredClone(index());
  blankBeat.screenplay.scenes[0]!.covers[0]!.id = "";
  const mismatchedBeat = structuredClone(index());
  mismatchedBeat.screenplay.scenes[0]!.covers[0]!.id = "BEAT-MISSING";
  const codes = (value: IAutoMovieScreenplayIndex): string[] =>
    run(value).map((diagnostic) => diagnostic.code);

  TestValidator.equals(
    "screenplay index authority fields are exact",
    namedFacts([
      ["exactJoinPasses", () => run(index()).length === 0],
      [
        "blankStoryTimeIsNamed",
        () => codes(blankTime).includes("screenplay-scene-story-time-absent"),
      ],
      [
        "blankParticipantIsNamed",
        () =>
          codes(blankParticipant).includes(
            "screenplay-scene-participant-invalid",
          ),
      ],
      [
        "duplicateParticipantIsNamed",
        () =>
          codes(duplicateParticipant).includes(
            "screenplay-scene-participant-invalid",
          ),
      ],
      [
        "blankBeatIdentityIsNamed",
        () => codes(blankBeat).includes("screenplay-cover-unpromised"),
      ],
      [
        "mismatchedBeatIdentityIsNamed",
        () => codes(mismatchedBeat).includes("screenplay-cover-unpromised"),
      ],
    ]),
    {
      exactJoinPasses: true,
      blankStoryTimeIsNamed: true,
      blankParticipantIsNamed: true,
      duplicateParticipantIsNamed: true,
      blankBeatIdentityIsNamed: true,
      mismatchedBeatIdentityIsNamed: true,
    },
  );
};
