import assert from "node:assert/strict";

import {
  AUTO_MOVIE_DELIVERY_TOC_END,
  AUTO_MOVIE_DELIVERY_TOC_START,
  applyAutoMovieContractMigrationPlan,
  createAutoMovieContractBaseline,
  createAutoMovieContractMigrationReceiptArtifacts,
  isAutoMovieContractTargetPath,
  parseAutoMovieContractBaseline,
  planAutoMovieContractMigration,
  planAutoMovieDeliveryToc,
} from "../src";

const baseline = (version: string, files: Readonly<Record<string, string>>) =>
  createAutoMovieContractBaseline({
    files,
    language: "english",
    version,
  });

const original = {
  "docs/discovery/a.md": "# A\n\n## Rule {#rule}\n\nOld.\n",
  "docs/discovery/rename.md": "# Rename\n\n## Rule {#rename}\n",
};
const target = {
  "docs/discovery/a.md": "# A\n\n## Rule {#rule}\n\nNew.\n",
  "docs/discovery/added.md": "# Added\n\n## Added {#added}\n",
  "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
};
const originalBaseline = baseline("1", original);
const targetBaseline = baseline("2", target);
const plan = planAutoMovieContractMigration({
  current: original,
  from: originalBaseline,
  targetSources: target,
  to: targetBaseline,
});
assert.deepEqual(
  plan.actions.map((action) => action.action),
  ["write", "add", "rename"],
);
assert.equal(plan.conflicts.length, 0);
const applied = applyAutoMovieContractMigrationPlan(plan, original);
assert.deepEqual(applied, target);
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.actions), true);
assert.equal(
  Object.isFrozen(
    parseAutoMovieContractBaseline(JSON.stringify(baseline("2", target))),
  ),
  true,
);
const outcomesOf = (
  migration: typeof plan,
  targetGeneration: typeof targetBaseline,
) =>
  migration.actions.map((action) => ({
    action: action.action,
    afterSha256: targetGeneration.files.find(
      (file) => file.path === action.path,
    )!.sha256,
    beforeSha256: action.action === "add" ? null : action.beforeSha256,
    from: action.action === "rename" ? action.from : null,
    path: action.path,
    status: "published" as const,
  }));
const receiptProps = {
  from: originalBaseline,
  observed: original,
  outcomes: outcomesOf(plan, targetBaseline),
  plan,
  publicationGeneration: "generation-a",
  to: targetBaseline,
  validation: "completed" as const,
};
const receipt = createAutoMovieContractMigrationReceiptArtifacts(receiptProps);
assert.deepEqual(
  createAutoMovieContractMigrationReceiptArtifacts(receiptProps),
  receipt,
);
assert.match(
  receipt.predecessor.path,
  /^automovie\/contract-migrations\/generation-a\/[0-9a-f]{64}\.baseline\.json$/u,
);
assert.match(
  receipt.receipt.path,
  /^automovie\/contract-migrations\/generation-a\/[0-9a-f]{64}\.receipt\.json$/u,
);
assert.equal(
  receipt.predecessor.source,
  `${JSON.stringify(originalBaseline, null, 2)}\n`,
);
assert.equal(JSON.parse(receipt.receipt.source).validation.status, "completed");
assert.notEqual(
  createAutoMovieContractMigrationReceiptArtifacts({
    ...receiptProps,
    publicationGeneration: "generation-b",
  }).receipt.path,
  receipt.receipt.path,
);
const changedTarget = {
  ...target,
  "docs/discovery/added.md": "# Added\n\n## Added {#added}\n\nChanged.\n",
};
const changedBaseline = baseline("3", changedTarget);
const changedPlan = planAutoMovieContractMigration({
  current: original,
  from: originalBaseline,
  targetSources: changedTarget,
  to: changedBaseline,
});
assert.notEqual(
  createAutoMovieContractMigrationReceiptArtifacts({
    from: originalBaseline,
    observed: original,
    outcomes: outcomesOf(changedPlan, changedBaseline),
    plan: changedPlan,
    publicationGeneration: "generation-a",
    to: changedBaseline,
    validation: "completed",
  }).receipt.path,
  receipt.receipt.path,
);
assert.throws(() =>
  createAutoMovieContractMigrationReceiptArtifacts({
    ...receiptProps,
    validation: "incomplete",
  }),
);
assert.throws(() =>
  createAutoMovieContractMigrationReceiptArtifacts({
    ...receiptProps,
    publicationGeneration: "con",
  }),
);
assert.throws(() =>
  createAutoMovieContractMigrationReceiptArtifacts({
    ...receiptProps,
    outcomes: receiptProps.outcomes.map((outcome, index) =>
      index === 0 ? { ...outcome, status: "failed" as const } : outcome,
    ),
  }),
);
assert.deepEqual(
  planAutoMovieContractMigration({
    current: applied,
    from: baseline("2", target),
    targetSources: target,
    to: baseline("2", target),
  }).actions,
  [],
);

const fencedAnchor =
  "# Contract\n\n```md\n## Example {#not-a-contract-anchor}\n```\n";
