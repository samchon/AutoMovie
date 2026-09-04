import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

/**
 * Load private diagnostic units from source without making them public API.
 *
 * The test launcher already owns the TypeScript require hook. Resolving at
 * runtime keeps the package source outside this test package's `rootDir` during
 * type checking, and avoids depending on a pre-existing `packages/production/lib`
 * build in a clean checkout.
 */
const proseUnits = loadSourceModule<{
  parseScreenplayProse: (content: string) => Array<{
    id: string;
    title: string;
    body: string;
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
const timingUnits = loadSourceModule<{
  screenplayTimingDiagnostics: (props: {
    contracts: ReadonlyMap<string, IAutoMovieShotContract>;
    read: (relativePath: string) => string | null;
    scope: "design" | "source" | "review" | "final";
    screenplay: IAutoMovieScreenplayIndex | null;
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/screenplayTimingDiagnostics.ts",
  ),
);
const { parseScreenplayProse, screenplayProseDiagnostics } = proseUnits;
const { screenplayTimingDiagnostics } = timingUnits;

/** The prose-owned subset is sufficient for these diagnostics. */
const screenplay = (props?: {
  scenes?: Array<
    Omit<
      IAutoMovieScreenplayIndex["screenplay"]["scenes"][number],
      "storyTime" | "participants"
    > &
      Partial<
        Pick<
          IAutoMovieScreenplayIndex["screenplay"]["scenes"][number],
          "storyTime" | "participants"
        >
      >
  >;
  sequences?: IAutoMovieScreenplayIndex["treatment"]["sequences"];
}): IAutoMovieScreenplayIndex =>
  ({
    version: 2,
    production: "diagnostic-units",
    treatment: {
      path: "docs/combined.md",
      sequences: props?.sequences ?? [],
    },
    screenplay: {
      path: "docs/combined.md",
      lock: null,
      scenes: (props?.scenes ?? []).map((scene) => ({
        storyTime: "unknown",
        participants: [],
        ...scene,
      })),
    },
    catalog: { characters: [], factions: [], locations: [] },
    continuity: [],
  }) as IAutoMovieScreenplayIndex;

/** The timing diagnostic reads only these shot-contract fields. */
const contract = (props: {
  evidence?: string[];
  duration?: number;
  events?: Array<{ from: number; to: number }>;
  frames?: number[];
}): IAutoMovieShotContract =>
  ({
    id: "timing",
    beat: "beat",
    source: { module: "src/shots/timing.ts", export: "timing" },
    evidence: props.evidence?.map((scene) => ({ scene, claims: [] })),
    durationSeconds: props.duration ?? 6,
    participants: [],
    opening: [],
    closing: [],
    camera: [],
    events: props.events?.map((event, index) => ({
      id: `event-${index}`,
      window: event,
      predicates: [],
    })),
    reviewFrames: (props.frames ?? []).map((time, index) => ({
      id: `frame-${index}`,
      time,
      passes: ["beauty"],
    })),
  }) as unknown as IAutoMovieShotContract;

/**
 * Exercise the Markdown/prose boundary as a unit, including every refusal.
 *
 * Compiler fixtures prove integration separately. This unit owns the lexical
 * edge cases that should not require a complete production for each branch:
 * both fence markers, short and decorated non-closers, inline and multiline
 * comments, split documents, cached absent documents, and every prose/index
 * disagreement.
 */
export const test_production_screenplay_diagnostic_units = (): void => {
  const parsed = parseScreenplayProse(
    [
      "preamble",
      "<!-- metadata -->",
      "### SCN-A - Alpha {#alpha}",
      "Visible <!-- hidden --> tail.",
      "<!-- hidden",
      "still hidden",
      "-->Visible again.",
      "```md",
      "### SCN-FENCED - Not prose",
      "```",
      "   ~~~md",
      "### SCN-TILDE - Not prose",
      "   ~~",
      "   ~~~ trailing",
      "   ```",
      "   ~~~~",
      "    ``` is indented prose",
      "## SCN-B : Beta",
      "Body B.",
      "~~~",
      "an unterminated final fence",
    ].join("\r\n"),
  );
  const empty = parseScreenplayProse("No scene heading here.");

  const index = screenplay({
    sequences: [
      {
        id: "SEQ-DEFAULT",
        title: "Default",
        beats: [
          { id: "BEAT-WRITTEN", text: "Written beat." },
          { id: "BEAT-BLANK", text: " " },
          { id: "BEAT-MISSING", text: "Missing beat." },
        ],
      },
      {
        id: "SEQ-EMPTY-PATH",
        title: "Fallback",
        path: " ",
        beats: [],
      },
      {
        id: "SEQ-MISSING",
        title: "Missing",
        path: "docs/missing.md",
        beats: [],
      },
    ],
    scenes: [
      {
        id: "SCN-GOOD",
        title: "Good",
        status: "active",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-DUP",
        title: "Duplicate",
        status: "active",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-ABSENT",
        title: "Absent",
        status: "active",
        path: " ",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-RETITLED",
        title: "Expected title",
        status: "active",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-EMPTY",
        title: "Empty",
        status: "active",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-TOMBSTONE",
        title: "Tombstone",
        status: "OMITTED",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-OWNED",
        title: "Owned",
        status: "active",
        path: "docs/owned.md",
        covers: [],
        location: "unknown",
        disposition: null,
      },
      {
        id: "SCN-MISSING-DOC",
        title: "Missing doc",
        status: "active",
        path: "docs/missing.md",
        covers: [],
        location: null,
        disposition: null,
      },
    ],
  });
  const documents = new Map<string, string>([
    [
      "docs/combined.md",
      [
        "Written beat.",
        "<!-- Missing beat. -->",
        "# SCN-GOOD — Good",
        "Good body.",
        "# SCN-DUP - Duplicate",
        "First body.",
        "# SCN-DUP : Duplicate",
        "Second body.",
        "# SCN-EXTRA - Extra",
        "Unindexed body.",
        "# SCN-RETITLED - Different title",
        "Retitled body.",
        "# SCN-EMPTY - Empty",
        "# SCN-TOMBSTONE - Tombstone",
        "# SCN-OWNED - Owned",
        "This copy is ignored because the scene owns another document.",
      ].join("\n"),
    ],
    [
      "docs/owned.md",
      [
        "# SCN-NOT-OWNED - Ignored",
        "Ignored body.",
        "# SCN-OWNED - Owned",
        "@automovie-scene",
        "location: unknown",
        "story-time: unknown",
        "@end-automovie-scene",
        "Owned body.",
      ].join("\n"),
    ],
  ]);
  const reads = new Map<string, number>();
  const diagnostics = screenplayProseDiagnostics({
    screenplay: index,
    read: (relative) => {
      reads.set(relative, (reads.get(relative) ?? 0) + 1);
      return documents.get(relative) ?? null;
    },
  });
  const codes = diagnostics.map((diagnostic) => diagnostic.code);

  TestValidator.equals(
    "screenplay prose diagnostics own their complete lexical and refusal surface",
    namedFacts([
      [
        "nullIndexIsEmpty",
        () =>
          screenplayProseDiagnostics({ screenplay: null, read: () => "unused" })
            .length === 0,
      ],
      ["noHeadingIsEmpty", () => empty.length === 0],
      ["anchorsAreMetadata", () => parsed[0]?.title === "Alpha"],
      [
        "commentsAreRemoved",
        () => parsed[0]?.body.includes("hidden") === false,
      ],
      [
        "visibleCommentTailsRemain",
        () => parsed[0]?.body.includes("Visible again.") === true,
      ],
      [
        "bothFenceKindsAreIgnored",
        () =>
          parsed.every(
            (scene) => scene.id !== "SCN-FENCED" && scene.id !== "SCN-TILDE",
          ),
      ],
      [
        "indentedFenceTextRemainsProse",
        () => parsed[0]?.body.includes("indented prose") === true,
      ],
      [
        "laterScenesRemainAddressable",
        () =>
          parsed[1]?.id === "SCN-B" &&
          parsed[1]?.body.includes("Body B.") === true,
      ],
      ["missingDocumentsAreCached", () => reads.get("docs/missing.md") === 1],
      ["documentsAreCached", () => reads.get("docs/combined.md") === 1],
      [
        "missingDocumentIsNamed",
        () => codes.includes("screenplay-document-absent"),
      ],
      [
        "commentedBeatIsUnwritten",
        () => codes.includes("screenplay-beat-unwritten"),
      ],
      [
        "duplicateHeadingIsNamed",
        () => codes.includes("screenplay-heading-repeated"),
      ],
      [
        "unindexedHeadingIsNamed",
        () => codes.includes("screenplay-heading-unindexed"),
      ],
      [
        "absentHeadingIsNamed",
        () => codes.includes("screenplay-heading-absent"),
      ],
      [
        "retitledHeadingIsNamed",
        () => codes.includes("screenplay-heading-retitled"),
      ],
      [
        "emptyActiveSceneIsNamed",
        () => codes.includes("screenplay-scene-unwritten"),
      ],
      [
        "omittedEmptySceneIsAllowed",
        () =>
          diagnostics.some(
            (diagnostic) =>
              diagnostic.message.includes('"SCN-TOMBSTONE"') &&
              diagnostic.code === "screenplay-scene-unwritten",
          ) === false,
      ],
      [
        "ownedSceneUsesItsOwnDocument",
        () =>
          diagnostics.some((diagnostic) =>
            diagnostic.message.includes('"SCN-OWNED"'),
          ) === false,
      ],
    ]),
    {
      nullIndexIsEmpty: true,
      noHeadingIsEmpty: true,
      anchorsAreMetadata: true,
      commentsAreRemoved: true,
      visibleCommentTailsRemain: true,
      bothFenceKindsAreIgnored: true,
      indentedFenceTextRemainsProse: true,
      laterScenesRemainAddressable: true,
      missingDocumentsAreCached: true,
      documentsAreCached: true,
      missingDocumentIsNamed: true,
      commentedBeatIsUnwritten: true,
      duplicateHeadingIsNamed: true,
      unindexedHeadingIsNamed: true,
      absentHeadingIsNamed: true,
      retitledHeadingIsNamed: true,
      emptyActiveSceneIsNamed: true,
      omittedEmptySceneIsAllowed: true,
      ownedSceneUsesItsOwnDocument: true,
    },
  );

  const timingIndex = screenplay({
    scenes: [
      {
        id: "SCN-OMITTED",
        title: "Omitted",
        status: "OMITTED",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-PRODUCTION",
        title: "Production",
        status: "active",
        covers: [],
        location: null,
        disposition: { phase: "production", reason: "Not in this pass." },
      },
      {
        id: "SCN-NO-SHOT",
        title: "No shot",
        status: "active",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-NO-DOC",
        title: "No doc",
        status: "active",
        path: "docs/no-doc.md",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-NO-HEADING",
        title: "No heading",
        status: "active",
        path: "docs/no-heading.md",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-MATCH",
        title: "Match",
        status: "active",
        path: "docs/match.md",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-ONE",
        title: "One",
        status: "active",
        covers: [],
        location: null,
        disposition: null,
      },
      {
        id: "SCN-MANY",
        title: "Many",
        status: "active",
        path: "docs/many.md",
        covers: [],
        location: null,
        disposition: null,
      },
    ],
  });
  const timingDocuments = new Map<string, string>([
    ["docs/no-heading.md", "No screenplay heading."],
    [
      "docs/match.md",
      [
        "# SCN-MATCH - Match",
        "At six seconds {@timing shot:match/duration}.",
        "The event opens at one second {@timing shot:match/event:event-0/from} and closes at two seconds {@timing shot:match/event:event-0/to}.",
        "Review at three seconds {@timing shot:match/review:frame-0}.",
      ].join("\n"),
    ],
    [
      "docs/combined.md",
      "## Sequence lasts seven seconds\n# SCN-ONE - One\nIt holds for one second.",
    ],
    [
      "docs/many.md",
      "# SCN-MANY - Many\nIt holds for quarter-second {@timing shot:many/duration}, half-second {@timing shot:other/duration}, and three seconds {@timing wrong-selector}.",
    ],
  ]);
  const contracts = new Map<string, IAutoMovieShotContract>([
    ["unused", contract({})],
    ["no-doc", contract({ evidence: ["SCN-NO-DOC"] })],
    ["no-heading", contract({ evidence: ["SCN-NO-HEADING"] })],
    [
      "match",
      contract({
        evidence: ["SCN-MATCH"],
        events: [{ from: 1, to: 2 }],
        frames: [3],
      }),
    ],
    ["one", contract({ evidence: ["SCN-ONE"] })],
    ["many", contract({ evidence: ["SCN-MANY"] })],
    ["other", contract({ duration: 0.5, evidence: ["SCN-MATCH"] })],
  ]);
  const runTiming = (scope: "design" | "source" | "review" | "final") =>
    screenplayTimingDiagnostics({
      contracts,
      read: (relative) => timingDocuments.get(relative) ?? null,
      scope,
      screenplay: timingIndex,
    });
  const design = runTiming("design");
  const source = runTiming("source");
  const review = runTiming("review");
  const final = runTiming("final");
  const timingCodes = review.map((diagnostic) => diagnostic.code);

  TestValidator.equals(
    "screenplay timing diagnostics own every skip, match, range, and severity branch",
    namedFacts([
      [
        "nullTimingIndexIsEmpty",
        () =>
          screenplayTimingDiagnostics({
            contracts,
            read: () => null,
            scope: "review",
            screenplay: null,
          }).length === 0,
      ],
      [
        "matchingTimesAreClean",
        () =>
          review.some((diagnostic) => diagnostic.path === "docs/match.md") ===
          false,
      ],
      [
        "missingDocumentsAreSkipped",
        () =>
          review.some((diagnostic) => diagnostic.path === "docs/no-doc.md") ===
          false,
      ],
      [
        "missingHeadingsAreSkipped",
        () =>
          review.some(
            (diagnostic) => diagnostic.path === "docs/no-heading.md",
          ) === false,
      ],
      [
        "wordAndPreambleTimesAreOwned",
        () =>
          review.filter(
            (diagnostic) =>
              diagnostic.code === "screenplay-timing-unowned" &&
              diagnostic.path === "docs/combined.md",
          ).length === 2,
      ],
      [
        "fractionValueMismatchIsNamed",
        () => timingCodes.includes("screenplay-timing-value-mismatch"),
      ],
      [
        "equalValueInAnotherShotDoesNotOwnOccurrence",
        () => timingCodes.includes("screenplay-timing-owner-absent"),
      ],
      [
        "unsupportedSelectorIsNamed",
        () => timingCodes.includes("screenplay-timing-reference-invalid"),
      ],
      [
        "authoringScopesWarn",
        () =>
          design.every((diagnostic) => diagnostic.category === "warning") &&
          source.every((diagnostic) => diagnostic.category === "warning"),
      ],
      [
        "deliveryScopesRefuse",
        () =>
          review.every((diagnostic) => diagnostic.category === "error") &&
          final.every((diagnostic) => diagnostic.category === "error"),
      ],
    ]),
    {
      nullTimingIndexIsEmpty: true,
      matchingTimesAreClean: true,
      missingDocumentsAreSkipped: true,
      missingHeadingsAreSkipped: true,
      wordAndPreambleTimesAreOwned: true,
      fractionValueMismatchIsNamed: true,
      equalValueInAnotherShotDoesNotOwnOccurrence: true,
      unsupportedSelectorIsNamed: true,
      authoringScopesWarn: true,
      deliveryScopesRefuse: true,
    },
  );
};
