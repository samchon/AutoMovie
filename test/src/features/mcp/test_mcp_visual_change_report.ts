import { IAutoMovieVisualRevisionSnapshot } from "@automovie/interface";
import { compareAutoMovieVisualRevisions } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

const digest = (digit: string): `sha256:${string}` =>
  `sha256:${digit.repeat(64)}`;

const snapshot = (
  revision: string,
  catalog: string,
  views: IAutoMovieVisualRevisionSnapshot["views"],
): IAutoMovieVisualRevisionSnapshot => ({ revision, catalog, views });

const messageOf = (task: () => unknown): string => {
  try {
    task();
    return "accepted";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Visual progress compares existing digest catalogs without turning them into
 * review evidence or silently dropping the views that did not change.
 *
 * Scenarios:
 *
 * 1. Two revisions containing one witness of each status produce changed,
 *    unchanged, new and gone entries in subject-then-view code-unit order, and
 *    all four exact counts sum to the complete union.
 * 2. One digest-character change is the negative twin of exact equality: the
 *    same subject-view key changes from `unchanged` to `changed` without any
 *    other input changing.
 * 3. Empty snapshots are a valid boundary and produce an empty zero-count
 *    report; the populated comparison leaves both input records byte-for-byte
 *    unchanged.
 * 4. Blank or padded revision, catalog, subject and view identities, malformed
 *    digests, duplicate keys on either side, and cross-catalog comparisons are
 *    refused instead of being trimmed, overwritten or compared partially.
 */
export const test_mcp_visual_change_report = (): void => {
  const before = snapshot("compile-r1", "delivery-review", [
    { subject: "shot:z", view: "entry:beauty", digest: digest("1") },
    { subject: "shot:a", view: "gone:beauty", digest: digest("2") },
    { subject: "shot:a", view: "still:beauty", digest: digest("3") },
    { subject: "shot:a", view: "changed:beauty", digest: digest("4") },
  ]);
  const after = snapshot("compile-r2", "delivery-review", [
    { subject: "shot:a", view: "new:beauty", digest: digest("5") },
    { subject: "shot:a", view: "changed:beauty", digest: digest("6") },
    { subject: "shot:a", view: "still:beauty", digest: digest("3") },
    { subject: "shot:z", view: "entry:beauty", digest: digest("1") },
  ]);
  const preservedBefore = JSON.parse(
    JSON.stringify(before),
  ) as IAutoMovieVisualRevisionSnapshot;
  const preservedAfter = JSON.parse(
    JSON.stringify(after),
  ) as IAutoMovieVisualRevisionSnapshot;
  const report = compareAutoMovieVisualRevisions(before, after);
  TestValidator.equals("four-state visual revision report", report, {
    version: 1,
    catalog: "delivery-review",
    fromRevision: "compile-r1",
    toRevision: "compile-r2",
    counts: { changed: 1, unchanged: 2, new: 1, gone: 1 },
    views: [
      {
        subject: "shot:a",
        view: "changed:beauty",
        status: "changed",
        before: digest("4"),
        after: digest("6"),
      },
      {
        subject: "shot:a",
        view: "gone:beauty",
        status: "gone",
        before: digest("2"),
        after: null,
      },
      {
        subject: "shot:a",
        view: "new:beauty",
        status: "new",
        before: null,
        after: digest("5"),
      },
      {
        subject: "shot:a",
        view: "still:beauty",
        status: "unchanged",
        before: digest("3"),
        after: digest("3"),
      },
      {
        subject: "shot:z",
        view: "entry:beauty",
        status: "unchanged",
        before: digest("1"),
        after: digest("1"),
      },
    ],
  });
  TestValidator.equals(
    "before snapshot remains unchanged",
    before,
    preservedBefore,
  );
  TestValidator.equals(
    "after snapshot remains unchanged",
    after,
    preservedAfter,
  );

  const equalityBefore = snapshot("r1", "survey", [
    { subject: "space:hall", view: "north", digest: digest("a") },
  ]);
  const equal = compareAutoMovieVisualRevisions(
    equalityBefore,
    snapshot("r2", "survey", [
      { subject: "space:hall", view: "north", digest: digest("a") },
    ]),
  );
  const changed = compareAutoMovieVisualRevisions(
    equalityBefore,
    snapshot("r2", "survey", [
      { subject: "space:hall", view: "north", digest: digest("b") },
    ]),
  );
  TestValidator.equals(
    "one digest character separates unchanged from changed",
    [equal.views[0]!.status, changed.views[0]!.status],
    ["unchanged", "changed"],
  );

  TestValidator.equals(
    "empty visual catalogs remain comparable",
    compareAutoMovieVisualRevisions(
      snapshot("r1", "empty", []),
      snapshot("r2", "empty", []),
    ),
    {
      version: 1,
      catalog: "empty",
      fromRevision: "r1",
      toRevision: "r2",
      counts: { changed: 0, unchanged: 0, new: 0, gone: 0 },
      views: [],
    },
  );
  TestValidator.equals(
    "already ascending subjects keep deterministic code-unit order",
    compareAutoMovieVisualRevisions(
      snapshot("r1", "ordered", [
        { subject: "a", view: "same", digest: digest("0") },
        { subject: "b", view: "same", digest: digest("0") },
      ]),
      snapshot("r2", "ordered", [
        { subject: "a", view: "same", digest: digest("0") },
        { subject: "b", view: "same", digest: digest("0") },
      ]),
    ).views.map(({ subject }) => subject),
    ["a", "b"],
  );

  const valid = snapshot("r1", "survey", [
    { subject: "space:hall", view: "north", digest: digest("0") },
  ]);
  const invalids: Array<[string, IAutoMovieVisualRevisionSnapshot]> = [
    ["before revision must be", { ...valid, revision: "" }],
    ["before revision must not", { ...valid, revision: " r1" }],
    ["before catalog must be", { ...valid, catalog: "\t" }],
    ["before catalog must not", { ...valid, catalog: "survey " }],
    [
      "before subject must be",
      { ...valid, views: [{ ...valid.views[0]!, subject: "" }] },
    ],
    [
      "before subject must not",
      { ...valid, views: [{ ...valid.views[0]!, subject: " space:hall" }] },
    ],
    [
      "before view must be",
      { ...valid, views: [{ ...valid.views[0]!, view: "" }] },
    ],
    [
      "before view must not",
      { ...valid, views: [{ ...valid.views[0]!, view: "north " }] },
    ],
    [
      "before visual digest must be",
      { ...valid, views: [{ ...valid.views[0]!, digest: "sha256:ABC" }] },
    ],
    [
      "before visual snapshot repeats",
      { ...valid, views: [valid.views[0]!, { ...valid.views[0]! }] },
    ],
  ];
  for (const [prefix, invalid] of invalids)
    TestValidator.predicate(
      prefix,
      messageOf(() =>
        compareAutoMovieVisualRevisions(invalid, snapshot("r2", "survey", [])),
      ).startsWith(prefix),
    );

  TestValidator.predicate(
    "after-side duplicates are refused",
    messageOf(() =>
      compareAutoMovieVisualRevisions(valid, {
        ...valid,
        revision: "r2",
        views: [valid.views[0]!, { ...valid.views[0]! }],
      }),
    ).startsWith("after visual snapshot repeats"),
  );
  TestValidator.predicate(
    "different catalogs are refused",
    messageOf(() =>
      compareAutoMovieVisualRevisions(
        snapshot("r1", "delivery", []),
        snapshot("r2", "inspection", []),
      ),
    ).startsWith("Visual revision catalogs differ"),
  );
};