assert.deepEqual(
  baseline("1", { "docs/principles/core/fenced.md": fencedAnchor }).files[0]
    ?.anchors,
  [],
);
assert.equal(
  isAutoMovieContractTargetPath("docs/language/principles/common.md"),
  true,
);
for (const invalid of [
  "../outside.md",
  "docs/discovery/../outside.md",
  "docs\\discovery\\outside.md",
  "docs/discovery/CON.md",
  "docs/discovery/name .md\0",
  "docs/contracts/local.md",
])
  assert.equal(isAutoMovieContractTargetPath(invalid), false);
for (const invalidGeneration of ["^1.0.0", "1.0.0 beta"])
  assert.throws(() =>
    baseline(invalidGeneration, {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
  );
assert.throws(() =>
  baseline("1", {
    "docs/discovery/duplicate.md":
      "# Duplicate\n\n## One {#same}\n\n## Two {#same}\n",
  }),
);
assert.throws(() =>
  parseAutoMovieContractBaseline(
    JSON.stringify({
      ...baseline("1", original),
      files: [
        {
          anchors: [],
          path: "../outside.md",
          sha256:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
      ],
    }),
  ),
);
const orderedBaseline = baseline("1", original);
assert.throws(() =>
  parseAutoMovieContractBaseline(
    JSON.stringify({
      ...orderedBaseline,
      files: [...orderedBaseline.files].reverse(),
    }),
  ),
);
assert.throws(() =>
  planAutoMovieContractMigration({
    current: original,
    from: baseline("1", original),
    targetSources: target,
    to: createAutoMovieContractBaseline({
      files: target,
      language: "korean",
      version: "2",
    }),
  }),
);
assert.throws(() =>
  planAutoMovieContractMigration({
    current: original,
    from: baseline("1", original),
    targetSources: target,
    to: baseline("1", target),
  }),
);

const recoveredRename = planAutoMovieContractMigration({
  current: {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  },
  from: baseline("1", {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
  }),
  targetSources: {
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  },
  to: baseline("2", {
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  }),
});
assert.deepEqual(
  recoveredRename.actions.map((action) => action.action),
  ["rename"],
);
assert.deepEqual(
  applyAutoMovieContractMigrationPlan(recoveredRename, {
    "docs/discovery/rename.md": original["docs/discovery/rename.md"],
    "docs/discovery/renamed.md": original["docs/discovery/rename.md"],
  }),
  { "docs/discovery/renamed.md": original["docs/discovery/rename.md"] },
);

const removedAnchor = { "docs/discovery/a.md": "# A\n\nNo rule.\n" };
assert.equal(
  planAutoMovieContractMigration({
    current: { "docs/discovery/a.md": original["docs/discovery/a.md"] },
    from: baseline("1", {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
    targetSources: removedAnchor,
    to: baseline("2", removedAnchor),
  }).conflicts[0]?.kind,
  "removed-anchor",
);
assert.equal(
  planAutoMovieContractMigration({
    current: { "docs/discovery/a.md": "authored" },
    from: baseline("1", {
      "docs/discovery/a.md": original["docs/discovery/a.md"],
    }),
    targetSources: target,
    to: baseline("2", target),
  }).conflicts[0]?.kind,
  "local-modification",
);
assert.throws(() =>
  applyAutoMovieContractMigrationPlan(
    {
      ...plan,
      conflicts: [{ kind: "target-collision", path: "x", reason: "occupied" }],
    },
    original,
  ),
);

const index = "# Act One\n";
const units = [
  {
    path: "002-second.md",
    source: "# Second ] movement\\path\n\n## Scene {#second}\n",
  },
  {
    path: "001-first.md",
    source:
      "<!-- # Commented -->\n# First\n\n```md\n# Example\n```\n\n## Scene {#first}\n",
  },
];
const rendered = planAutoMovieDeliveryToc({
  indexPath: "docs/scripts/001-act/index.md",
  indexSource: index,
  units,
});
assert.equal(rendered.changed, true);
assert.equal(rendered.source.startsWith(index), true);
const paddedIndex = "# Padded index  \n";
assert.equal(
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: paddedIndex,
    units,
  }).source.startsWith(paddedIndex),
  true,
);
assert.ok(
  rendered.source.indexOf("001-first") < rendered.source.indexOf("002-second"),
);
assert.ok(rendered.source.includes("Second \\] movement\\\\path"));
assert.equal(
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: rendered.source,
    units,
  }).changed,
  false,
);
const staleCheck = planAutoMovieDeliveryToc({
  check: true,
  indexPath: "docs/scripts/001-act/index.md",
  indexSource: index,
  units,
});
assert.equal(staleCheck.diagnostics.length, 1);
assert.equal(staleCheck.source, rendered.source);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    check: true,
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${rendered.source}${AUTO_MOVIE_DELIVERY_TOC_END}\n`,
    units,
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${index}<!-- automovie:toc:start -->\n`,
    units,
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: index,
    units: [units[0]!, units[0]!],
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${rendered.source}- [Wrong](../outside.md)\n`,
    units,
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${index}\n## Authored prose {#wrong-owner}\n`,
    units,
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: index,
    units: [{ path: "../outside.md", source: "# Outside\n" }],
  }),
);
assert.throws(() =>
  planAutoMovieDeliveryToc({
    indexPath: "docs/scripts/001-act/index.md",
    indexSource: `${index}${AUTO_MOVIE_DELIVERY_TOC_END}\n${AUTO_MOVIE_DELIVERY_TOC_START}\n`,
    units,
  }),
);
