import type {
  AutoMovieLibraryReviewEvidence,
  IAutoMovieLibraryReviewPlanFile,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  libraryPublication,
  libraryPublicationOriginal,
  libraryPublicationReceipt,
} from "../internal/libraryReviewPublicationFixture";
import { throwsError } from "../internal/predicates";

/**
 * Sidecar edits preserve the complete history and the other H2 owners.
 *
 * Scenarios:
 *
 * 1. An absent file parses as empty; existing bytes reach the strict parser and
 *    malformed input preserves its failure rather than becoming an empty plan.
 * 2. New and replacement plans retain sibling H2s, waivers and every receipt.
 * 3. Only a passed receipt at the same observation and identity is replaced;
 *    failed, unsupported, not-run, older and sibling receipts remain in order.
 * 4. Identical receipt retries preserve original bytes, and a missing H2 or
 *    changed authoring basis refuses instead of manufacturing a reviewed state.
 * 5. Newly offered evidence is reopened only after current compile admission;
 *    changed or missing artifacts and facts preserve their exact refusal.
 */
export const test_cli_library_review_publication_history = (): void => {
  const empty: IAutoMovieLibraryReviewPlanFile = { version: 1, units: [] };
  for (const evidence of [
    { kind: "turntable", model: "subject" },
    { kind: "facts", facts: { width: 3 }, digest: `sha256:${"a".repeat(64)}` },
    {
      kind: "artifact",
      root: "project",
      path: "observation.txt",
      digest: `sha256:${"b".repeat(64)}`,
    },
  ] as AutoMovieLibraryReviewEvidence[]) {
    const changed: AutoMovieLibraryReviewEvidence =
      evidence.kind === "turntable"
        ? { ...evidence, model: "replacement" }
        : { ...evidence, digest: `sha256:${"e".repeat(64)}` };
    const sequence: string[] = [];
    libraryPublication.admitLibraryReviewReceipt({
      assertCurrent: () => {
        sequence.push("current");
      },
      expected: evidence,
      read: () => {
        sequence.push("evidence");
        return evidence;
      },
    });
    TestValidator.equals("current compile precedes fresh evidence", sequence, [
      "current",
      "evidence",
    ]);
    TestValidator.equals(
      "changed observation refused",
      throwsError(
        () =>
          libraryPublication.admitLibraryReviewReceipt({
            assertCurrent: () => {},
            expected: evidence,
            read: () => changed,
          }),
        "evidence changed",
      ),
      true,
    );
    TestValidator.equals(
      "failed compile prevents evidence reopening",
      throwsError(
        () =>
          libraryPublication.admitLibraryReviewReceipt({
            assertCurrent: () => {
              throw new Error("generated-tampered");
            },
            expected: evidence,
            read: () => {
              throw new Error("must not reopen");
            },
          }),
        "generated-tampered",
      ),
      true,
    );
    TestValidator.equals(
      "missing evidence preserves its cause",
      throwsError(
        () =>
          libraryPublication.admitLibraryReviewReceipt({
            assertCurrent: () => {},
            expected: evidence,
            read: () => {
              throw new Error("artifact disappeared");
            },
          }),
        "artifact disappeared",
      ),
      true,
    );
  }
  TestValidator.equals(
    "absence does not invoke parser",
    libraryPublication.parseLibraryReviewPublication({
      before: null,
      parse: () => {
        throw new Error("must not parse");
      },
    }),
    empty,
  );
  const before = {
    ...libraryPublicationOriginal(),
    source: '{ "version": 1, "units": [] }',
  };
  TestValidator.equals(
    "approved exact source reaches parser",
    libraryPublication.parseLibraryReviewPublication({
      before,
      parse: (source) => {
        TestValidator.equals("source bytes", source, before.source);
        return empty;
      },
    }),
    empty,
  );
  TestValidator.equals(
    "parser refusal preserved",
    throwsError(
      () =>
        libraryPublication.parseLibraryReviewPublication({
          before,
          parse: () => {
            throw new Error("invalid sidecar");
          },
        }),
      "invalid sidecar",
    ),
    true,
  );
  const unit = {
    anchor: "middle",
    sources: ["src/models/subject.ts"],
    observations: [
      { id: "whole", evidence: "turntable" as const, model: "subject" },
    ],
  };
  const first = libraryPublication.planLibraryReviewUnit({
    previous: empty,
    unit,
  });
  TestValidator.equals("new H2 has no invented receipts", first.units, [
    { ...unit, receipts: [] },
  ]);
  const history = ["failed", "unsupported", "not-run", "passed"].map(
    (verdict) =>
      libraryPublicationReceipt(
        verdict as "failed" | "unsupported" | "not-run" | "passed",
      ),
  );
  const previous: IAutoMovieLibraryReviewPlanFile = {
    version: 1,
    units: [
      { ...unit, anchor: "z-last", receipts: [] },
      {
        ...unit,
        receipts: history,
        waivers: [
          {
            observation: "rear",
            ground: "symmetry",
            disclosedBy: "whole",
            reason: "The front and rear are mirrored.",
          },
        ],
      },
      { ...unit, anchor: "a-first", receipts: [] },
    ],
  };
  const revised = libraryPublication.planLibraryReviewUnit({
    previous,
    unit: { ...unit, sources: ["src/models/revised.ts"] },
  });
  TestValidator.equals(
    "owners sorted without dropping siblings",
    revised.units.map((entry) => entry.anchor),
    ["a-first", "middle", "z-last"],
  );
  TestValidator.equals(
    "all waiver and receipt history retained",
    [revised.units[1]!.waivers, revised.units[1]!.receipts],
    [previous.units[1]!.waivers, history],
  );
  const unwaived = libraryPublication.planLibraryReviewUnit({
    previous: first,
    unit,
  });
  TestValidator.equals("unchanged unwaived H2", unwaived, first);
  const older = {
    ...libraryPublicationReceipt("passed"),
    identity: {
      ...libraryPublicationReceipt("passed").identity,
      generated: null,
    },
  };
  const sibling = {
    ...libraryPublicationReceipt("passed"),
    observation: "other",
  };
  previous.units[1]!.receipts.push(older, sibling);
  const receipt = {
    ...libraryPublicationReceipt("passed"),
    runtimeIdentity: "instrument:2",
  };
  const recorded = libraryPublication.recordLibraryReviewReceipt({
    previous,
    anchor: "middle",
    receipt,
  });
  TestValidator.equals(
    "only current passed receipt replaced",
    recorded.units[1]!.receipts,
    [...history.slice(0, 3), older, sibling, receipt],
  );
  TestValidator.equals(
    "original remains immutable",
    previous.units[1]!.receipts[3]!.runtimeIdentity,
    "instrument:1",
  );
  TestValidator.equals(
    "other H2 remains unchanged",
    recorded.units[0],
    previous.units[0],
  );
  for (const existing of recorded.units[1]!.receipts) {
    const repeated = libraryPublication.recordLibraryReviewReceipt({
      previous: recorded,
      anchor: "middle",
      receipt: existing,
    });
    TestValidator.equals(
      "identical terminal receipt is already recorded",
      repeated === recorded,
      true,
    );
  }
  const failed = {
    ...libraryPublicationReceipt("failed"),
    runtimeIdentity: "instrument:3",
  };
  const afterFailure = libraryPublication.recordLibraryReviewReceipt({
    previous: recorded,
    anchor: "middle",
    receipt: failed,
  });
  TestValidator.equals(
    "new failure retained and current pass superseded",
    afterFailure.units[1]!.receipts,
    [...history.slice(0, 3), older, sibling, failed],
  );
  TestValidator.equals(
    "missing owner refused",
    throwsError(
      () =>
        libraryPublication.recordLibraryReviewReceipt({
          previous: empty,
          anchor: "missing",
          receipt,
        }),
      "disappeared",
    ),
    true,
  );
  TestValidator.equals(
    "unchanged formatting is preserved",
    libraryPublication.libraryReviewPublicationSource({
      before,
      previous: empty,
      plan: empty,
    }),
    before.source,
  );
  TestValidator.equals(
    "new file serialization",
    libraryPublication.libraryReviewPublicationSource({
      before: null,
      previous: empty,
      plan: first,
    }),
    `${JSON.stringify(first, null, 2)}\n`,
  );
  TestValidator.equals(
    "changed file serialization",
    libraryPublication.libraryReviewPublicationSource({
      before,
      previous: empty,
      plan: first,
    }),
    `${JSON.stringify(first, null, 2)}\n`,
  );
  libraryPublication.assertLibraryReviewPlanAuthoring({
    expected: { target: "one" },
    read: () => ({ target: "one" }),
  });
  TestValidator.equals(
    "changed authoring refuses planning",
    throwsError(
      () =>
        libraryPublication.assertLibraryReviewPlanAuthoring({
          expected: { target: "one" },
          read: () => ({ target: "two" }),
        }),
      "authoring changed",
    ),
    true,
  );
  TestValidator.equals(
    "authoring read failure preserved",
    throwsError(
      () =>
        libraryPublication.assertLibraryReviewPlanAuthoring({
          expected: {},
          read: () => {
            throw new Error("missing source");
          },
        }),
      "missing source",
    ),
    true,
  );
};
